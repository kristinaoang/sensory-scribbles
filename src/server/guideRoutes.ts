import type { Express, Request, Response } from 'express';
import { recordGuideEvent } from './db';
import { animalReply, listQuestPrompts, refreshQuestWordings, suggestIdeas } from './guideAi';

const animalBuckets = new Map<string, { start: number; count: number }>();
let refreshAt = 0;

function guideCors(req: Request, res: Response): boolean {
  const origin = String(req.headers.origin || '');
  if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-SS-Guide-Simulate-Failure');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

function loopback(req: Request): boolean {
  const ip = req.socket.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function simulate(req: Request): boolean {
  return loopback(req) && req.get('x-ss-guide-simulate-failure') === '1';
}

function allowAnimal(sessionId: string): boolean {
  const now = Date.now();
  const bucket = animalBuckets.get(sessionId);
  if (!bucket || now - bucket.start > 10 * 60 * 1000) {
    animalBuckets.set(sessionId, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= 8) return false;
  bucket.count += 1;
  return true;
}

function cleanId(value: unknown, max = 80): string {
  return String(value || '').trim().slice(0, max);
}

export function mountGuideRoutes(app: Express): void {
  app.use('/api/animal', (req, res, next) => {
    if (!guideCors(req, res)) next();
  });
  app.use('/api/help', (req, res, next) => {
    if (!guideCors(req, res)) next();
  });
  app.use('/api/guide', (req, res, next) => {
    if (!guideCors(req, res)) next();
  });

  app.post('/api/animal', async (req, res) => {
    const sessionId = cleanId(req.body?.sessionId, 80);
    const kind = cleanId(req.body?.kind, 24) || 'animal';
    const limited = !sessionId || !allowAnimal(sessionId);
    const result = await animalReply({
      kind,
      name: cleanId(req.body?.name, 40) || `the ${kind}`,
      text: limited ? '' : cleanId(req.body?.text, 80),
      simulateFailure: simulate(req) || limited,
    });
    const userId = cleanId(req.body?.userId, 80);
    if (userId) {
      await recordGuideEvent({
        userId,
        roomId: cleanId(req.body?.roomId, 80) || null,
        eventType: 'animal_interaction',
        detail: kind.replace(/[^a-z]/gi, '').toLowerCase().slice(0, 24) || 'animal',
      });
    }
    res.json({ reply: result.reply, suggestDraw: result.suggestDraw, fallback: result.fallback });
  });

  app.post('/api/help/ideas', async (req, res) => {
    const questId = cleanId(req.body?.questId, 48);
    const result = await suggestIdeas({ questId, simulateFailure: simulate(req) });
    res.json({ ideas: result.ideas, fallback: result.fallback });
  });

  app.get('/api/guide/quests', async (_req, res) => {
    const quests = await listQuestPrompts();
    res.json({ quests });
  });

  app.post('/api/guide/quests/refresh', async (req, res) => {
    if (simulate(req)) {
      res.json({ updated: 0, fallback: true });
      return;
    }
    const now = Date.now();
    if (now - refreshAt < 10 * 60 * 1000) {
      res.json({ updated: 0, fallback: true });
      return;
    }
    refreshAt = now;
    const result = await refreshQuestWordings();
    res.json({ ...result, fallback: result.updated === 0 });
  });

  app.post('/api/guide/events', async (req, res) => {
    const eventType = req.body?.eventType === 'animal_interaction' ? 'animal_interaction' : 'help_used';
    const helpType = String(req.body?.helpType || '').trim();
    const detail =
      eventType === 'help_used'
        ? helpType === 'where' || helpType === 'ideas' || helpType === 'read'
          ? helpType
          : 'help'
        : cleanId(req.body?.detail, 24).replace(/[^a-z]/gi, '').toLowerCase().slice(0, 24) || 'animal';
    const userId = cleanId(req.body?.userId, 80);
    if (userId) {
      const event = await recordGuideEvent({
        userId,
        roomId: cleanId(req.body?.roomId, 80) || null,
        eventType,
        detail,
      });
      res.status(201).json({ ok: true, id: event.id });
      return;
    }
    res.status(201).json({ ok: true, id: null });
  });
}
