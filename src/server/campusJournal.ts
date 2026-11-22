import fs from 'fs';
import path from 'path';
import type { Express } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import {
  buildCampusView,
  parseCampusCatalog,
  type CampusArea,
  type CampusCatalog,
  type CampusView,
} from '../campus/unlockState';
import {
  getCampusWanderChoice,
  listUserQuestIds,
  setCampusWanderChoice,
} from './db';
import { acceptableChildLine, asksPersonal, containsBanned } from './guideSafety';

function readCatalog(): CampusCatalog {
  const file = path.resolve(process.cwd(), 'content/area-unlocks.json');
  const parsed = parseCampusCatalog(JSON.parse(fs.readFileSync(file, 'utf8')));
  if (!parsed) throw new Error('content/area-unlocks.json is not a campus catalog.');
  return parsed;
}

async function viewFor(roomId: string, userId: string, catalog = readCatalog()): Promise<CampusView> {
  const [saved, choice] = await Promise.all([
    listUserQuestIds(roomId, userId),
    getCampusWanderChoice(roomId, userId),
  ]);
  return buildCampusView(catalog, saved, choice);
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

export async function rewriteAreaPrompt(area: CampusArea): Promise<{ prompt: string; source: 'static' | 'rewritten' }> {
  const fallback = { prompt: area.prompt, source: 'static' as const };
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  const model = (process.env.GEMINI_TEXT_MODEL || process.env.GEMINI_CHILD_MODEL || '').trim().replace(/^google\//, '');
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || !model) return fallback;
  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
    });
    const response = await withTimeout(
      ai.models.generateContent({
        model,
        contents: [
          `Rewrite this journaling prompt for a child about 5 to 12 at ${area.name}.`,
          'Keep the same noticing task. One short sentence, 18 words or fewer.',
          'Concrete and sensory. Something they can look at, draw, or write in a minute.',
          'No grades, no streaks, no personal questions, no medical words.',
          `Prompt: ${area.prompt}`,
        ].join('\n'),
        config: {
          temperature: 0.4,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: { prompt: { type: Type.STRING } },
            required: ['prompt'],
          },
        },
      }),
      2000,
    );
    const parsed = JSON.parse((response.text || '{}').trim());
    const prompt = String(parsed.prompt || '').replace(/\s+/g, ' ').trim();
    if (!acceptableChildLine(prompt, 18) || asksPersonal(prompt) || containsBanned(prompt)) return fallback;
    return { prompt, source: 'rewritten' };
  } catch {
    return fallback;
  }
}

export function mountCampusJournalRoutes(app: Express): void {
  app.get('/api/campus/unlocks', async (req, res) => {
    try {
      const roomId = String(req.query.roomId || '').trim();
      const userId = String(req.query.userId || '').trim();
      if (!roomId || !userId) {
        res.status(400).json({ error: 'Room and alias are required.' });
        return;
      }
      const view = await viewFor(roomId, userId);
      res.json(view);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not read campus areas.' });
    }
  });

  app.get('/api/campus/prompt', async (req, res) => {
    try {
      const areaId = String(req.query.areaId || '').trim();
      const catalog = readCatalog();
      const area = catalog.areas.find((item) => item.id === areaId) || catalog.areas[0];
      const result = await rewriteAreaPrompt(area);
      res.json(result);
    } catch {
      res.json({ prompt: 'Draw the quietest thing you can see.', source: 'static' });
    }
  });

  app.post('/api/campus/wander', async (req, res) => {
    try {
      const roomId = String(req.body?.roomId || '').trim();
      const userId = String(req.body?.userId || '').trim();
      const placeId = String(req.body?.placeId || '').trim();
      if (!roomId || !userId || !placeId) {
        res.status(400).json({ error: 'Room, alias, and a place are required.' });
        return;
      }
      const catalog = readCatalog();
      const place = catalog.nextPlaces.find((item) => item.id === placeId);
      if (!place) {
        res.status(404).json({ error: 'That wander is not on the list.' });
        return;
      }
      const current = await viewFor(roomId, userId, catalog);
      if (!current.allAreasOpen) {
        res.status(409).json({ error: 'The campus still has a place to open first.' });
        return;
      }
      await setCampusWanderChoice(roomId, userId, place.id);
      const view = await viewFor(roomId, userId, catalog);
      res.json(view);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not keep that wander.' });
    }
  });
}
