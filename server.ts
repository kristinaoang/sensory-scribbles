import crypto from 'crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';
import { animalReply, drawWriteIdeas, wordQuestPrompt } from './src/mastra/childGuide';
import { runMastraNightlyWorkflow } from './src/mastra/nightlyWorkflow';
import {
  claimAdminPassword,
  createRoom,
  createUser,
  ensureActiveQuestForRoom,
  getAllEntriesForGuessGame,
  getAllEntriesForRoom,
  getAllPrompts,
  getAllRooms,
  getAvailableDatesForRoom,
  getCanvasStrokesForRoom,
  getDailyRoomEntryCounts,
  getEntriesForDateAllRooms,
  getEntriesForRoomAndDate,
  getMinigameQuestionsForRoom,
  getNightlyCaption,
  getPromptForDate,
  getRoomByCode,
  getRoomById,
  getRoomByInviteCode,
  getRoomProgression,
  getHelpUsageForUser,
  getUserById,
  getUserRoomStreak,
  getUserWeeklyMinigameAccuracy,
  hasUserSubmittedOnDate,
  incrementQuestProgress,
  initDatabase,
  insertCanvasStroke,
  insertEntry,
  isAdminConfigured,
  isPostgresMode,
  recordMinigameEvent,
  setEntryFlagged,
  tagCreationQuest,
  updateEntrySolanaAnchor,
  updateRoomSolana,
  upsertPrompt,
  verifyAdminPassword,
} from './src/server/db';
import {
  deriveSensoryWorldSpec,
  formatGeminiErrorMessage,
  moderateSentence,
  transcribeSpokenAudio,
} from './src/server/gemini';
import { mountCampusJournalRoutes } from './src/server/campusJournal';
import { mountGuideRoutes } from './src/server/guideRoutes';
import { seedCanvasStrokesIfEmpty, seedDemoDataIfEmpty, seedQuestsIfEmpty } from './src/server/seed';
import { anchorEntryToSolanaDevnet, getSolanaConfigStatus } from './src/server/solana';
import type { StrokeData } from './src/types';

dotenv.config();

const PORT = 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function signAdminToken(): string {
  const payload = Buffer.from(
    JSON.stringify({ role: 'admin', exp: Date.now() + 1000 * 60 * 60 * 8 }),
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const auth = req.headers.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  next();
}

function sanitizeStroke(raw: any): StrokeData | null {
  if (!raw || !Array.isArray(raw.points) || raw.points.length < 2 || raw.points.length > 500) {
    return null;
  }
  const points = raw.points
    .map((p: any) => ({
      x: Number(p?.x),
      y: Number(p?.y),
    }))
    .filter((p: any) => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  if (points.length < 2) return null;
  const color = typeof raw.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.color) ? raw.color : '#2E7D5B';
  const width = Math.min(12, Math.max(2, Number(raw.width) || 4));
  return { points, color, width, paletteName: typeof raw.paletteName === 'string' ? raw.paletteName.slice(0, 32) : undefined };
}

async function startServer() {
  await initDatabase();
  await seedDemoDataIfEmpty(false);
  await seedCanvasStrokesIfEmpty();
  await seedQuestsIfEmpty();

  const app = express();
  const httpServer = http.createServer(app);
  app.use('/api/transcribe', express.json({ limit: '4mb' }));
  app.use(express.json({ limit: '256kb' }));

  // Live Collaborative Canvas WebSocket Server (server-authoritative room state)
  interface CanvasClientMeta {
    ws: WebSocket;
    roomId: string;
    userId: string;
    displayName: string;
    avatarColor: string;
  }
  const roomClients = new Map<string, Set<CanvasClientMeta>>();

  const broadcastToRoom = (roomId: string, payload: unknown, excludeWs?: WebSocket) => {
    const clients = roomClients.get(roomId);
    if (!clients) return;
    const msg = JSON.stringify(payload);
    for (const c of clients) {
      if (c.ws !== excludeWs && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(msg);
      }
    }
  };

  const broadcastPresence = (roomId: string) => {
    const clients = roomClients.get(roomId);
    if (!clients) return;
    const uniqueUsers = new Map<string, { userId: string; displayName: string; avatarColor: string }>();
    for (const c of clients) {
      uniqueUsers.set(c.userId, {
        userId: c.userId,
        displayName: c.displayName,
        avatarColor: c.avatarColor,
      });
    }
    broadcastToRoom(roomId, {
      type: 'presence:update',
      users: Array.from(uniqueUsers.values()),
    });
  };

  const wss = new WebSocketServer({ noServer: true });
  httpServer.on('upgrade', (req, socket, head) => {
    try {
      const reqUrl = new URL(req.url || '/', 'http://localhost');
      if (reqUrl.pathname === '/ws/canvas') {
        wss.handleUpgrade(req, socket, head, (ws) => {
          wss.emit('connection', ws, req);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    try {
      const url = new URL(req.url || '/ws/canvas', 'http://localhost');
      const roomCode = (url.searchParams.get('roomCode') || 'CEDAR-402').trim().toUpperCase();
      const userId = (url.searchParams.get('userId') || `guest_${crypto.randomUUID().slice(0, 6)}`).slice(0, 40);
      const displayName = (url.searchParams.get('displayName') || 'quiet-guest').slice(0, 28);
      const avatarColor = /^#[0-9a-fA-F]{6}$/.test(url.searchParams.get('avatarColor') || '')
        ? url.searchParams.get('avatarColor')!
        : '#2E7D5B';

      const room = await getRoomByInviteCode(roomCode);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', error: 'Room not found.' }));
        ws.close();
        return;
      }

      const meta: CanvasClientMeta = { ws, roomId: room.id, userId, displayName, avatarColor };
      if (!roomClients.has(room.id)) roomClients.set(room.id, new Set());
      roomClients.get(room.id)!.add(meta);

      const strokes = await getCanvasStrokesForRoom(room.id);
      ws.send(JSON.stringify({ type: 'canvas:init', roomId: room.id, strokes }));
      broadcastPresence(room.id);

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.type === 'cursor:move') {
            const x = Number(msg.x);
            const y = Number(msg.y);
            if (Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1) {
              broadcastToRoom(
                room.id,
                {
                  type: 'cursor:moved',
                  userId,
                  displayName,
                  avatarColor,
                  x,
                  y,
                },
                ws,
              );
            }
          }
        } catch {
          // Ignore malformed frame
        }
      });

      ws.on('close', () => {
        roomClients.get(room.id)?.delete(meta);
        broadcastPresence(room.id);
      });
    } catch {
      ws.close();
    }
  });

  // Health & config status (safe, zero secrets)
  app.get('/api/health', async (_req, res) => {
    res.json({
      ok: true,
      database: isPostgresMode() ? 'timescaledb' : 'sqlite-local',
      solana: await getSolanaConfigStatus(),
      childGuide: Boolean(process.env.GEMINI_CHILD_MODEL && process.env.GEMINI_SAFETY_MODEL),
    });
  });

  app.post('/api/child/quest-prompt', async (req, res) => {
    const place = typeof req.body?.place === 'string' ? req.body.place : undefined;
    const result = await wordQuestPrompt(place);
    res.json({ prompt: result.text, source: result.source });
  });

  app.post('/api/child/draw-ideas', async (req, res) => {
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
    const result = await drawWriteIdeas(prompt);
    res.json({ ideas: result.ideas, source: result.source });
  });

  app.post('/api/child/animal-reply', async (req, res) => {
    const animal = typeof req.body?.animal === 'string' ? req.body.animal : undefined;
    const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
    const result = await animalReply(animal, note);
    res.json({ reply: result.reply, safe: result.safe, source: result.source });
  });

  // Voice-to-text transcription for spoken prompt answers (server-side Gemini 3.5 Transcribe)
  app.post('/api/transcribe', async (req, res) => {
    try {
      const audioBase64 = typeof req.body?.audioBase64 === 'string' ? req.body.audioBase64 : '';
      const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType : 'audio/webm';

      if (!audioBase64.trim()) {
        res.status(400).json({ error: 'Audio recording data is required.' });
        return;
      }
      if (audioBase64.length > 3_500_000) {
        res.status(413).json({ error: 'Audio clip is too long. Please keep answers under 30 seconds.' });
        return;
      }

      const transcript = await transcribeSpokenAudio(audioBase64, mimeType);
      res.json({ transcript });
    } catch (err: any) {
      const status = Number(err?.status || err?.code || 502);
      res.status(status >= 400 && status < 600 ? status : 502).json({
        error: formatGeminiErrorMessage(
          err,
          'Voice transcription is temporarily unavailable. Check GEMINI_API_KEY in Settings > Secrets or type your answer instead.',
        ),
      });
    }
  });

  // Rooms
  app.get('/api/rooms', async (_req, res) => {
    try {
      const rooms = await getAllRooms();
      res.json({ rooms });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to list rooms.' });
    }
  });

  // Create a brand new room and return its auto-generated unique invite code
  app.post('/api/rooms/create', async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();
      const rawCode = String(req.body?.code || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const solanaEnabled = Boolean(req.body?.solanaEnabled);

      if (!name || name.length < 2 || name.length > 48) {
        res.status(400).json({ error: 'Room name must be 2–48 characters.' });
        return;
      }

      const generatedSlug =
        rawCode.length >= 3
          ? rawCode.slice(0, 20)
          : `${name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'ROOM'}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

      const existing = await getRoomByCode(generatedSlug);
      const finalCode = existing
        ? `${generatedSlug.slice(0, 14)}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`
        : generatedSlug;

      const room = await createRoom(finalCode, name, solanaEnabled);
      res.status(201).json({ room });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to create room.' });
    }
  });

  // Join an existing room by entering a valid invite code (or room code)
  app.post('/api/rooms/join', async (req, res) => {
    try {
      const inputCode = String(req.body?.inviteCode || req.body?.code || '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '');
      const name = String(req.body?.name || '').trim();
      const createIfMissing = Boolean(req.body?.createIfMissing);

      if (!inputCode || inputCode.length < 3 || inputCode.length > 24) {
        res.status(400).json({ error: 'Please enter a valid invite code (3–24 characters).' });
        return;
      }

      let room = await getRoomByInviteCode(inputCode);
      if (!room) {
        if (!createIfMissing) {
          res.status(404).json({ error: `Invite code "${inputCode}" is invalid or does not match an existing room.` });
          return;
        }
        room = await createRoom(inputCode, name || `Room ${inputCode}`, false);
      }
      res.json({ room });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to join room.' });
    }
  });

  // Anonymous users (no real names or emails required)
  app.post('/api/users', async (req, res) => {
    try {
      const existingId = typeof req.body?.id === 'string' ? req.body.id : undefined;
      if (existingId) {
        const found = await getUserById(existingId);
        if (found && !req.body?.update) {
          res.json({ user: found });
          return;
        }
      }
      const displayName = String(req.body?.displayName || '').trim() || 'quiet-sprout';
      const avatarColor = String(req.body?.avatarColor || '#2E7D5B');
      const user = await createUser(displayName, avatarColor, existingId);
      res.json({ user });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save anonymous identity.' });
    }
  });

  // Mosaic & daily prompt view
  app.get('/api/mosaic', async (req, res) => {
    try {
      const roomCode = String(req.query.roomCode || 'CEDAR-402').trim().toUpperCase();
      const targetDate = String(req.query.date || todayIso()).slice(0, 10);
      const userId = typeof req.query.userId === 'string' ? req.query.userId : '';

      const room = await getRoomByCode(roomCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }

      const [prompt, entries, caption, availableDates, userSubmittedToday, progression] = await Promise.all([
        getPromptForDate(targetDate),
        getEntriesForRoomAndDate(room.id, targetDate, false),
        getNightlyCaption(room.id, targetDate),
        getAvailableDatesForRoom(room.id),
        userId ? hasUserSubmittedOnDate(room.id, userId, todayIso()) : Promise.resolve(false),
        getRoomProgression(room.id),
      ]);

      res.json({
        room,
        date: targetDate,
        prompt,
        entries,
        caption,
        availableDates: Array.from(new Set([todayIso(), ...availableDates])).sort().reverse(),
        userSubmittedToday,
        progression,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load mosaic.' });
    }
  });

  // Full 3D World state (accumulated room landmarks + shared strokes + progression quests)
  app.get('/api/world', async (req, res) => {
    try {
      const roomCode = String(req.query.roomCode || 'CEDAR-402').trim().toUpperCase();
      const userId = typeof req.query.userId === 'string' ? req.query.userId : '';
      const today = todayIso();

      const room = await getRoomByInviteCode(roomCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }

      const [prompt, entries, todayEntries, strokes, progression, userSubmittedToday] = await Promise.all([
        getPromptForDate(today),
        getAllEntriesForRoom(room.id, 36),
        getEntriesForRoomAndDate(room.id, today, false),
        getCanvasStrokesForRoom(room.id),
        getRoomProgression(room.id),
        userId ? hasUserSubmittedOnDate(room.id, userId, today) : Promise.resolve(false),
      ]);

      res.json({
        room,
        todayDate: today,
        prompt,
        entries,
        todayEntries,
        strokes,
        progression,
        userSubmittedToday,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load 3D world state.' });
    }
  });

  // Answer a chapter Question Prompt to add a 3D landmark & advance world progression
  app.post('/api/world/answer', async (req, res) => {
    try {
      const roomId = String(req.body?.roomId || '');
      const userId = String(req.body?.userId || '');
      const sentence = String(req.body?.sentence || '').trim();
      const strokeJson = sanitizeStroke(req.body?.strokeJson);
      const entryDate = todayIso();

      if (!roomId || !userId) {
        res.status(400).json({ error: 'Room and anonymous profile are required.' });
        return;
      }
      if (!sentence || sentence.length > 140) {
        res.status(400).json({ error: 'Answer must be between 1 and 140 characters.' });
        return;
      }
      if (!strokeJson) {
        res.status(400).json({ error: 'Please draw one continuous stroke for your reflection.' });
        return;
      }

      const room = await getRoomById(roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }
      let user = await getUserById(userId);
      if (!user) {
        user = await createUser(String(req.body?.displayName || 'quiet-guest'), String(req.body?.avatarColor || strokeJson.color), userId);
      }

      let prompt = await getPromptForDate(entryDate);
      if (!prompt) {
        prompt = await upsertPrompt(
          entryDate,
          'If your day were a room, what would be inside it?',
          'everyday rooms',
        );
      }

      let moderation;
      try {
        moderation = await moderateSentence(sentence);
      } catch (modErr: any) {
        res.status(503).json({
          error: formatGeminiErrorMessage(
            modErr,
            'Gemini moderation service unavailable. Check GEMINI_API_KEY in Settings > Secrets.',
          ),
        });
        return;
      }

      const worldSpec = deriveSensoryWorldSpec(sentence, strokeJson.color);
      if (!moderation.allowed) {
        res.status(422).json({
          flagged: true,
          category: moderation.category,
          reason: moderation.reason,
        });
        return;
      }

      const created = await insertEntry({
        id: `wq_${crypto.randomUUID().slice(0, 10)}`,
        roomId: room.id,
        userId: user.id,
        promptId: prompt.id,
        entryDate,
        sentence,
        strokeJson,
        worldSpec,
        flagged: false,
        moderationReason: null,
        isDemo: false,
      });

      const activeQuestBefore = await ensureActiveQuestForRoom(room.id);

      const createdCanvasStroke = await insertCanvasStroke({
        roomId: room.id,
        userId: user.id,
        reflection: sentence,
        strokeJson,
        worldSpec,
        chapterNumber: activeQuestBefore.chapterNumber,
        flagged: false,
        isDemo: false,
        createdAt: created.createdAt,
      });

      const questId = String(req.body?.questId || '');
      if (questId) {
        await tagCreationQuest(created.id, createdCanvasStroke?.id ?? null, questId);
        created.questId = questId;
      }

      const { progression, justExpanded } = await incrementQuestProgress(room.id, { answers: 1, strokes: 1 });
      const enrichedEntry = {
        ...created,
        authorDisplayName: user.displayName,
        authorAvatarColor: user.avatarColor,
        promptText: prompt.text,
      };

      broadcastToRoom(room.id, { type: 'stroke:created', stroke: createdCanvasStroke });
      broadcastToRoom(room.id, {
        type: 'world:progressed',
        progression,
        justExpanded,
        entry: enrichedEntry,
        stroke: createdCanvasStroke,
      });

      res.status(201).json({
        entry: enrichedEntry,
        canvasStroke: createdCanvasStroke,
        progression,
        justExpanded,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to submit prompt answer.' });
    }
  });

  // Submit daily sentence + continuous stroke (moderated by Gemini before visible)
  app.post('/api/entries', async (req, res) => {
    try {
      const roomId = String(req.body?.roomId || '');
      const userId = String(req.body?.userId || '');
      const sentence = String(req.body?.sentence || '').trim();
      const strokeJson = sanitizeStroke(req.body?.strokeJson);
      const entryDate = todayIso();

      if (!roomId || !userId) {
        res.status(400).json({ error: 'Room and anonymous profile are required.' });
        return;
      }
      if (!sentence || sentence.length > 140) {
        res.status(400).json({ error: 'Sentence must be between 1 and 140 characters.' });
        return;
      }
      if (!strokeJson) {
        res.status(400).json({ error: 'Please draw one continuous stroke on the canvas.' });
        return;
      }

      const room = await getRoomById(roomId);
      const user = await getUserById(userId);
      if (!room || !user) {
        res.status(404).json({ error: 'Room or user profile not found.' });
        return;
      }

      const already = await hasUserSubmittedOnDate(room.id, user.id, entryDate);
      if (already) {
        res.status(409).json({ error: 'You already shared your reflection in this room today. Come back tomorrow!' });
        return;
      }

      let prompt = await getPromptForDate(entryDate);
      if (!prompt) {
        prompt = await upsertPrompt(
          entryDate,
          'If your day were a room, what would be inside it?',
          'everyday rooms',
        );
      }

      // Milestone 5: Gemini moderation before visible
      let moderation;
      try {
        moderation = await moderateSentence(sentence);
      } catch (modErr: any) {
        res.status(503).json({
          error: formatGeminiErrorMessage(
            modErr,
            'Gemini moderation service unavailable. Check GEMINI_API_KEY in Settings > Secrets.',
          ),
        });
        return;
      }

      const worldSpec = deriveSensoryWorldSpec(sentence, strokeJson.color);

      if (!moderation.allowed) {
        await insertEntry({
          roomId: room.id,
          userId: user.id,
          promptId: prompt.id,
          entryDate,
          sentence,
          strokeJson,
          worldSpec,
          flagged: true,
          moderationReason: moderation.reason,
          isDemo: false,
        });
        res.status(422).json({
          flagged: true,
          category: moderation.category,
          reason: moderation.reason,
        });
        return;
      }

      const created = await insertEntry({
        roomId: room.id,
        userId: user.id,
        promptId: prompt.id,
        entryDate,
        sentence,
        strokeJson,
        worldSpec,
        flagged: false,
        moderationReason: null,
        isDemo: false,
      });

      const questId = String(req.body?.questId || '');
      if (questId) {
        await tagCreationQuest(created.id, null, questId);
        created.questId = questId;
      }

      // Milestone 10: Opt-in server-sponsored Solana Devnet anchor (hash + timestamp only)
      let solanaResult = null;
      if (room.solanaEnabled) {
        solanaResult = await anchorEntryToSolanaDevnet(created.id, created.createdAt);
        if (solanaResult.entryHash) {
          await updateEntrySolanaAnchor(
            created.id,
            solanaResult.txSignature || 'hash-prepared',
            solanaResult.entryHash,
          );
          created.solanaHash = solanaResult.entryHash;
          created.solanaTx = solanaResult.txSignature || 'hash-prepared';
        }
      }

      // Also publish to the live Shared Reflection Canvas when requested (default true)
      const activeQuestBefore = await ensureActiveQuestForRoom(room.id);
      let createdCanvasStroke = null;
      if (req.body?.publishToCanvas !== false) {
        createdCanvasStroke = await insertCanvasStroke({
          roomId: room.id,
          userId: user.id,
          reflection: sentence,
          strokeJson,
          worldSpec,
          chapterNumber: activeQuestBefore.chapterNumber,
          flagged: false,
          isDemo: false,
          createdAt: created.createdAt,
        });
        broadcastToRoom(room.id, { type: 'stroke:created', stroke: createdCanvasStroke });
        if (questId && createdCanvasStroke) {
          await tagCreationQuest(created.id, createdCanvasStroke.id, questId);
        }
      }

      // Advance unified progression quest for answering & drawing on the shared canvas
      const { progression, justExpanded } = await incrementQuestProgress(room.id, {
        answers: 1,
        strokes: req.body?.publishToCanvas !== false ? 1 : 0,
      });

      const enrichedEntry = {
        ...created,
        authorDisplayName: user.displayName,
        authorAvatarColor: user.avatarColor,
        promptText: prompt.text,
      };

      broadcastToRoom(room.id, {
        type: 'world:progressed',
        progression,
        justExpanded,
        entry: enrichedEntry,
        stroke: createdCanvasStroke || undefined,
      });

      res.status(201).json({
        entry: enrichedEntry,
        canvasStroke: createdCanvasStroke,
        solana: solanaResult,
        progression,
        justExpanded,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to submit entry.' });
    }
  });

  // Minigame data & event recording
  app.get('/api/minigames/deck', async (req, res) => {
    try {
      const roomCode = String(req.query.roomCode || 'CEDAR-402').trim().toUpperCase();
      const room = await getRoomByCode(roomCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }
      const [entries, prompts, storedQuestions] = await Promise.all([
        getAllEntriesForGuessGame(room.id),
        getAllPrompts(),
        getMinigameQuestionsForRoom(room.id),
      ]);
      res.json({ entries, prompts, storedQuestions });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load minigame deck.' });
    }
  });

  app.post('/api/minigames/events', async (req, res) => {
    try {
      const userId = String(req.body?.userId || '');
      const entryId = String(req.body?.entryId || '');
      const gameType = req.body?.gameType === 'whose_is_it' ? 'whose_is_it' : 'guess_prompt';
      const correct = Boolean(req.body?.correct);

      if (!userId || !entryId) {
        res.status(400).json({ error: 'userId and entryId are required.' });
        return;
      }

      const ev = await recordMinigameEvent({ userId, entryId, gameType, correct });
      res.status(201).json({ event: ev });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to record minigame result.' });
    }
  });

  // Milestone 8: Stats page (weekly minigame accuracy + daily room counts via time_bucket)
  app.get('/api/stats', async (req, res) => {
    try {
      const userId = String(req.query.userId || '');
      const roomCode = String(req.query.roomCode || 'CEDAR-402').trim().toUpperCase();
      const room = await getRoomByCode(roomCode);
      const [weeklyAccuracy, dailyRoomCounts, streak, helpUsage] = await Promise.all([
        userId ? getUserWeeklyMinigameAccuracy(userId) : Promise.resolve([]),
        room ? getDailyRoomEntryCounts(room.id) : Promise.resolve([]),
        userId && room ? getUserRoomStreak(userId, room.id) : Promise.resolve(null),
        userId ? getHelpUsageForUser(userId) : Promise.resolve(null),
      ]);
      res.json({
        weeklyAccuracy,
        dailyRoomCounts,
        streak,
        helpUsage,
        databaseEngine: isPostgresMode() ? 'TimescaleDB time_bucket() continuous aggregates' : 'SQLite local time_bucket() view',
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load stats.' });
    }
  });

  // Admin auth status, first-run claim, login
  app.get('/api/admin/status', async (_req, res) => {
    const configured = await isAdminConfigured();
    const envManaged = Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0);
    res.json({ configured, envManaged });
  });

  app.post('/api/admin/claim', async (req, res) => {
    try {
      const password = String(req.body?.password || '');
      if (password.length < 6) {
        res.status(400).json({ error: 'Choose an admin password with at least 6 characters.' });
        return;
      }
      const claimed = await claimAdminPassword(password);
      if (!claimed) {
        res.status(409).json({ error: 'Admin password is already configured.' });
        return;
      }
      res.json({ token: signAdminToken() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to claim admin password.' });
    }
  });

  app.post('/api/admin/login', async (req, res) => {
    try {
      const password = String(req.body?.password || '');
      const valid = await verifyAdminPassword(password);
      if (!valid) {
        res.status(401).json({ error: 'Incorrect admin password.' });
        return;
      }
      res.json({ token: signAdminToken() });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Login failed.' });
    }
  });

  // Protected /admin endpoints (bot-friendly, stable schema)
  app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
    try {
      const targetDate = String(req.query.date || todayIso()).slice(0, 10);
      const [todayEntries, prompts, rooms, tomorrowPrompt] = await Promise.all([
        getEntriesForDateAllRooms(targetDate),
        getAllPrompts(),
        getAllRooms(),
        getPromptForDate(tomorrowIso()),
      ]);
      res.json({
        todayDate: targetDate,
        tomorrowDate: tomorrowIso(),
        todayEntries,
        prompts,
        rooms,
        tomorrowPrompt,
        solanaStatus: await getSolanaConfigStatus(),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load admin dashboard.' });
    }
  });

  app.post('/api/admin/flag', requireAdmin, async (req, res) => {
    try {
      const entryId = String(req.body?.entryId || '');
      const flagged = Boolean(req.body?.flagged);
      const reason = typeof req.body?.reason === 'string' ? req.body.reason : flagged ? 'Flagged by room admin' : null;
      const updated = await setEntryFlagged(entryId, flagged, reason);
      if (!updated) {
        res.status(404).json({ error: 'Entry not found.' });
        return;
      }
      res.json({ entry: updated });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to update entry flag.' });
    }
  });

  app.post('/api/admin/prompt', requireAdmin, async (req, res) => {
    try {
      const promptDate = String(req.body?.promptDate || tomorrowIso()).slice(0, 10);
      const text = String(req.body?.text || '').trim();
      const sensoryFocus = String(req.body?.sensoryFocus || 'tactile').trim().slice(0, 40);
      if (!text || text.length < 10) {
        res.status(400).json({ error: 'Prompt text must be at least 10 characters.' });
        return;
      }
      const prompt = await upsertPrompt(promptDate, text, sensoryFocus);
      res.json({ prompt });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to save prompt.' });
    }
  });

  app.post('/api/admin/room-solana', requireAdmin, async (req, res) => {
    try {
      const roomId = String(req.body?.roomId || '');
      const solanaEnabled = Boolean(req.body?.solanaEnabled);
      const room = await updateRoomSolana(roomId, solanaEnabled);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }
      res.json({ room });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to toggle Solana anchor setting.' });
    }
  });

  // Milestone 7: Mastra nightly workflow trigger
  app.post('/api/admin/workflow/nightly', requireAdmin, async (req, res) => {
    try {
      const roomId = String(req.body?.roomId || '');
      const date = String(req.body?.date || todayIso()).slice(0, 10);
      if (!roomId) {
        res.status(400).json({ error: 'roomId is required.' });
        return;
      }
      const report = await runMastraNightlyWorkflow(roomId, date);
      res.status(report.ok ? 200 : 422).json(report);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Nightly workflow error.' });
    }
  });

  // Shared Collaborative Reflection Canvas endpoints
  app.get('/api/canvas-strokes', async (req, res) => {
    try {
      const roomCode = String(req.query.roomCode || 'CEDAR-402').trim().toUpperCase();
      const room = await getRoomByInviteCode(roomCode);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }
      const [strokes, progression] = await Promise.all([
        getCanvasStrokesForRoom(room.id),
        getRoomProgression(room.id),
      ]);
      res.json({ room, strokes, progression });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to load shared canvas strokes.' });
    }
  });

  app.post('/api/canvas-strokes', async (req, res) => {
    try {
      const roomId = String(req.body?.roomId || '');
      const userId = String(req.body?.userId || '');
      const reflection = String(req.body?.reflection || '').trim();
      const strokeJson = sanitizeStroke(req.body?.strokeJson);

      if (!roomId || !userId) {
        res.status(400).json({ error: 'Room and alias are required.' });
        return;
      }
      if (!reflection || reflection.length > 140) {
        res.status(400).json({ error: 'Journal reflection must be 1–140 characters.' });
        return;
      }
      if (!strokeJson) {
        res.status(400).json({ error: 'Draw one continuous stroke on the shared canvas.' });
        return;
      }

      const room = await getRoomById(roomId);
      if (!room) {
        res.status(404).json({ error: 'Room not found.' });
        return;
      }

      // Ensure user exists (allows anyone who joins to immediately draw)
      let user = await getUserById(userId);
      if (!user) {
        user = await createUser(String(req.body?.displayName || 'quiet-guest'), String(req.body?.avatarColor || strokeJson.color), userId);
      }

      let moderation;
      try {
        moderation = await moderateSentence(reflection);
      } catch (modErr: any) {
        res.status(503).json({
          error: formatGeminiErrorMessage(
            modErr,
            'Gemini moderation service unavailable. Check GEMINI_API_KEY in Settings > Secrets.',
          ),
        });
        return;
      }

      const worldSpec = deriveSensoryWorldSpec(reflection, strokeJson.color);
      if (!moderation.allowed) {
        await insertCanvasStroke({
          roomId: room.id,
          userId: user.id,
          reflection,
          strokeJson,
          worldSpec,
          flagged: true,
          isDemo: false,
        });
        res.status(422).json({
          flagged: true,
          category: moderation.category,
          reason: moderation.reason,
        });
        return;
      }

      const activeQuestBefore = await ensureActiveQuestForRoom(room.id);
      const entryDate = todayIso();
      let prompt = await getPromptForDate(entryDate);
      if (!prompt) {
        prompt = await upsertPrompt(
          entryDate,
          activeQuestBefore.questionPrompt,
          'everyday reflection',
        );
      }

      const createdEntry = await insertEntry({
        id: `cs_ent_${crypto.randomUUID().slice(0, 10)}`,
        roomId: room.id,
        userId: user.id,
        promptId: prompt.id,
        entryDate,
        sentence: reflection,
        strokeJson,
        worldSpec,
        flagged: false,
        moderationReason: null,
        isDemo: false,
      });

      const created = await insertCanvasStroke({
        roomId: room.id,
        userId: user.id,
        reflection,
        strokeJson,
        worldSpec,
        chapterNumber: activeQuestBefore.chapterNumber,
        flagged: false,
        isDemo: false,
        createdAt: createdEntry.createdAt,
      });

      const { progression, justExpanded } = await incrementQuestProgress(room.id, { answers: 1, strokes: 1 });
      const enrichedEntry = {
        ...createdEntry,
        authorDisplayName: user.displayName,
        authorAvatarColor: user.avatarColor,
        promptText: activeQuestBefore.questionPrompt,
      };

      broadcastToRoom(room.id, { type: 'stroke:created', stroke: created });
      broadcastToRoom(room.id, {
        type: 'world:progressed',
        progression,
        justExpanded,
        entry: enrichedEntry,
        stroke: created,
      });

      res.status(201).json({ stroke: created, entry: enrichedEntry, progression, justExpanded });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to publish stroke to shared canvas.' });
    }
  });

  mountGuideRoutes(app);
  mountCampusJournalRoutes(app);
  const guideCors = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const origin = String(req.headers.origin || '');
    if (/^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    next();
  };
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  app.use('/content', guideCors, express.static(path.join(serverDir, 'content')));
  app.use('/campus-guide', guideCors, express.static(path.join(serverDir, 'public', 'campus-guide')));
  app.use('/audio', guideCors, express.static(path.join(serverDir, 'public', 'audio')));

  // Vite dev middleware or static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output missing. Run npm run build.');
      }
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Sensory Scribbles server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
