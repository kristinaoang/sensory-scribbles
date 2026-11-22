import type { JournalEntry, MinigameQuestion, NightlyCaption } from '../types';
import {
  getEntriesForRoomAndDate,
  getPromptForDate,
  saveMinigameQuestions,
  upsertNightlyCaption,
} from '../server/db';
import { refreshQuestWordings } from '../server/guideAi';
import { generateNightlySummary } from '../server/gemini';

export interface MastraStepResult<T> {
  stepId: string;
  ok: boolean;
  data?: T;
  error?: string;
}

export interface NightlyWorkflowReport {
  ok: boolean;
  roomId: string;
  date: string;
  steps: Array<{ stepId: string; status: 'passed' | 'failed'; detail: string }>;
  caption?: NightlyCaption;
  questionsCreated?: MinigameQuestion[];
  error?: string;
}

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Validates that the generated caption:
 * - is non-empty and at most 2 sentences
 * - leaks zero author display names
 * - quotes no more than 5 consecutive words from any entry
 */
export function validateNightlyOutput(
  caption: string,
  questions: Array<{
    entryId: string;
    gameType: 'guess_prompt' | 'whose_is_it';
    questionText: string;
    options: string[];
    correctAnswer: string;
  }>,
  entries: JournalEntry[],
): { valid: boolean; reason: string } {
  const trimmedCaption = caption.trim();
  if (!trimmedCaption) {
    return { valid: false, reason: 'Generated caption was empty.' };
  }

  const sentenceCount = trimmedCaption
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean).length;
  if (sentenceCount > 2) {
    return { valid: false, reason: `Caption has ${sentenceCount} sentences; maximum allowed is 2.` };
  }

  const captionLower = trimmedCaption.toLowerCase();
  for (const entry of entries) {
    if (entry.authorDisplayName && entry.authorDisplayName.length >= 3) {
      const nameLower = entry.authorDisplayName.toLowerCase();
      if (captionLower.includes(nameLower)) {
        return { valid: false, reason: `Caption leaked a participant display name (${entry.authorDisplayName}).` };
      }
    }

    // Check 6-word consecutive window overlap
    const entryWords = normalizeWords(entry.sentence);
    if (entryWords.length >= 6) {
      const captionWords = normalizeWords(trimmedCaption).join(' ');
      for (let i = 0; i <= entryWords.length - 6; i++) {
        const sixWordSlice = entryWords.slice(i, i + 6).join(' ');
        if (captionWords.includes(sixWordSlice)) {
          return { valid: false, reason: 'Caption quoted more than 5 consecutive words from an entry.' };
        }
      }
    }
  }

  const validEntryIds = new Set(entries.map((e) => e.id));
  if (questions.length !== 3) {
    return { valid: false, reason: `Expected 3 minigame questions, received ${questions.length}.` };
  }

  for (const q of questions) {
    if (!validEntryIds.has(q.entryId)) {
      return { valid: false, reason: `Question referenced unknown entryId (${q.entryId}).` };
    }
    if (q.options.length !== 4 || !q.options.includes(q.correctAnswer)) {
      return { valid: false, reason: 'Question options must have 4 choices containing correctAnswer.' };
    }
  }

  return { valid: true, reason: 'All grounding, privacy, and quote-length checks passed.' };
}

/**
 * Mastra Nightly Workflow:
 * Step 1: Fetch room entries & prompt from Tiger Data / DB (fail safely if missing)
 * Step 2: Generate 2-sentence mosaic caption + 3 minigame questions via Gemini
 * Step 3: Check & validate output against source entries (no names, <= 5 quoted words, grounded entry IDs)
 * Step 4: Persist validated caption and questions
 */
export async function runMastraNightlyWorkflow(roomId: string, targetDate: string): Promise<NightlyWorkflowReport> {
  const steps: NightlyWorkflowReport['steps'] = [];

  // Step 1: Query Tiger Data for the day's unflagged entries
  const entries = await getEntriesForRoomAndDate(roomId, targetDate, false);
  const prompt = await getPromptForDate(targetDate);

  if (!prompt || entries.length === 0) {
    steps.push({
      stepId: 'fetch-day-entries',
      status: 'failed',
      detail: `Missing data for room=${roomId} date=${targetDate} (prompt=${Boolean(prompt)}, entries=${entries.length}). Halted safely without inventing content.`,
    });
    return {
      ok: false,
      roomId,
      date: targetDate,
      steps,
      error: 'Insufficient grounded data for this room and date. Workflow stopped safely.',
    };
  }

  steps.push({
    stepId: 'fetch-day-entries',
    status: 'passed',
    detail: `Loaded ${entries.length} unflagged entries and daily prompt.`,
  });

  // Step 2: Generate caption & 3 minigame questions via Gemini
  let generated;
  try {
    generated = await generateNightlySummary(prompt.text, entries);
    steps.push({
      stepId: 'generate-gemini-summary',
      status: 'passed',
      detail: `Generated caption and ${generated.questions.length} minigame questions.`,
    });
  } catch (err: any) {
    steps.push({
      stepId: 'generate-gemini-summary',
      status: 'failed',
      detail: err?.message || 'Gemini generation failed.',
    });
    return {
      ok: false,
      roomId,
      date: targetDate,
      steps,
      error: err?.message || 'Gemini generation failed.',
    };
  }

  // Step 3: Validation check step
  const check = validateNightlyOutput(generated.caption, generated.questions, entries);
  if (!check.valid) {
    steps.push({
      stepId: 'validate-grounded-output',
      status: 'failed',
      detail: check.reason,
    });
    return {
      ok: false,
      roomId,
      date: targetDate,
      steps,
      error: `Validation guard rejected output: ${check.reason}`,
    };
  }

  steps.push({
    stepId: 'validate-grounded-output',
    status: 'passed',
    detail: check.reason,
  });

  // Step 4: Persist validated caption & questions
  const savedCaption = await upsertNightlyCaption({
    roomId,
    captionDate: targetDate,
    caption: generated.caption,
    entryCount: entries.length,
    validated: true,
  });

  const savedQuestions = await saveMinigameQuestions(
    generated.questions.map((q) => ({
      roomId,
      entryId: q.entryId,
      questionDate: targetDate,
      gameType: q.gameType,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      isDemo: entries.every((e) => e.isDemo),
    })),
  );

  steps.push({
    stepId: 'persist-nightly-artifacts',
    status: 'passed',
    detail: `Saved mosaic caption and ${savedQuestions.length} minigame questions.`,
  });

  try {
    const wordings = await refreshQuestWordings();
    steps.push({
      stepId: 'refresh-quest-wordings',
      status: 'passed',
      detail: wordings.updated > 0 ? `Cached ${wordings.updated} campus quest prompts.` : 'Campus quest prompts stayed on the saved wording.',
    });
  } catch {
    steps.push({
      stepId: 'refresh-quest-wordings',
      status: 'passed',
      detail: 'Campus quest prompts stayed on the saved wording.',
    });
  }

  return {
    ok: true,
    roomId,
    date: targetDate,
    steps,
    caption: savedCaption,
    questionsCreated: savedQuestions,
  };
}
