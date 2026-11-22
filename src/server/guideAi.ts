import fs from 'fs';
import path from 'path';
import { GoogleGenAI, Type } from '@google/genai';
import { getCachedQuestPrompt, saveCachedQuestPrompt } from './db';
import {
  acceptableChildLine,
  asksPersonal,
  cannedAnimalLine,
  containsBanned,
  wordCount,
} from './guideSafety';

export interface AnimalResult {
  reply: string;
  suggestDraw: boolean;
  fallback: boolean;
}

export interface IdeaResult {
  ideas: string[];
  fallback: boolean;
}

type QuestFile = {
  quests: Array<{
    id: string;
    title: string;
    prompt: string;
    ideas?: string[];
  }>;
};

function readQuestFile(): QuestFile {
  const file = path.resolve(process.cwd(), 'content/quests.json');
  return JSON.parse(fs.readFileSync(file, 'utf8')) as QuestFile;
}

function textModel(): string {
  return process.env.GEMINI_TEXT_MODEL?.trim() || '';
}

function safetyModel(): string {
  return textModel() || process.env.GEMINI_SAFETY_MODEL?.trim() || '';
}

function client(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') return null;
  return new GoogleGenAI({
    apiKey,
    apiVersion: 'v1beta',
    httpOptions: {
      apiVersion: 'v1beta',
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function parseJson(text: string): any {
  const trimmed = text.trim().replace(/^```json\s*/i, '').replace(/```$/, '');
  return JSON.parse(trimmed);
}

async function generateJson(model: string, prompt: string, schema: Record<string, unknown>, ms: number): Promise<any> {
  const ai = client();
  if (!ai || !model) throw new Error('unavailable');
  const response = await withTimeout(
    ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.4,
        responseMimeType: 'application/json',
        responseSchema: schema,
      },
    }),
    ms,
  );
  const text = response.text || '';
  if (!text.trim()) throw new Error('empty');
  return parseJson(text);
}

export function finalizeAnimalReply(raw: { reply?: unknown; suggestDraw?: unknown } | null, kind: string): AnimalResult {
  const canned = cannedAnimalLine(kind);
  if (!raw || typeof raw.reply !== 'string' || !acceptableChildLine(raw.reply, 25)) {
    return { reply: canned.reply, suggestDraw: true, fallback: true };
  }
  return { reply: raw.reply.trim(), suggestDraw: raw.suggestDraw !== false, fallback: false };
}

export function finalizeIdeas(raw: unknown, fallbackIdeas: string[]): IdeaResult {
  const safeFallback = fallbackIdeas.filter((idea) => acceptableChildLine(idea, 12)).slice(0, 3);
  const ideas = Array.isArray(raw) ? raw.map((item) => String(item || '').trim()) : [];
  const clean = ideas.filter((idea) => acceptableChildLine(idea, 12));
  if (clean.length !== 3) {
    return { ideas: safeFallback.slice(0, 3), fallback: true };
  }
  return { ideas: clean, fallback: false };
}

const ANIMAL_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    suggestDraw: { type: Type.BOOLEAN },
  },
  required: ['reply', 'suggestDraw'],
};

const SAFETY_SCHEMA = {
  type: Type.OBJECT,
  properties: { ok: { type: Type.BOOLEAN } },
  required: ['ok'],
};

const IDEAS_SCHEMA = {
  type: Type.OBJECT,
  properties: { ideas: { type: Type.ARRAY, items: { type: Type.STRING } } },
  required: ['ideas'],
};

const PROMPT_SCHEMA = {
  type: Type.OBJECT,
  properties: { prompt: { type: Type.STRING } },
  required: ['prompt'],
};

export async function animalReply(input: {
  kind: string;
  name: string;
  text: string;
  simulateFailure?: boolean;
}): Promise<AnimalResult> {
  const kind = String(input.kind || 'animal').toLowerCase().replace(/[^a-z]/g, '').slice(0, 24) || 'animal';
  const canned = cannedAnimalLine(kind);
  if (input.simulateFailure || !client() || !textModel() || !safetyModel()) {
    return { ...canned, fallback: true };
  }
  const text = String(input.text || '').trim().slice(0, 80);
  if (!text || containsBanned(text) || asksPersonal(text)) {
    return { ...canned, fallback: true };
  }
  const name = String(input.name || `the ${kind}`).replace(/[^\w\s'-]/g, '').slice(0, 40) || `the ${kind}`;
  try {
    return await withTimeout(
      (async () => {
        const drafted = await generateJson(
          textModel(),
          [
            'You speak to a young child who is exploring a college campus in a gentle story world.',
            'Never ask for names, ages, school, address, photos, or any personal information.',
            'No advice about health, safety, family, or feelings beyond simple kindness.',
            'No scary content.',
            'No claims to be a person.',
            'If something is off-topic, gently redirect back to what the child sees and to drawing.',
            'Reply as the animal in one or two short warm sentences, then invite drawing or writing.',
            'The reply must be 25 words or fewer.',
            `The child is talking to ${name}. They said: ${JSON.stringify(text)}`,
          ].join('\n'),
          ANIMAL_SCHEMA,
          1800,
        );
        const local = finalizeAnimalReply(drafted, kind);
        if (local.fallback) return local;
        const safety = await generateJson(
          safetyModel(),
          [
            'You check a short line before it is shown to a young child.',
            'Mark ok true only if the line is kind, stays on what the child can see, invites drawing or writing, and does not ask for personal information, give advice about health, safety, family, or feelings, include scary content, or claim to be a real person.',
            `Line: ${JSON.stringify(local.reply)}`,
          ].join('\n'),
          SAFETY_SCHEMA,
          1200,
        );
        if (!safety || safety.ok !== true) return { ...canned, fallback: true };
        if (wordCount(local.reply) > 25 || containsBanned(local.reply)) return { ...canned, fallback: true };
        return local;
      })(),
      2500,
    );
  } catch {
    return { ...canned, fallback: true };
  }
}

export async function suggestIdeas(input: {
  questId: string;
  simulateFailure?: boolean;
}): Promise<IdeaResult> {
  const file = readQuestFile();
  const quest = file.quests.find((item) => item.id === input.questId) || file.quests[0];
  const fallback = quest?.ideas || [];
  if (!quest || input.simulateFailure || !client() || !textModel()) {
    return finalizeIdeas(null, fallback);
  }
  try {
    const drafted = await generateJson(
      textModel(),
      [
        'Give exactly 3 short ideas for a young child at one campus spot.',
        'Each idea is concrete and sensory, at most 12 words, and is something to draw or write.',
        'Do not ask for personal information. No scary content. No advice about health, safety, family, or feelings.',
        `Spot: ${quest.title}`,
        `Prompt: ${quest.prompt}`,
      ].join('\n'),
      IDEAS_SCHEMA,
      8000,
    );
    return finalizeIdeas(drafted?.ideas, fallback);
  } catch {
    return finalizeIdeas(null, fallback);
  }
}

export async function listQuestPrompts(): Promise<Array<{ id: string; prompt: string; source: 'cache' | 'static' }>> {
  const file = readQuestFile();
  const out = [];
  for (const quest of file.quests) {
    const cached = await getCachedQuestPrompt(quest.id);
    if (cached && acceptableChildLine(cached, 22)) {
      out.push({ id: quest.id, prompt: cached, source: 'cache' as const });
    } else {
      out.push({ id: quest.id, prompt: quest.prompt, source: 'static' as const });
    }
  }
  return out;
}

export async function refreshQuestWordings(): Promise<{ updated: number }> {
  if (!client() || !textModel()) return { updated: 0 };
  const file = readQuestFile();
  let updated = 0;
  for (const quest of file.quests) {
    try {
      const drafted = await generateJson(
        textModel(),
        [
          'Rewrite this prompt for a young child walking on a college campus.',
          'Keep the same place and activity. Make it short, concrete, sensory, and kind. 18 words or fewer.',
          'Do not ask for personal information. No scary content.',
          `Place: ${quest.title}`,
          `Current prompt: ${quest.prompt}`,
        ].join('\n'),
        PROMPT_SCHEMA,
        8000,
      );
      const prompt = String(drafted?.prompt || '').trim();
      if (!acceptableChildLine(prompt, 22)) continue;
      await saveCachedQuestPrompt(quest.id, prompt);
      updated += 1;
    } catch {
      // Keep the static prompt from quests.json.
    }
  }
  return { updated };
}
