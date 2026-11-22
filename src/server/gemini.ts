import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type { JournalEntry, SensoryWorldSpec } from '../types';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const MODERATION_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

function isTransientUpstreamError(err: any): boolean {
  const status = Number(err?.status || err?.code || 0);
  const msg = String(err?.message || '');
  return (
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /503|UNAVAILABLE|high demand|RESOURCE_EXHAUSTED|overloaded|timed out|ECONNRESET|fetch failed/i.test(msg)
  );
}

export function formatGeminiErrorMessage(err: any, fallback = 'Gemini service is temporarily unavailable. Please try again.'): string {
  const raw = String(err?.message || '').trim();
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    const innerMsg = parsed?.error?.message || parsed?.message;
    if (typeof innerMsg === 'string' && innerMsg.trim()) {
      return innerMsg.trim();
    }
  } catch {
    // Not JSON
  }
  return raw;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Gemini request timed out')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateContentWithFallback(
  paramsFactory: (model: string) => Parameters<GoogleGenAI['models']['generateContent']>[0],
) {
  const ai = getAiClient();
  let lastError: unknown = null;

  for (const model of MODERATION_MODELS) {
    const attempts = model === 'gemini-4-hydrogen' ? 1 : 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await withTimeout(ai.models.generateContent(paramsFactory(model)), 8000);
      } catch (err: any) {
        lastError = err;
        if (!isTransientUpstreamError(err)) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 250 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}

export interface ModerationResult {
  allowed: boolean;
  flagged: boolean;
  category: 'clean' | 'link_or_media' | 'pii' | 'unsafe_content';
  reason: string;
}

const URL_REGEX = /(https?:\/\/|www\.|[a-zA-Z0-9-]+\.(com|org|net|io|co|edu|gov|gg|me|xyz)\b)/i;
const EMAIL_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_REGEX = /(\+?\d{1,3}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/;
const ADDRESS_REGEX = /\b\d{1,5}\s+[A-Za-z0-9.\s]{2,25}\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct)\b/i;

export async function moderateSentence(sentence: string): Promise<ModerationResult> {
  const trimmed = sentence.trim();
  if (!trimmed) {
    return { allowed: false, flagged: true, category: 'unsafe_content', reason: 'Sentence cannot be empty.' };
  }
  if (trimmed.length > 140) {
    return { allowed: false, flagged: true, category: 'unsafe_content', reason: 'Sentence exceeds 140 characters.' };
  }

  // Deterministic pre-checks for links, emails, phone numbers, street addresses
  if (URL_REGEX.test(trimmed)) {
    return {
      allowed: false,
      flagged: true,
      category: 'link_or_media',
      reason: 'Links and URLs are not allowed in Sensory Scribbles.',
    };
  }
  if (EMAIL_REGEX.test(trimmed) || PHONE_REGEX.test(trimmed) || ADDRESS_REGEX.test(trimmed)) {
    return {
      allowed: false,
      flagged: true,
      category: 'pii',
      reason: 'Personal contact information (email, phone, or street address) is not allowed.',
    };
  }

  const response = await generateContentWithFallback((model) => ({
    model,
    contents: `Evaluate this short sensory reflection sentence for safety and privacy before publishing in a shared school/dorm room mosaic:\n\n"${trimmed}"`,
    config: {
      systemInstruction:
        'You are a strict content moderator for a peaceful anonymous journaling app. Reject any sentence containing slurs, hate speech, harassment, bullying, sexual or explicit content, threats of violence/self-harm, links/URLs, or personal identifying information (phone numbers, street addresses, emails, social handles, or full first+last real names). Poetic sensory imagery about ordinary objects, weather, fabrics, sounds, or mild bittersweet feelings is completely allowed.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          allowed: {
            type: Type.BOOLEAN,
            description: 'True only if the sentence is completely safe and free of PII/slurs/harassment/sexual content/threats/links.',
          },
          category: {
            type: Type.STRING,
            description: 'One of: clean, link_or_media, pii, unsafe_content',
          },
          reason: {
            type: Type.STRING,
            description: 'Short plain-language reason (under 15 words).',
          },
        },
        required: ['allowed', 'category', 'reason'],
      },
    },
  }));

  const parsed = JSON.parse((response.text ?? '{}').trim());
  const allowed = Boolean(parsed.allowed);
  const category = (['clean', 'link_or_media', 'pii', 'unsafe_content'].includes(parsed.category)
    ? parsed.category
    : allowed
      ? 'clean'
      : 'unsafe_content') as ModerationResult['category'];

  return {
    allowed,
    flagged: !allowed,
    category,
    reason: parsed.reason || (allowed ? 'Passed moderation' : 'Flagged by safety filter'),
  };
}

export function deriveSensoryWorldSpec(sentence: string, strokeColor: string): SensoryWorldSpec {
  const lower = sentence.toLowerCase();

  if (/(rain|water|ocean|sea|mist|river|glass|ice|snow|dew|tide|drizzle|puddle)/.test(lower)) {
    return {
      theme: 'glass_rain',
      moodColor: '#4A9CC7',
      secondaryColor: '#9ED8DB',
      skyTint: '#D8EDF8',
      elementType: 'pond',
      weather: 'mist',
      label: 'Glass Rain Garden',
      biome: 'rain_garden',
      flora: 'reeds_and_lilies',
      landmark: 'stepping_pond',
      timeOfDay: 'morning',
      poeticSummary: 'Cool mist hovers above clear stepping stones and quiet pond reeds.',
    };
  }
  if (/(silk|petal|linen|cloud|ribbon|breeze|kite|thread|cotton|feather|wind|laundry)/.test(lower)) {
    return {
      theme: 'silk_meadow',
      moodColor: '#69B578',
      secondaryColor: '#F3D58D',
      skyTint: '#E6F4FE',
      elementType: 'windmill',
      weather: 'breeze',
      label: 'Sunlit Breeze Meadow',
      biome: 'meadow',
      flora: 'wildflowers',
      landmark: 'windmill',
      timeOfDay: 'afternoon',
      poeticSummary: 'Warm gusts roll across clover hills beside a turning canvas windmill.',
    };
  }
  if (/(velvet|moss|forest|pine|bark|fern|cedar|leaf|oak|mushroom|soil|wood|tree)/.test(lower)) {
    return {
      theme: 'velvet_grove',
      moodColor: '#3B845E',
      secondaryColor: '#8B5E3C',
      skyTint: '#DFF0E4',
      elementType: 'tree',
      weather: 'sunbeams',
      label: 'Velvet Cedar Clearing',
      biome: 'pine_forest',
      flora: 'pine_trees',
      landmark: 'wooden_cabin',
      timeOfDay: 'afternoon',
      poeticSummary: 'Tall pines and mossy earth shelter a cozy cedar cabin in filtered sunbeams.',
    };
  }
  if (/(tea|amber|candle|hearth|toast|cinnamon|honey|ember|lantern|warm|copper|brass|mug|kitchen)/.test(lower)) {
    return {
      theme: 'amber_hearth',
      moodColor: '#C87640',
      secondaryColor: '#F5C15C',
      skyTint: '#FCEFD9',
      elementType: 'lantern',
      weather: 'fireflies',
      label: 'Amber Tea Clearing',
      biome: 'amber_grove',
      flora: 'peach_trees',
      landmark: 'tea_pavilion',
      timeOfDay: 'golden_hour',
      poeticSummary: 'Golden hour warms a quiet wooden pavilion and fruit trees humming with fireflies.',
    };
  }
  if (/(denim|stone|chalk|slate|pebble|iron|salt|concrete|brick|gravel|ceramic|frost)/.test(lower)) {
    return {
      theme: 'denim_coast',
      moodColor: '#5B7DB1',
      secondaryColor: '#CBD5E1',
      skyTint: '#E5EDF5',
      elementType: 'crystal',
      weather: 'breeze',
      label: 'Coastal Stone Ridge',
      biome: 'coastal_cove',
      flora: 'mossy_boulders',
      landmark: 'stone_lantern',
      timeOfDay: 'morning',
      poeticSummary: 'Cool coastal stones and carved lanterns overlook the open water breeze.',
    };
  }

  return {
    theme: 'moss_stone',
    moodColor: strokeColor || '#4C9A6A',
    secondaryColor: '#E5A952',
    skyTint: '#EAF3E6',
    elementType: 'loom',
    weather: 'sunbeams',
    label: 'Birch & Loom Glade',
    biome: 'meadow',
    flora: 'birch_grove',
    landmark: 'weaver_loom',
    timeOfDay: 'afternoon',
    poeticSummary: 'Silver birch leaves sway gently beside a sun-dappled outdoor wooden loom.',
  };
}

/**
 * Interprets the user's journal TEXT (never the stroke) into a natural 3D world specification via Gemini.
 */
export async function interpretTextToSensoryWorld(sentence: string, fallbackColor: string): Promise<SensoryWorldSpec> {
  const fallback = deriveSensoryWorldSpec(sentence, fallbackColor);
  try {
    const response = await generateContentWithFallback((model) => ({
      model,
      contents: `Interpret the sensory atmosphere of this short journal reflection into a natural walkable outdoor 3D scene:\n\n"${sentence}"`,
      config: {
        systemInstruction:
          'You translate a short poetic sentence into a natural, Animal-Crossing-like outdoor 3D landscape (NO abstract shapes or drawn lines). Choose the most fitting natural biome, flora, landmark, timeOfDay, weather, pleasant natural hex colors, a 2-3 word scene label, and a 1-sentence poeticSummary.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            biome: {
              type: Type.STRING,
              description: 'One of: meadow, pine_forest, coastal_cove, rain_garden, amber_grove, stone_ridge',
            },
            flora: {
              type: Type.STRING,
              description: 'One of: peach_trees, pine_trees, birch_grove, reeds_and_lilies, wildflowers, mossy_boulders',
            },
            landmark: {
              type: Type.STRING,
              description: 'One of: wooden_cabin, stone_lantern, windmill, tea_pavilion, weaver_loom, stepping_pond',
            },
            timeOfDay: {
              type: Type.STRING,
              description: 'One of: morning, afternoon, golden_hour, twilight',
            },
            weather: {
              type: Type.STRING,
              description: 'One of: sunbeams, mist, fireflies, breeze',
            },
            moodColor: { type: Type.STRING, description: 'Natural landscape hex color like #4E8B63' },
            secondaryColor: { type: Type.STRING, description: 'Warm accent hex color like #F2C572' },
            skyTint: { type: Type.STRING, description: 'Soft sky hex tint like #DCEEF8' },
            label: { type: Type.STRING, description: 'Short 2-4 word natural clearing name' },
            poeticSummary: { type: Type.STRING, description: 'One short sentence describing this natural place' },
          },
          required: ['biome', 'flora', 'landmark', 'timeOfDay', 'weather', 'moodColor', 'secondaryColor', 'skyTint', 'label', 'poeticSummary'],
        },
      },
    }));

    const parsed = JSON.parse((response.text ?? '{}').trim());
    const landmarkMap: Record<string, SensoryWorldSpec['elementType']> = {
      wooden_cabin: 'tree',
      stone_lantern: 'lantern',
      windmill: 'windmill',
      tea_pavilion: 'lantern',
      weaver_loom: 'loom',
      stepping_pond: 'pond',
    };
    const biomeThemeMap: Record<string, SensoryWorldSpec['theme']> = {
      meadow: 'silk_meadow',
      pine_forest: 'velvet_grove',
      coastal_cove: 'denim_coast',
      rain_garden: 'glass_rain',
      amber_grove: 'amber_hearth',
      stone_ridge: 'moss_stone',
    };

    const biome = parsed.biome in biomeThemeMap ? parsed.biome : fallback.biome!;
    const landmark = parsed.landmark in landmarkMap ? parsed.landmark : fallback.landmark!;

    return {
      theme: biomeThemeMap[biome] || fallback.theme,
      moodColor: /^#[0-9a-fA-F]{6}$/.test(parsed.moodColor) ? parsed.moodColor : fallback.moodColor,
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.secondaryColor) ? parsed.secondaryColor : fallback.secondaryColor,
      skyTint: /^#[0-9a-fA-F]{6}$/.test(parsed.skyTint) ? parsed.skyTint : fallback.skyTint,
      elementType: landmarkMap[landmark] || fallback.elementType,
      weather: ['sunbeams', 'mist', 'fireflies', 'breeze'].includes(parsed.weather) ? parsed.weather : fallback.weather,
      label: String(parsed.label || fallback.label).slice(0, 40),
      biome,
      flora: ['peach_trees', 'pine_trees', 'birch_grove', 'reeds_and_lilies', 'wildflowers', 'mossy_boulders'].includes(parsed.flora)
        ? parsed.flora
        : fallback.flora,
      landmark,
      timeOfDay: ['morning', 'afternoon', 'golden_hour', 'twilight'].includes(parsed.timeOfDay)
        ? parsed.timeOfDay
        : fallback.timeOfDay,
      poeticSummary: String(parsed.poeticSummary || fallback.poeticSummary).slice(0, 140),
    };
  } catch {
    return fallback;
  }
}

export interface NightlyGenerationResult {
  caption: string;
  questions: Array<{
    entryId: string;
    gameType: 'guess_prompt' | 'whose_is_it';
    questionText: string;
    options: string[];
    correctAnswer: string;
  }>;
}

export async function generateNightlySummary(
  promptText: string,
  entries: JournalEntry[],
): Promise<NightlyGenerationResult> {
  const compactEntries = entries.map((e) => ({
    id: e.id,
    sentence: e.sentence,
    strokeColor: e.strokeJson.color,
    worldTheme: e.worldSpec.label,
  }));

  const response = await generateContentWithFallback((model) => ({
    model,
    contents: `Today's room prompt: "${promptText}"\n\nAccepted entries (${compactEntries.length}):\n${JSON.stringify(compactEntries, null, 2)}`,
    config: {
      systemInstruction:
        'You are writing a quiet, poetic nightly summary for a room mosaic. Rules:\n1) Write EXACTLY two sentences for the mosaic caption.\n2) Never include any names, usernames, or people identifiers.\n3) NEVER quote more than 5 consecutive words from any entry—paraphrase and synthesize the shared sensory mood instead.\n4) Generate 3 minigame questions grounded strictly in the provided entries (using real entry IDs from the input). Each question must have 4 short options and one correctAnswer that matches one of the 4 options exactly.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          caption: {
            type: Type.STRING,
            description: 'Exactly two sentences summarizing the day mosaic without names or >5 word quotes.',
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                entryId: { type: Type.STRING },
                gameType: { type: Type.STRING, description: 'guess_prompt or whose_is_it' },
                questionText: { type: Type.STRING },
                options: { type: Type.ARRAY, items: { type: Type.STRING } },
                correctAnswer: { type: Type.STRING },
              },
              required: ['entryId', 'gameType', 'questionText', 'options', 'correctAnswer'],
            },
          },
        },
        required: ['caption', 'questions'],
      },
    },
  }));

  const parsed = JSON.parse((response.text ?? '{}').trim());
  return {
    caption: String(parsed.caption || '').trim(),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions.slice(0, 3).map((q: any) => ({
          entryId: String(q.entryId),
          gameType: q.gameType === 'whose_is_it' ? 'whose_is_it' : 'guess_prompt',
          questionText: String(q.questionText),
          options: Array.isArray(q.options) ? q.options.map(String).slice(0, 4) : [],
          correctAnswer: String(q.correctAnswer),
        }))
      : [],
  };
}

const ALLOWED_AUDIO_MIME_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/aac',
  'audio/flac',
]);

const TRANSCRIPTION_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

function isModelNotFoundOrUnsupported(err: any): boolean {
  const status = Number(err?.status || err?.code || 0);
  const msg = String(err?.message || '');
  return (
    status === 404 ||
    /NOT_FOUND|not found for API version|is not supported for generateContent/i.test(msg)
  );
}

export async function transcribeSpokenAudio(audioBase64: string, rawMimeType: string): Promise<string> {
  const cleanedBase64 = audioBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (!cleanedBase64) {
    throw new Error('Recorded audio was empty.');
  }

  let baseMime = (rawMimeType || 'audio/webm').split(';')[0].trim().toLowerCase();
  if (baseMime === 'audio/x-m4a') baseMime = 'audio/mp4';
  if (baseMime === 'audio/x-wav') baseMime = 'audio/wav';
  const mimeType = ALLOWED_AUDIO_MIME_TYPES.has(baseMime) ? baseMime : 'audio/webm';

  const ai = getAiClient();
  let lastError: unknown = null;

  for (const model of TRANSCRIPTION_MODELS) {
    const attempts = model === 'gemini-4-hydrogen' ? 1 : 2;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model,
            contents: {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: cleanedBase64,
                  },
                },
                {
                  text: 'Transcribe the spoken words from this audio recording verbatim.',
                },
              ],
            },
            config: {
              systemInstruction:
                'You are a precise speech-to-text transcriber. Return ONLY the verbatim spoken words as plain text with natural punctuation. Do not include timestamps, speaker labels, quotes, explanations, or commentary. If the clip contains only silence or unintelligible background noise, return an empty string.',
              thinkingConfig: {
                thinkingLevel: model === 'gemini-4-hydrogen' ? ThinkingLevel.LOW : ThinkingLevel.MINIMAL,
              },
            },
          }),
          15000,
        );

        return (response.text ?? '').replace(/\s+/g, ' ').trim();
      } catch (err: any) {
        lastError = err;
        if (isModelNotFoundOrUnsupported(err)) {
          break; // Try next model
        }
        if (!isTransientUpstreamError(err)) {
          throw err;
        }
        await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
      }
    }
  }

  throw lastError;
}
