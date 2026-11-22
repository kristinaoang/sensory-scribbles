import { Agent } from '@mastra/core/agent';
import { z } from 'zod';

const DEADLINE_MS = 2500;

const BANNED_WORDS = [
  'kill',
  'murder',
  'suicide',
  'sex',
  'sexual',
  'porn',
  'nude',
  'naked',
  'drug',
  'cocaine',
  'heroin',
  'gun',
  'blood',
  'hate',
  'stupid',
  'idiot',
  'dumb',
];

const CANNED_PROMPTS = [
  'If your afternoon were a song, what would it be?',
  'What color was the quiet part of today?',
  'If the lawn could whisper, what would it say?',
];

const CANNED_IDEAS = [
  'Draw one soft shape you noticed.',
  'Write three quiet words.',
  'Sketch the color of the afternoon.',
];

const CANNED_REPLY = 'The little fox sits beside you on the lawn. What color is the quiet?';

const questSchema = z.object({
  prompt: z.string(),
});

const ideasSchema = z.object({
  ideas: z.array(z.string()).length(3),
});

const animalSchema = z.object({
  reply: z.string(),
  safe: z.boolean(),
});

export interface ChildTextResult {
  text: string;
  source: 'mastra' | 'fallback';
}

export interface ChildIdeasResult {
  ideas: string[];
  source: 'mastra' | 'fallback';
}

export interface AnimalReplyResult {
  reply: string;
  safe: true;
  source: 'mastra' | 'fallback';
}

function clip(value: unknown, max: number): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function hasBanned(text: string): boolean {
  const words = text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.some((word) => BANNED_WORDS.includes(word))) return true;
  return /https?:\/\/|www\.|@|\d{3}[-.\s]\d{3}/i.test(text);
}

function fits(text: string, min: number, max: number): boolean {
  return text.length >= min && text.length <= max && !text.includes('\n') && !hasBanned(text);
}

function modelSpec(envName: string): { id: `${string}/${string}`; apiKey: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  const modelId = (process.env[envName] || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured');
  }
  if (!modelId) throw new Error(`${envName} is not set`);
  const id = (modelId.includes('/') ? modelId : `google/${modelId}`) as `${string}/${string}`;
  return { id, apiKey };
}

async function withDeadline<T>(run: (signal: AbortSignal) => Promise<T>, ms = DEADLINE_MS): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run(ctrl.signal),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          ctrl.abort();
          reject(new Error('deadline'));
        }, ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function ask<T>(envName: string, instructions: string, prompt: string, schema: z.ZodType<T>, signal: AbortSignal): Promise<T> {
  const agent = new Agent({
    id: 'sensory-child-guide',
    name: 'Sensory Child Guide',
    instructions,
    model: modelSpec(envName),
  });
  const response = await agent.generate(prompt, {
    abortSignal: signal,
    structuredOutput: {
      schema,
      jsonPromptInjection: 'auto',
    },
    modelSettings: {
      temperature: 0.6,
      timeout: { totalMs: 2300, stepMs: 2100 },
    },
  });
  const parsed = schema.safeParse(response.object);
  if (!parsed.success) throw new Error('structured output failed checks');
  return parsed.data;
}

export async function wordQuestPrompt(place?: string): Promise<ChildTextResult> {
  const where = clip(place, 80) || 'the Wellesley College lawn';
  const fallback = CANNED_PROMPTS[where.length % CANNED_PROMPTS.length];
  try {
    const result = await withDeadline((signal) =>
      ask(
        'GEMINI_CHILD_MODEL',
        'You write one gentle question for a child on a pastel college campus. One sentence, 12 to 110 characters, no names, no places that are not the campus lawn, no scary or personal topics. The child will answer by drawing or writing.',
        `Write one question about ${where}.`,
        questSchema,
        signal,
      ),
    );
    const prompt = clip(result.prompt, 140);
    if (!fits(prompt, 12, 120)) return { text: fallback, source: 'fallback' };
    return { text: prompt, source: 'mastra' };
  } catch {
    return { text: fallback, source: 'fallback' };
  }
}

export async function drawWriteIdeas(prompt?: string): Promise<ChildIdeasResult> {
  const question = clip(prompt, 180) || CANNED_PROMPTS[0];
  try {
    const result = await withDeadline((signal) =>
      ask(
        'GEMINI_CHILD_MODEL',
        'You offer a child three short ideas for answering a campus journal prompt. Each idea is 8 to 72 characters, concrete, gentle, and either a drawing idea or a writing idea. No names, no links, no scary topics. Return exactly three.',
        `Prompt: ${question}`,
        ideasSchema,
        signal,
      ),
    );
    const ideas = result.ideas.map((idea) => clip(idea, 80));
    if (ideas.length !== 3 || ideas.some((idea) => !fits(idea, 8, 72))) {
      return { ideas: CANNED_IDEAS, source: 'fallback' };
    }
    return { ideas, source: 'mastra' };
  } catch {
    return { ideas: CANNED_IDEAS, source: 'fallback' };
  }
}

export async function animalReply(animal?: string, note?: string): Promise<AnimalReplyResult> {
  const creature = clip(animal, 40) || 'fox';
  const heard = clip(note, 180);
  const canned = { reply: CANNED_REPLY, safe: true as const, source: 'fallback' as const };
  if (!heard || hasBanned(heard) || heard.length > 160) return canned;
  try {
    const result = await withDeadline((signal) =>
      ask(
        'GEMINI_SAFETY_MODEL',
        'You are a small campus animal talking to a child. Reply in one or two short sentences, 12 to 140 characters. Also decide if the child note is safe. Set safe to false for meanness, secrets, personal contact details, scary requests, or anything a child should not hear back. Never repeat personal details. Never store or quote more than a few of the child words.',
        `Animal: ${creature}. Child note: ${heard}`,
        animalSchema,
        signal,
      ),
    );
    const reply = clip(result.reply, 160);
    if (!result.safe || !fits(reply, 12, 150)) return canned;
    return { reply, safe: true, source: 'mastra' };
  } catch {
    return canned;
  }
}
