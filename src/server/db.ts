import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import type {
  AnonymousUser,
  CanvasStroke,
  DailyRoomCountBucket,
  JournalEntry,
  MinigameEvent,
  MinigameQuestion,
  NightlyCaption,
  Prompt,
  Room,
  RoomQuest,
  SensoryWorldSpec,
  StrokeData,
  TamedAnimalRecord,
  WeeklyAccuracyBucket,
  WildAnimalSpecies,
  WorldProgressionState,
} from '../types';

const USE_POSTGRES = Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);

let pgPool: Pool | null = null;
let sqliteDb: Database.Database | null = null;

function getSqlite(): Database.Database {
  if (!sqliteDb) {
    const dbPath = path.resolve(process.cwd(), 'sensory_scribbles.db');
    sqliteDb = new Database(dbPath);
    sqliteDb.pragma('journal_mode = WAL');
    sqliteDb.pragma('foreign_keys = ON');
  }
  return sqliteDb;
}

function getPg(): Pool {
  if (!pgPool) {
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
    });
  }
  return pgPool;
}

export function isPostgresMode(): boolean {
  return USE_POSTGRES;
}

export async function initDatabase(): Promise<void> {
  if (USE_POSTGRES) {
    const pool = getPg();
    const schemaPath = path.resolve(process.cwd(), 'db/timescale_schema.sql');
    if (fs.existsSync(schemaPath)) {
      const sql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(sql);
    }
    await pool.query('ALTER TABLE canvas_strokes ADD COLUMN IF NOT EXISTS chapter_number INTEGER NOT NULL DEFAULT 1');
    await pool.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS affection_points INTEGER NOT NULL DEFAULT 0');
    return;
  }

  const db = getSqlite();
  db.exec(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      invite_code TEXT UNIQUE,
      name TEXT NOT NULL,
      solana_enabled INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      avatar_color TEXT NOT NULL,
      affection_points INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      prompt_date TEXT UNIQUE NOT NULL,
      text TEXT NOT NULL,
      sensory_focus TEXT NOT NULL DEFAULT 'tactile',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entries (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      prompt_id TEXT NOT NULL REFERENCES prompts(id),
      entry_date TEXT NOT NULL,
      sentence TEXT NOT NULL,
      stroke_json TEXT NOT NULL,
      world_spec TEXT NOT NULL,
      created_at TEXT NOT NULL,
      flagged INTEGER NOT NULL DEFAULT 0,
      moderation_reason TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      solana_tx TEXT,
      solana_hash TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_entries_room_date ON entries(room_id, entry_date, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries(user_id, entry_date);

    CREATE TABLE IF NOT EXISTS minigame_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      entry_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      correct INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_minigame_user_time ON minigame_events(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS nightly_captions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      caption_date TEXT NOT NULL,
      caption TEXT NOT NULL,
      entry_count INTEGER NOT NULL,
      validated INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      UNIQUE(room_id, caption_date)
    );

    CREATE TABLE IF NOT EXISTS minigame_questions (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      entry_id TEXT NOT NULL,
      question_date TEXT NOT NULL,
      game_type TEXT NOT NULL,
      question_text TEXT NOT NULL,
      options_json TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS canvas_strokes (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      reflection TEXT NOT NULL,
      stroke_json TEXT NOT NULL,
      world_spec TEXT NOT NULL,
      chapter_number INTEGER NOT NULL DEFAULT 1,
      flagged INTEGER NOT NULL DEFAULT 0,
      is_demo INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_canvas_strokes_room ON canvas_strokes(room_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS room_quests (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      chapter_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      question_prompt TEXT NOT NULL,
      drawing_prompt TEXT NOT NULL,
      target_answers INTEGER NOT NULL DEFAULT 1,
      target_strokes INTEGER NOT NULL DEFAULT 2,
      current_answers INTEGER NOT NULL DEFAULT 0,
      current_strokes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      unlocked_biome TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_room_quests_room ON room_quests(room_id, chapter_number ASC);

    CREATE TABLE IF NOT EXISTS tamed_animals (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      animal_key TEXT NOT NULL,
      species TEXT NOT NULL,
      nickname TEXT NOT NULL,
      description TEXT NOT NULL,
      tamed_by_user_id TEXT NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      UNIQUE(room_id, animal_key)
    );

    CREATE INDEX IF NOT EXISTS idx_tamed_animals_room ON tamed_animals(room_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS animal_affections (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL REFERENCES rooms(id),
      animal_key TEXT NOT NULL,
      affection INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      UNIQUE(room_id, animal_key)
    );

    CREATE INDEX IF NOT EXISTS idx_animal_affections_room ON animal_affections(room_id);
  `);

  // Safe migration for existing local rooms table if invite_code column was added later
  const cols = db.prepare("PRAGMA table_info('rooms')").all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'invite_code')) {
    db.exec('ALTER TABLE rooms ADD COLUMN invite_code TEXT');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_invite_code ON rooms(invite_code)');
  }
  const missingInviteRooms = db.prepare("SELECT id FROM rooms WHERE invite_code IS NULL OR invite_code = ''").all() as Array<{ id: string }>;
  for (const r of missingInviteRooms) {
    db.prepare('UPDATE rooms SET invite_code = ? WHERE id = ?').run(generateInviteCode(), r.id);
  }

  // Safe migration for existing local canvas_strokes table if chapter_number column was added later
  const strokeCols = db.prepare("PRAGMA table_info('canvas_strokes')").all() as Array<{ name: string }>;
  if (!strokeCols.some((c) => c.name === 'chapter_number')) {
    db.exec('ALTER TABLE canvas_strokes ADD COLUMN chapter_number INTEGER NOT NULL DEFAULT 1');
  }

  // Safe migration for existing local users table if affection_points column was added later
  const userCols = db.prepare("PRAGMA table_info('users')").all() as Array<{ name: string }>;
  if (!userCols.some((c) => c.name === 'affection_points')) {
    db.exec('ALTER TABLE users ADD COLUMN affection_points INTEGER NOT NULL DEFAULT 0');
  }
}

function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  const bytes = crypto.randomBytes(6);
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  return `SS-${suffix}`;
}

function mapRoom(row: any): Room {
  return {
    id: row.id,
    code: row.code,
    inviteCode: row.invite_code || `SS-${String(row.code || 'ROOM').slice(0, 6)}`,
    name: row.name,
    solanaEnabled: Boolean(row.solana_enabled),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapUser(row: any): AnonymousUser {
  return {
    id: row.id,
    displayName: row.display_name,
    avatarColor: row.avatar_color,
    affectionPoints: Math.max(0, Number(row.affection_points ?? 0)),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapPrompt(row: any): Prompt {
  return {
    id: row.id,
    promptDate: typeof row.prompt_date === 'string' ? row.prompt_date.slice(0, 10) : new Date(row.prompt_date).toISOString().slice(0, 10),
    text: row.text,
    sensoryFocus: row.sensory_focus || 'tactile',
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function mapEntry(row: any): JournalEntry {
  const strokeJson: StrokeData = typeof row.stroke_json === 'string' ? JSON.parse(row.stroke_json) : row.stroke_json;
  const worldSpec: SensoryWorldSpec = typeof row.world_spec === 'string' ? JSON.parse(row.world_spec) : row.world_spec;
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    promptId: row.prompt_id,
    sentence: row.sentence,
    strokeJson,
    worldSpec,
    createdAt: new Date(row.created_at).toISOString(),
    entryDate: typeof row.entry_date === 'string' ? row.entry_date.slice(0, 10) : new Date(row.entry_date).toISOString().slice(0, 10),
    flagged: Boolean(row.flagged),
    moderationReason: row.moderation_reason ?? null,
    isDemo: Boolean(row.is_demo),
    solanaTx: row.solana_tx ?? null,
    solanaHash: row.solana_hash ?? null,
    authorDisplayName: row.author_display_name ?? undefined,
    authorAvatarColor: row.author_avatar_color ?? undefined,
    promptText: row.prompt_text ?? undefined,
  };
}

export async function getAllRooms(): Promise<Room[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM rooms ORDER BY created_at ASC');
    return rows.map(mapRoom);
  }
  const rows = getSqlite().prepare('SELECT * FROM rooms ORDER BY created_at ASC').all();
  return rows.map(mapRoom);
}

export async function getRoomByCode(code: string): Promise<Room | null> {
  const normalized = code.trim().toUpperCase();
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM rooms WHERE UPPER(code) = $1', [normalized]);
    return rows[0] ? mapRoom(rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM rooms WHERE UPPER(code) = ?').get(normalized);
  return row ? mapRoom(row) : null;
}

export async function getRoomByInviteCode(inviteCode: string): Promise<Room | null> {
  const normalized = inviteCode.trim().toUpperCase();
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM rooms WHERE UPPER(invite_code) = $1 OR UPPER(code) = $1 LIMIT 1', [normalized]);
    return rows[0] ? mapRoom(rows[0]) : null;
  }
  const row = getSqlite()
    .prepare('SELECT * FROM rooms WHERE UPPER(invite_code) = ? OR UPPER(code) = ? LIMIT 1')
    .get(normalized, normalized);
  return row ? mapRoom(row) : null;
}

export async function getRoomById(id: string): Promise<Room | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM rooms WHERE id = $1', [id]);
    return rows[0] ? mapRoom(rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  return row ? mapRoom(row) : null;
}

export async function createRoom(code: string, name: string, solanaEnabled = false, explicitInviteCode?: string): Promise<Room> {
  const id = `room_${crypto.randomUUID().slice(0, 8)}`;
  const normalized = code.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '') || `ROOM-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const now = new Date().toISOString();

  // Guarantee unique invite code
  let inviteCode = explicitInviteCode?.trim().toUpperCase() || generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const conflict = await getRoomByInviteCode(inviteCode);
    if (!conflict) break;
    inviteCode = generateInviteCode();
  }

  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'INSERT INTO rooms (id, code, invite_code, name, solana_enabled, created_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [id, normalized, inviteCode, name.trim(), solanaEnabled, now],
    );
    return mapRoom(rows[0]);
  }
  getSqlite()
    .prepare('INSERT INTO rooms (id, code, invite_code, name, solana_enabled, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(id, normalized, inviteCode, name.trim(), solanaEnabled ? 1 : 0, now);
  return { id, code: normalized, inviteCode, name: name.trim(), solanaEnabled, createdAt: now };
}

export async function updateRoomSolana(roomId: string, solanaEnabled: boolean): Promise<Room | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'UPDATE rooms SET solana_enabled = $1 WHERE id = $2 RETURNING *',
      [solanaEnabled, roomId],
    );
    return rows[0] ? mapRoom(rows[0]) : null;
  }
  getSqlite().prepare('UPDATE rooms SET solana_enabled = ? WHERE id = ?').run(solanaEnabled ? 1 : 0, roomId);
  return getRoomById(roomId);
}

export async function getUserById(id: string): Promise<AnonymousUser | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] ? mapUser(rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? mapUser(row) : null;
}

export async function createUser(displayName: string, avatarColor: string, explicitId?: string): Promise<AnonymousUser> {
  const id = explicitId || `usr_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  const cleanName = displayName.trim().slice(0, 28) || 'quiet-sprout';
  const cleanColor = /^#[0-9a-fA-F]{6}$/.test(avatarColor) ? avatarColor : '#2E7D5B';
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'INSERT INTO users (id, display_name, avatar_color, created_at) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name, avatar_color = EXCLUDED.avatar_color RETURNING *',
      [id, cleanName, cleanColor, now],
    );
    return mapUser(rows[0]);
  }
  getSqlite()
    .prepare(
      'INSERT INTO users (id, display_name, avatar_color, affection_points, created_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name, avatar_color = excluded.avatar_color',
    )
    .run(id, cleanName, cleanColor, now);
  const saved = await getUserById(id);
  return saved ?? { id, displayName: cleanName, avatarColor: cleanColor, affectionPoints: 0, createdAt: now };
}

export async function getPromptForDate(promptDate: string): Promise<Prompt | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM prompts WHERE prompt_date = $1::date', [promptDate]);
    return rows[0] ? mapPrompt(rows[0]) : null;
  }
  const row = getSqlite().prepare('SELECT * FROM prompts WHERE prompt_date = ?').get(promptDate);
  return row ? mapPrompt(row) : null;
}

export async function upsertPrompt(promptDate: string, text: string, sensoryFocus = 'tactile', explicitId?: string): Promise<Prompt> {
  const id = explicitId || `prm_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `INSERT INTO prompts (id, prompt_date, text, sensory_focus, created_at)
       VALUES ($1, $2::date, $3, $4, $5)
       ON CONFLICT (prompt_date) DO UPDATE SET text = EXCLUDED.text, sensory_focus = EXCLUDED.sensory_focus
       RETURNING *`,
      [id, promptDate, text.trim(), sensoryFocus, now],
    );
    return mapPrompt(rows[0]);
  }
  getSqlite()
    .prepare(
      `INSERT INTO prompts (id, prompt_date, text, sensory_focus, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(prompt_date) DO UPDATE SET text = excluded.text, sensory_focus = excluded.sensory_focus`,
    )
    .run(id, promptDate, text.trim(), sensoryFocus, now);
  const saved = await getPromptForDate(promptDate);
  return saved!;
}

export async function getAllPrompts(): Promise<Prompt[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT * FROM prompts ORDER BY prompt_date DESC');
    return rows.map(mapPrompt);
  }
  const rows = getSqlite().prepare('SELECT * FROM prompts ORDER BY prompt_date DESC').all();
  return rows.map(mapPrompt);
}

export async function hasUserSubmittedOnDate(roomId: string, userId: string, entryDate: string): Promise<boolean> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      "SELECT 1 FROM entries WHERE room_id = $1 AND user_id = $2 AND entry_date = $3::date AND id NOT LIKE 'wq_%' LIMIT 1",
      [roomId, userId, entryDate],
    );
    return rows.length > 0;
  }
  const row = getSqlite()
    .prepare("SELECT 1 FROM entries WHERE room_id = ? AND user_id = ? AND entry_date = ? AND id NOT LIKE 'wq_%' LIMIT 1")
    .get(roomId, userId, entryDate);
  return Boolean(row);
}

export async function insertEntry(params: {
  id?: string;
  roomId: string;
  userId: string;
  promptId: string;
  entryDate: string;
  sentence: string;
  strokeJson: StrokeData;
  worldSpec: SensoryWorldSpec;
  flagged: boolean;
  moderationReason?: string | null;
  isDemo?: boolean;
  solanaTx?: string | null;
  solanaHash?: string | null;
  createdAt?: string;
}): Promise<JournalEntry> {
  const id = params.id || `ent_${crypto.randomUUID().slice(0, 10)}`;
  const createdAt = params.createdAt || new Date().toISOString();
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `INSERT INTO entries (
        id, room_id, user_id, prompt_id, entry_date, sentence, stroke_json, world_spec,
        created_at, flagged, moderation_reason, is_demo, solana_tx, solana_hash
      ) VALUES ($1,$2,$3,$4,$5::date,$6,$7::jsonb,$8::jsonb,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        id,
        params.roomId,
        params.userId,
        params.promptId,
        params.entryDate,
        params.sentence,
        JSON.stringify(params.strokeJson),
        JSON.stringify(params.worldSpec),
        createdAt,
        params.flagged,
        params.moderationReason ?? null,
        Boolean(params.isDemo),
        params.solanaTx ?? null,
        params.solanaHash ?? null,
      ],
    );
    return mapEntry(rows[0]);
  }
  getSqlite()
    .prepare(
      `INSERT INTO entries (
        id, room_id, user_id, prompt_id, entry_date, sentence, stroke_json, world_spec,
        created_at, flagged, moderation_reason, is_demo, solana_tx, solana_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      params.roomId,
      params.userId,
      params.promptId,
      params.entryDate,
      params.sentence,
      JSON.stringify(params.strokeJson),
      JSON.stringify(params.worldSpec),
      createdAt,
      params.flagged ? 1 : 0,
      params.moderationReason ?? null,
      params.isDemo ? 1 : 0,
      params.solanaTx ?? null,
      params.solanaHash ?? null,
    );
  const created = await getEntryById(id);
  return created!;
}

export async function getEntryById(id: string): Promise<JournalEntry | null> {
  const sql = `
    SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
    FROM entries e
    LEFT JOIN users u ON u.id = e.user_id
    LEFT JOIN prompts p ON p.id = e.prompt_id
    WHERE e.id = $PLACEHOLDER
    LIMIT 1
  `;
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(sql.replace('$PLACEHOLDER', '$1'), [id]);
    return rows[0] ? mapEntry(rows[0]) : null;
  }
  const row = getSqlite().prepare(sql.replace('$PLACEHOLDER', '?')).get(id);
  return row ? mapEntry(row) : null;
}

export async function getEntriesForRoomAndDate(
  roomId: string,
  entryDate: string,
  includeFlagged = false,
): Promise<JournalEntry[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.room_id = $1 AND e.entry_date = $2::date ${includeFlagged ? '' : 'AND e.flagged = FALSE'}
       ORDER BY e.created_at DESC`,
      [roomId, entryDate],
    );
    return rows.map(mapEntry);
  }
  const rows = getSqlite()
    .prepare(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.room_id = ? AND e.entry_date = ? ${includeFlagged ? '' : 'AND e.flagged = 0'}
       ORDER BY e.created_at DESC`,
    )
    .all(roomId, entryDate);
  return rows.map(mapEntry);
}

export async function getEntriesForDateAllRooms(entryDate: string): Promise<JournalEntry[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.entry_date = $1::date
       ORDER BY e.created_at DESC`,
      [entryDate],
    );
    return rows.map(mapEntry);
  }
  const rows = getSqlite()
    .prepare(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.entry_date = ?
       ORDER BY e.created_at DESC`,
    )
    .all(entryDate);
  return rows.map(mapEntry);
}

export async function getAvailableDatesForRoom(roomId: string): Promise<string[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT DISTINCT to_char(entry_date, 'YYYY-MM-DD') AS d FROM entries WHERE room_id = $1 AND flagged = FALSE ORDER BY d DESC`,
      [roomId],
    );
    return rows.map((r) => r.d);
  }
  const rows = getSqlite()
    .prepare('SELECT DISTINCT entry_date AS d FROM entries WHERE room_id = ? AND flagged = 0 ORDER BY d DESC')
    .all(roomId) as Array<{ d: string }>;
  return rows.map((r) => r.d);
}

export async function setEntryFlagged(entryId: string, flagged: boolean, reason?: string | null): Promise<JournalEntry | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'UPDATE entries SET flagged = $1, moderation_reason = $2 WHERE id = $3 RETURNING id',
      [flagged, reason ?? null, entryId],
    );
    return rows[0] ? getEntryById(entryId) : null;
  }
  getSqlite()
    .prepare('UPDATE entries SET flagged = ?, moderation_reason = ? WHERE id = ?')
    .run(flagged ? 1 : 0, reason ?? null, entryId);
  return getEntryById(entryId);
}

export async function updateEntrySolanaAnchor(entryId: string, solanaTx: string, solanaHash: string): Promise<void> {
  if (USE_POSTGRES) {
    await getPg().query('UPDATE entries SET solana_tx = $1, solana_hash = $2 WHERE id = $3', [
      solanaTx,
      solanaHash,
      entryId,
    ]);
    return;
  }
  getSqlite()
    .prepare('UPDATE entries SET solana_tx = ?, solana_hash = ? WHERE id = ?')
    .run(solanaTx, solanaHash, entryId);
}

export async function getNightlyCaption(roomId: string, captionDate: string): Promise<NightlyCaption | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'SELECT * FROM nightly_captions WHERE room_id = $1 AND caption_date = $2::date LIMIT 1',
      [roomId, captionDate],
    );
    if (!rows[0]) return null;
    const r = rows[0];
    return {
      id: r.id,
      roomId: r.room_id,
      captionDate: typeof r.caption_date === 'string' ? r.caption_date.slice(0, 10) : new Date(r.caption_date).toISOString().slice(0, 10),
      caption: r.caption,
      entryCount: Number(r.entry_count),
      validated: Boolean(r.validated),
      createdAt: new Date(r.created_at).toISOString(),
    };
  }
  const r: any = getSqlite()
    .prepare('SELECT * FROM nightly_captions WHERE room_id = ? AND caption_date = ? LIMIT 1')
    .get(roomId, captionDate);
  if (!r) return null;
  return {
    id: r.id,
    roomId: r.room_id,
    captionDate: r.caption_date,
    caption: r.caption,
    entryCount: Number(r.entry_count),
    validated: Boolean(r.validated),
    createdAt: r.created_at,
  };
}

export async function upsertNightlyCaption(params: {
  roomId: string;
  captionDate: string;
  caption: string;
  entryCount: number;
  validated: boolean;
}): Promise<NightlyCaption> {
  const id = `cap_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  if (USE_POSTGRES) {
    await getPg().query(
      `INSERT INTO nightly_captions (id, room_id, caption_date, caption, entry_count, validated, created_at)
       VALUES ($1, $2, $3::date, $4, $5, $6, $7)
       ON CONFLICT (room_id, caption_date) DO UPDATE SET caption = EXCLUDED.caption, entry_count = EXCLUDED.entry_count, validated = EXCLUDED.validated, created_at = EXCLUDED.created_at`,
      [id, params.roomId, params.captionDate, params.caption, params.entryCount, params.validated, now],
    );
  } else {
    getSqlite()
      .prepare(
        `INSERT INTO nightly_captions (id, room_id, caption_date, caption, entry_count, validated, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(room_id, caption_date) DO UPDATE SET caption = excluded.caption, entry_count = excluded.entry_count, validated = excluded.validated, created_at = excluded.created_at`,
      )
      .run(id, params.roomId, params.captionDate, params.caption, params.entryCount, params.validated ? 1 : 0, now);
  }
  return (await getNightlyCaption(params.roomId, params.captionDate))!;
}

export async function saveMinigameQuestions(questions: Array<Omit<MinigameQuestion, 'id' | 'createdAt'>>): Promise<MinigameQuestion[]> {
  const saved: MinigameQuestion[] = [];
  const now = new Date().toISOString();
  for (const q of questions) {
    const id = `mq_${crypto.randomUUID().slice(0, 8)}`;
    if (USE_POSTGRES) {
      await getPg().query(
        `INSERT INTO minigame_questions (id, room_id, entry_id, question_date, game_type, question_text, options_json, correct_answer, is_demo, created_at)
         VALUES ($1,$2,$3,$4::date,$5,$6,$7::jsonb,$8,$9,$10)`,
        [id, q.roomId, q.entryId, q.questionDate, q.gameType, q.questionText, JSON.stringify(q.options), q.correctAnswer, q.isDemo, now],
      );
    } else {
      getSqlite()
        .prepare(
          `INSERT INTO minigame_questions (id, room_id, entry_id, question_date, game_type, question_text, options_json, correct_answer, is_demo, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, q.roomId, q.entryId, q.questionDate, q.gameType, q.questionText, JSON.stringify(q.options), q.correctAnswer, q.isDemo ? 1 : 0, now);
    }
    saved.push({ ...q, id, createdAt: now });
  }
  return saved;
}

export async function getMinigameQuestionsForRoom(roomId: string, questionDate?: string): Promise<MinigameQuestion[]> {
  if (USE_POSTGRES) {
    const { rows } = questionDate
      ? await getPg().query(
          'SELECT * FROM minigame_questions WHERE room_id = $1 AND question_date = $2::date ORDER BY created_at DESC LIMIT 12',
          [roomId, questionDate],
        )
      : await getPg().query(
          'SELECT * FROM minigame_questions WHERE room_id = $1 ORDER BY created_at DESC LIMIT 12',
          [roomId],
        );
    return rows.map((r) => ({
      id: r.id,
      roomId: r.room_id,
      entryId: r.entry_id,
      questionDate: typeof r.question_date === 'string' ? r.question_date.slice(0, 10) : new Date(r.question_date).toISOString().slice(0, 10),
      gameType: r.game_type,
      questionText: r.question_text,
      options: typeof r.options_json === 'string' ? JSON.parse(r.options_json) : r.options_json,
      correctAnswer: r.correct_answer,
      isDemo: Boolean(r.is_demo),
      createdAt: new Date(r.created_at).toISOString(),
    }));
  }
  const rows = questionDate
    ? getSqlite()
        .prepare('SELECT * FROM minigame_questions WHERE room_id = ? AND question_date = ? ORDER BY created_at DESC LIMIT 12')
        .all(roomId, questionDate)
    : getSqlite().prepare('SELECT * FROM minigame_questions WHERE room_id = ? ORDER BY created_at DESC LIMIT 12').all(roomId);
  return rows.map((r: any) => ({
    id: r.id,
    roomId: r.room_id,
    entryId: r.entry_id,
    questionDate: r.question_date,
    gameType: r.game_type,
    questionText: r.question_text,
    options: JSON.parse(r.options_json),
    correctAnswer: r.correct_answer,
    isDemo: Boolean(r.is_demo),
    createdAt: r.created_at,
  }));
}

export async function recordMinigameEvent(params: {
  userId: string;
  entryId: string;
  gameType: 'guess_prompt' | 'whose_is_it';
  correct: boolean;
  createdAt?: string;
}): Promise<MinigameEvent> {
  const id = `mge_${crypto.randomUUID().slice(0, 10)}`;
  const createdAt = params.createdAt || new Date().toISOString();
  if (USE_POSTGRES) {
    await getPg().query(
      'INSERT INTO minigame_events (id, user_id, entry_id, game_type, correct, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, params.userId, params.entryId, params.gameType, params.correct, createdAt],
    );
  } else {
    getSqlite()
      .prepare('INSERT INTO minigame_events (id, user_id, entry_id, game_type, correct, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, params.userId, params.entryId, params.gameType, params.correct ? 1 : 0, createdAt);
  }
  return { id, ...params, createdAt };
}

/**
 * Milestone 8: Stats query using continuous aggregate / time_bucket('7 days', created_at)
 */
export async function getUserWeeklyMinigameAccuracy(userId: string): Promise<WeeklyAccuracyBucket[]> {
  if (USE_POSTGRES) {
    // Query continuous aggregate or direct time_bucket if continuous aggregate hasn't materialized recent minute yet
    const { rows } = await getPg().query(
      `SELECT
         to_char(time_bucket('7 days', created_at), 'YYYY-MM-DD') AS week_start,
         COUNT(*)::INTEGER AS total_attempts,
         SUM(CASE WHEN correct THEN 1 ELSE 0 END)::INTEGER AS correct_count
       FROM minigame_events
       WHERE user_id = $1
       GROUP BY time_bucket('7 days', created_at)
       ORDER BY time_bucket('7 days', created_at) ASC`,
      [userId],
    );
    return rows.map((r) => {
      const total = Number(r.total_attempts);
      const correct = Number(r.correct_count);
      return {
        weekStart: r.week_start,
        totalAttempts: total,
        correctCount: correct,
        accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });
  }

  // SQLite equivalent of 7-day time_bucket()
  const rows = getSqlite()
    .prepare(
      `SELECT
         date(created_at, 'weekday 0', '-6 days') AS week_start,
         COUNT(*) AS total_attempts,
         SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct_count
       FROM minigame_events
       WHERE user_id = ?
       GROUP BY week_start
       ORDER BY week_start ASC`,
    )
    .all(userId) as Array<{ week_start: string; total_attempts: number; correct_count: number }>;

  return rows.map((r) => {
    const total = Number(r.total_attempts);
    const correct = Number(r.correct_count);
    return {
      weekStart: r.week_start,
      totalAttempts: total,
      correctCount: correct,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : 0,
    };
  });
}

export async function getDailyRoomEntryCounts(roomId: string): Promise<DailyRoomCountBucket[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT
         to_char(time_bucket('1 day', created_at), 'YYYY-MM-DD') AS day,
         room_id,
         COUNT(*)::INTEGER AS entry_count
       FROM entries
       WHERE room_id = $1 AND flagged = FALSE
       GROUP BY time_bucket('1 day', created_at), room_id
       ORDER BY day DESC
       LIMIT 14`,
      [roomId],
    );
    return rows.map((r) => ({
      day: r.day,
      roomId: r.room_id,
      entryCount: Number(r.entry_count),
    }));
  }
  const rows = getSqlite()
    .prepare(
      `SELECT entry_date AS day, room_id, COUNT(*) AS entry_count
       FROM entries
       WHERE room_id = ? AND flagged = 0
       GROUP BY entry_date, room_id
       ORDER BY entry_date DESC
       LIMIT 14`,
    )
    .all(roomId) as Array<{ day: string; room_id: string; entry_count: number }>;
  return rows.map((r) => ({ day: r.day, roomId: r.room_id, entryCount: Number(r.entry_count) }));
}

function addDaysIso(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export async function getUserRoomStreak(userId: string, roomId: string): Promise<import('../types').UserRoomStreak> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = addDaysIso(today, -1);

  let distinctDates: string[] = [];
  if (userId && roomId) {
    if (USE_POSTGRES) {
      const { rows } = await getPg().query(
        `SELECT DISTINCT day FROM (
           SELECT to_char(entry_date, 'YYYY-MM-DD') AS day
           FROM entries
           WHERE user_id = $1 AND room_id = $2 AND flagged = FALSE
           UNION
           SELECT to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day
           FROM canvas_strokes
           WHERE user_id = $1 AND room_id = $2 AND flagged = FALSE
         ) d
         ORDER BY day DESC`,
        [userId, roomId],
      );
      distinctDates = rows.map((r) => String(r.day).slice(0, 10)).filter(Boolean);
    } else {
      const rows = getSqlite()
        .prepare(
          `SELECT DISTINCT day FROM (
             SELECT entry_date AS day
             FROM entries
             WHERE user_id = ? AND room_id = ? AND flagged = 0
             UNION
             SELECT substr(created_at, 1, 10) AS day
             FROM canvas_strokes
             WHERE user_id = ? AND room_id = ? AND flagged = 0
           )
           ORDER BY day DESC`,
        )
        .all(userId, roomId, userId, roomId) as Array<{ day: string }>;
      distinctDates = rows.map((r) => String(r.day).slice(0, 10)).filter(Boolean);
    }
  }

  const dateSet = new Set(distinctDates);
  const contributedToday = dateSet.has(today);

  // Current streak: consecutive days ending today (or yesterday if today isn't logged yet)
  let currentStreak = 0;
  let cursor = contributedToday ? today : dateSet.has(yesterday) ? yesterday : '';
  while (cursor && dateSet.has(cursor)) {
    currentStreak += 1;
    cursor = addDaysIso(cursor, -1);
  }

  // Longest consecutive run across user's contribution dates in this room
  let longestStreak = 0;
  const ascDates = Array.from(dateSet).sort();
  let run = 0;
  let prevDate = '';
  for (const d of ascDates) {
    if (prevDate && addDaysIso(prevDate, 1) === d) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longestStreak) longestStreak = run;
    prevDate = d;
  }

  // Last 7 days (oldest -> today) for tactile check-in strip
  const recentDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDaysIso(today, i - 6);
    return { date, active: dateSet.has(date) };
  });

  return {
    currentStreak,
    longestStreak,
    totalActiveDays: dateSet.size,
    contributedToday,
    lastContributionDate: distinctDates[0] ?? null,
    recentDays,
  };
}

export async function getAllEntriesForGuessGame(roomId: string): Promise<JournalEntry[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.room_id = $1 AND e.flagged = FALSE
       ORDER BY e.created_at DESC
       LIMIT 50`,
      [roomId],
    );
    return rows.map(mapEntry);
  }
  const rows = getSqlite()
    .prepare(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.room_id = ? AND e.flagged = 0
       ORDER BY e.created_at DESC
       LIMIT 50`,
    )
    .all(roomId);
  return rows.map(mapEntry);
}

// Admin password helpers (scrypt salted hash stored in admin_config when ADMIN_PASSWORD env var is unset)
function hashSecret(password: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return `${actualSalt}:${derived}`;
}

function verifySecret(password: string, storedHash: string): boolean {
  const [salt, hashHex] = storedHash.split(':');
  if (!salt || !hashHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(hashHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export async function getAdminPasswordHash(): Promise<string | null> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query("SELECT value FROM admin_config WHERE key = 'admin_password_hash'");
    return rows[0]?.value ?? null;
  }
  const row: any = getSqlite().prepare("SELECT value FROM admin_config WHERE key = 'admin_password_hash'").get();
  return row?.value ?? null;
}

export async function isAdminConfigured(): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0) {
    return true;
  }
  const hash = await getAdminPasswordHash();
  return Boolean(hash);
}

export async function claimAdminPassword(password: string): Promise<boolean> {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length > 0) {
    return false;
  }
  const existing = await getAdminPasswordHash();
  if (existing) return false;
  const hash = hashSecret(password);
  const now = new Date().toISOString();
  if (USE_POSTGRES) {
    await getPg().query(
      "INSERT INTO admin_config (key, value, updated_at) VALUES ('admin_password_hash', $1, $2) ON CONFLICT (key) DO NOTHING",
      [hash, now],
    );
  } else {
    getSqlite()
      .prepare("INSERT OR IGNORE INTO admin_config (key, value, updated_at) VALUES ('admin_password_hash', ?, ?)")
      .run(hash, now);
  }
  return true;
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass && envPass.length > 0) {
    const a = Buffer.from(password);
    const b = Buffer.from(envPass);
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  }
  const storedHash = await getAdminPasswordHash();
  if (!storedHash) return false;
  return verifySecret(password, storedHash);
}

function mapCanvasStroke(row: any): CanvasStroke {
  return {
    id: row.id,
    roomId: row.room_id,
    userId: row.user_id,
    authorDisplayName: row.author_display_name || 'quiet-sprout',
    authorAvatarColor: row.author_avatar_color || '#2E7D5B',
    reflection: row.reflection,
    strokeJson: typeof row.stroke_json === 'string' ? JSON.parse(row.stroke_json) : row.stroke_json,
    worldSpec: typeof row.world_spec === 'string' ? JSON.parse(row.world_spec) : row.world_spec,
    chapterNumber: Number(row.chapter_number || 1),
    flagged: Boolean(row.flagged),
    isDemo: Boolean(row.is_demo),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

export async function getCanvasStrokesForRoom(roomId: string): Promise<CanvasStroke[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT c.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color
       FROM canvas_strokes c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.room_id = $1 AND c.flagged = FALSE
       ORDER BY c.created_at ASC
       LIMIT 150`,
      [roomId],
    );
    return rows.map(mapCanvasStroke);
  }
  const rows = getSqlite()
    .prepare(
      `SELECT c.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color
       FROM canvas_strokes c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.room_id = ? AND c.flagged = 0
       ORDER BY c.created_at ASC
       LIMIT 150`,
    )
    .all(roomId);
  return rows.map(mapCanvasStroke);
}

export async function insertCanvasStroke(params: {
  id?: string;
  roomId: string;
  userId: string;
  reflection: string;
  strokeJson: StrokeData;
  worldSpec: SensoryWorldSpec;
  chapterNumber?: number;
  flagged: boolean;
  isDemo?: boolean;
  createdAt?: string;
}): Promise<CanvasStroke> {
  const id = params.id || `cs_${crypto.randomUUID().slice(0, 10)}`;
  const createdAt = params.createdAt || new Date().toISOString();
  const chapterNumber = Math.max(1, Math.round(params.chapterNumber ?? 1));
  if (USE_POSTGRES) {
    await getPg().query(
      `INSERT INTO canvas_strokes (id, room_id, user_id, reflection, stroke_json, world_spec, chapter_number, flagged, is_demo, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10)`,
      [
        id,
        params.roomId,
        params.userId,
        params.reflection,
        JSON.stringify(params.strokeJson),
        JSON.stringify(params.worldSpec),
        chapterNumber,
        params.flagged,
        Boolean(params.isDemo),
        createdAt,
      ],
    );
    const { rows } = await getPg().query(
      `SELECT c.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color
       FROM canvas_strokes c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = $1 LIMIT 1`,
      [id],
    );
    return mapCanvasStroke(rows[0]);
  }
  getSqlite()
    .prepare(
      `INSERT INTO canvas_strokes (id, room_id, user_id, reflection, stroke_json, world_spec, chapter_number, flagged, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      params.roomId,
      params.userId,
      params.reflection,
      JSON.stringify(params.strokeJson),
      JSON.stringify(params.worldSpec),
      chapterNumber,
      params.flagged ? 1 : 0,
      params.isDemo ? 1 : 0,
      createdAt,
    );
  const row = getSqlite()
    .prepare(
      `SELECT c.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color
       FROM canvas_strokes c LEFT JOIN users u ON u.id = c.user_id WHERE c.id = ? LIMIT 1`,
    )
    .get(id);
  return mapCanvasStroke(row);
}

export async function upsertDemoCanvasStroke(params: {
  id: string;
  roomId: string;
  userId: string;
  reflection: string;
  strokeJson: StrokeData;
  worldSpec: SensoryWorldSpec;
  chapterNumber?: number;
  createdAt?: string;
}): Promise<void> {
  const createdAt = params.createdAt || new Date().toISOString();
  const chapterNumber = Math.max(1, Math.round(params.chapterNumber ?? 1));
  if (USE_POSTGRES) {
    await getPg().query(
      `INSERT INTO canvas_strokes (id, room_id, user_id, reflection, stroke_json, world_spec, chapter_number, flagged, is_demo, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, FALSE, TRUE, $8)
       ON CONFLICT (id) DO UPDATE SET
         room_id = EXCLUDED.room_id,
         reflection = EXCLUDED.reflection,
         stroke_json = EXCLUDED.stroke_json,
         world_spec = EXCLUDED.world_spec,
         chapter_number = EXCLUDED.chapter_number`,
      [
        params.id,
        params.roomId,
        params.userId,
        params.reflection,
        JSON.stringify(params.strokeJson),
        JSON.stringify(params.worldSpec),
        chapterNumber,
        createdAt,
      ],
    );
    return;
  }
  getSqlite()
    .prepare(
      `INSERT INTO canvas_strokes (id, room_id, user_id, reflection, stroke_json, world_spec, chapter_number, flagged, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 1, ?)
       ON CONFLICT(id) DO UPDATE SET
         room_id = excluded.room_id,
         reflection = excluded.reflection,
         stroke_json = excluded.stroke_json,
         world_spec = excluded.world_spec,
         chapter_number = excluded.chapter_number`,
    )
    .run(
      params.id,
      params.roomId,
      params.userId,
      params.reflection,
      JSON.stringify(params.strokeJson),
      JSON.stringify(params.worldSpec),
      chapterNumber,
      createdAt,
    );
}

export async function resetDemoRoomQuestsIfUnplayed(roomId: string): Promise<boolean> {
  if (USE_POSTGRES) {
    const eRes = await getPg().query('SELECT COUNT(*)::INTEGER AS cnt FROM entries WHERE room_id = $1 AND is_demo = FALSE', [roomId]);
    const sRes = await getPg().query('SELECT COUNT(*)::INTEGER AS cnt FROM canvas_strokes WHERE room_id = $1 AND is_demo = FALSE', [roomId]);
    if (Number(eRes.rows[0]?.cnt || 0) > 0 || Number(sRes.rows[0]?.cnt || 0) > 0) return false;
    await getPg().query('DELETE FROM room_quests WHERE room_id = $1', [roomId]);
    return true;
  }
  const eRow: any = getSqlite().prepare('SELECT COUNT(*) AS cnt FROM entries WHERE room_id = ? AND is_demo = 0').get(roomId);
  const sRow: any = getSqlite().prepare('SELECT COUNT(*) AS cnt FROM canvas_strokes WHERE room_id = ? AND is_demo = 0').get(roomId);
  if (Number(eRow?.cnt || 0) > 0 || Number(sRow?.cnt || 0) > 0) return false;
  getSqlite().prepare('DELETE FROM room_quests WHERE room_id = ?').run(roomId);
  return true;
}

// Concrete Everyday Sensory Question Pool (rotates immediately after every single answer)
export const CONCRETE_QUESTION_POOL = [
  'If your day were a room, what would be inside it?',
  'Which part of your day was the most wrinkled?',
  'If your afternoon were a song, what would it be?',
  'What color was your lunch today?',
  'Was your day more like floating, sinking, drifting, or running?',
  'If today were a pair of shoes, what kind would they be?',
  'What sat closest to your left hand all afternoon?',
  'What did the sky look like the last time you checked a window?',
  'If this evening were a snack on a plate, what would it be?',
  'What was the loudest sound you heard before noon?',
  'If your morning had a front porch, what would be resting on it?',
  'Which object in your bag or pocket felt the heaviest today?',
];

export function pickNextConcreteQuestion(currentPrompt: string, seedOffset = 1): string {
  const idx = CONCRETE_QUESTION_POOL.findIndex((q) => q === currentPrompt);
  if (idx >= 0) {
    return CONCRETE_QUESTION_POOL[(idx + 1) % CONCRETE_QUESTION_POOL.length];
  }
  const candidate = CONCRETE_QUESTION_POOL[Math.abs(seedOffset) % CONCRETE_QUESTION_POOL.length];
  if (candidate === currentPrompt) {
    return CONCRETE_QUESTION_POOL[(Math.abs(seedOffset) + 1) % CONCRETE_QUESTION_POOL.length];
  }
  return candidate;
}

// Progression Chapters for Expanding the 3D World (each level unlocks a larger building or land addition)
export const WORLD_CHAPTER_TEMPLATES = [
  {
    chapterNumber: 1,
    title: 'The Great Meadow Windmill',
    questionPrompt: 'If your day were a room, what would be inside it?',
    drawingPrompt: 'A tall windmill with four turning sails on a grassy hill',
    targetAnswers: 2,
    targetStrokes: 2,
    unlockedBiome: 'great_windmill',
    stageName: 'Seed Clearing',
  },
  {
    chapterNumber: 2,
    title: 'Crystal Lake & Arched Bridge',
    questionPrompt: 'Which part of your day was the most wrinkled?',
    drawingPrompt: 'A shimmering lake with a curved wooden bridge across it',
    targetAnswers: 2,
    targetStrokes: 2,
    unlockedBiome: 'lake_and_bridge',
    stageName: 'Windmill Meadow',
  },
  {
    chapterNumber: 3,
    title: 'Botanical Greenhouse & Cottage',
    questionPrompt: 'If your afternoon were a song, what would it be?',
    drawingPrompt: 'A cozy house with a chimney, front door, and garden path',
    targetAnswers: 3,
    targetStrokes: 3,
    unlockedBiome: 'conservatory_grove',
    stageName: 'Lake & Bridge',
  },
  {
    chapterNumber: 4,
    title: 'Starlight Harbor, Pier & Lighthouse',
    questionPrompt: 'What color was your lunch today?',
    drawingPrompt: 'A little sailboat with a curved sail on gentle water ripples',
    targetAnswers: 3,
    targetStrokes: 3,
    unlockedBiome: 'starlight_harbor',
    stageName: 'Conservatory Grove',
  },
  {
    chapterNumber: 5,
    title: 'Highland Ridge & Sky Observatory',
    questionPrompt: 'Was your day more like floating, sinking, drifting, or running?',
    drawingPrompt: 'A brick lighthouse beside waves and a crescent moon',
    targetAnswers: 3,
    targetStrokes: 3,
    unlockedBiome: 'highland_observatory',
    stageName: 'Starlight Harbor',
  },
];

const EXTRA_QUESTIONS = CONCRETE_QUESTION_POOL.slice(5);

const EXTRA_DRAWINGS = [
  'A steaming teacup resting on a round saucer',
  'A friendly wooden cabin tucked under pine trees',
  'A garden watering can with sprouting seedlings',
  'A bicycle leaning against a stone garden wall',
];

const STAGE_NAMES = [
  'Seed Clearing',
  'Windmill Meadow',
  'Lake & Bridge',
  'Conservatory Grove',
  'Starlight Harbor',
  'Highland Observatory',
];

function getChapterTemplate(chapterNumber: number) {
  if (chapterNumber <= WORLD_CHAPTER_TEMPLATES.length) {
    return WORLD_CHAPTER_TEMPLATES[chapterNumber - 1];
  }
  const extraIdx = chapterNumber - WORLD_CHAPTER_TEMPLATES.length;
  return {
    chapterNumber,
    title: `Archipelago Horizon ${extraIdx + 1}`,
    questionPrompt: EXTRA_QUESTIONS[(extraIdx - 1) % EXTRA_QUESTIONS.length],
    drawingPrompt: EXTRA_DRAWINGS[(extraIdx - 1) % EXTRA_DRAWINGS.length],
    targetAnswers: 3,
    targetStrokes: 3,
    unlockedBiome: `archipelago_ring_${extraIdx + 1}`,
    stageName: `Sensory Archipelago ${extraIdx + 1}`,
  };
}

function mapRoomQuest(row: any): RoomQuest {
  return {
    id: row.id,
    roomId: row.room_id,
    chapterNumber: Number(row.chapter_number),
    title: row.title,
    questionPrompt: row.question_prompt,
    drawingPrompt: row.drawing_prompt,
    targetAnswers: Number(row.target_answers),
    targetStrokes: Number(row.target_strokes),
    currentAnswers: Number(row.current_answers),
    currentStrokes: Number(row.current_strokes),
    status: row.status === 'completed' ? 'completed' : 'active',
    unlockedBiome: row.unlocked_biome,
    createdAt: new Date(row.created_at).toISOString(),
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
  };
}

export async function getAllEntriesForRoom(roomId: string, limit = 5000): Promise<JournalEntry[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.room_id = $1 AND e.flagged = FALSE
       ORDER BY e.created_at ASC
       LIMIT $2`,
      [roomId, limit],
    );
    return rows.map(mapEntry);
  }
  const rows = getSqlite()
    .prepare(
      `SELECT e.*, u.display_name AS author_display_name, u.avatar_color AS author_avatar_color, p.text AS prompt_text
       FROM entries e
       LEFT JOIN users u ON u.id = e.user_id
       LEFT JOIN prompts p ON p.id = e.prompt_id
       WHERE e.room_id = ? AND e.flagged = 0
       ORDER BY e.created_at ASC
       LIMIT ?`,
    )
    .all(roomId, limit);
  return rows.map(mapEntry);
}

export async function getRoomQuests(roomId: string): Promise<RoomQuest[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'SELECT * FROM room_quests WHERE room_id = $1 ORDER BY chapter_number ASC',
      [roomId],
    );
    return rows.map(mapRoomQuest);
  }
  const rows = getSqlite()
    .prepare('SELECT * FROM room_quests WHERE room_id = ? ORDER BY chapter_number ASC')
    .all(roomId);
  return rows.map(mapRoomQuest);
}

export async function insertRoomQuest(params: {
  id?: string;
  roomId: string;
  chapterNumber: number;
  title: string;
  questionPrompt: string;
  drawingPrompt: string;
  targetAnswers: number;
  targetStrokes: number;
  currentAnswers?: number;
  currentStrokes?: number;
  status?: 'active' | 'completed';
  unlockedBiome: string;
  createdAt?: string;
  completedAt?: string | null;
}): Promise<RoomQuest> {
  const id = params.id || `rq_${crypto.randomUUID().slice(0, 10)}`;
  const createdAt = params.createdAt || new Date().toISOString();
  const status = params.status || 'active';
  const currentAnswers = params.currentAnswers ?? 0;
  const currentStrokes = params.currentStrokes ?? 0;
  const completedAt = params.completedAt ?? null;

  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `INSERT INTO room_quests (
        id, room_id, chapter_number, title, question_prompt, drawing_prompt,
        target_answers, target_strokes, current_answers, current_strokes,
        status, unlocked_biome, created_at, completed_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        id,
        params.roomId,
        params.chapterNumber,
        params.title,
        params.questionPrompt,
        params.drawingPrompt,
        params.targetAnswers,
        params.targetStrokes,
        currentAnswers,
        currentStrokes,
        status,
        params.unlockedBiome,
        createdAt,
        completedAt,
      ],
    );
    return mapRoomQuest(rows[0]);
  }

  getSqlite()
    .prepare(
      `INSERT INTO room_quests (
        id, room_id, chapter_number, title, question_prompt, drawing_prompt,
        target_answers, target_strokes, current_answers, current_strokes,
        status, unlocked_biome, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      params.roomId,
      params.chapterNumber,
      params.title,
      params.questionPrompt,
      params.drawingPrompt,
      params.targetAnswers,
      params.targetStrokes,
      currentAnswers,
      currentStrokes,
      status,
      params.unlockedBiome,
      createdAt,
      completedAt,
    );

  return {
    id,
    roomId: params.roomId,
    chapterNumber: params.chapterNumber,
    title: params.title,
    questionPrompt: params.questionPrompt,
    drawingPrompt: params.drawingPrompt,
    targetAnswers: params.targetAnswers,
    targetStrokes: params.targetStrokes,
    currentAnswers,
    currentStrokes,
    status,
    unlockedBiome: params.unlockedBiome,
    createdAt,
    completedAt,
  };
}

export async function ensureActiveQuestForRoom(roomId: string, avoidPrompt?: string): Promise<RoomQuest> {
  const existing = await getRoomQuests(roomId);
  const active = existing.find((q) => q.status === 'active');
  if (active) return active;

  const nextChapter = existing.length > 0 ? existing[existing.length - 1].chapterNumber + 1 : 1;
  const tpl = getChapterTemplate(nextChapter);
  const initialQuestion =
    avoidPrompt && tpl.questionPrompt === avoidPrompt
      ? pickNextConcreteQuestion(avoidPrompt, nextChapter * 3)
      : tpl.questionPrompt;
  return insertRoomQuest({
    roomId,
    chapterNumber: tpl.chapterNumber,
    title: tpl.title,
    questionPrompt: initialQuestion,
    drawingPrompt: tpl.drawingPrompt,
    targetAnswers: tpl.targetAnswers,
    targetStrokes: tpl.targetStrokes,
    currentAnswers: 0,
    currentStrokes: 0,
    status: 'active',
    unlockedBiome: tpl.unlockedBiome,
  });
}

export async function getRoomProgression(roomId: string): Promise<WorldProgressionState> {
  await ensureActiveQuestForRoom(roomId);
  const quests = await getRoomQuests(roomId);
  const completedQuests = quests.filter((q) => q.status === 'completed');
  const activeQuest = quests.find((q) => q.status === 'active') || quests[quests.length - 1];
  const level = completedQuests.length + 1;
  const stageName =
    level <= STAGE_NAMES.length ? STAGE_NAMES[level - 1] : getChapterTemplate(level).stageName;
  const unlockedBiomes = ['seed_clearing', ...completedQuests.map((q) => q.unlockedBiome)];
  const lastExpandedAt =
    completedQuests.length > 0 ? completedQuests[completedQuests.length - 1].completedAt : null;

  let totalEntries = 0;
  let totalStrokes = 0;
  if (USE_POSTGRES) {
    const eRes = await getPg().query('SELECT COUNT(*)::INTEGER AS cnt FROM entries WHERE room_id = $1 AND flagged = FALSE', [roomId]);
    const sRes = await getPg().query('SELECT COUNT(*)::INTEGER AS cnt FROM canvas_strokes WHERE room_id = $1 AND flagged = FALSE', [roomId]);
    totalEntries = Number(eRes.rows[0]?.cnt || 0);
    totalStrokes = Number(sRes.rows[0]?.cnt || 0);
  } else {
    const eRow: any = getSqlite().prepare('SELECT COUNT(*) AS cnt FROM entries WHERE room_id = ? AND flagged = 0').get(roomId);
    const sRow: any = getSqlite().prepare('SELECT COUNT(*) AS cnt FROM canvas_strokes WHERE room_id = ? AND flagged = 0').get(roomId);
    totalEntries = Number(eRow?.cnt || 0);
    totalStrokes = Number(sRow?.cnt || 0);
  }

  return {
    level,
    stageName,
    unlockedBiomes,
    activeQuest,
    completedQuests,
    totalEntries,
    totalStrokes,
    lastExpandedAt,
  };
}

export async function incrementQuestProgress(
  roomId: string,
  delta: { answers?: number; strokes?: number },
): Promise<{ progression: WorldProgressionState; justExpanded: RoomQuest | null }> {
  const active = await ensureActiveQuestForRoom(roomId);
  const answerDelta = delta.answers ?? 0;
  const nextAnswers = active.currentAnswers + answerDelta;
  const nextStrokes = active.currentStrokes + (delta.strokes ?? 0);
  const completed = nextAnswers >= active.targetAnswers && nextStrokes >= active.targetStrokes;
  const now = new Date().toISOString();

  // Immediately rotate the active question prompt whenever one question is answered
  const nextQuestionPrompt =
    !completed && answerDelta > 0
      ? pickNextConcreteQuestion(active.questionPrompt, active.chapterNumber * 7 + nextAnswers)
      : active.questionPrompt;

  if (USE_POSTGRES) {
    await getPg().query(
      `UPDATE room_quests
       SET current_answers = $1, current_strokes = $2, question_prompt = $3, status = $4, completed_at = $5
       WHERE id = $6`,
      [nextAnswers, nextStrokes, nextQuestionPrompt, completed ? 'completed' : 'active', completed ? now : null, active.id],
    );
  } else {
    getSqlite()
      .prepare(
        `UPDATE room_quests
         SET current_answers = ?, current_strokes = ?, question_prompt = ?, status = ?, completed_at = ?
         WHERE id = ?`,
      )
      .run(nextAnswers, nextStrokes, nextQuestionPrompt, completed ? 'completed' : 'active', completed ? now : null, active.id);
  }

  let justExpanded: RoomQuest | null = null;
  if (completed) {
    justExpanded = {
      ...active,
      currentAnswers: nextAnswers,
      currentStrokes: nextStrokes,
      status: 'completed',
      completedAt: now,
    };
    await ensureActiveQuestForRoom(roomId, active.questionPrompt);
  }

  const progression = await getRoomProgression(roomId);
  return { progression, justExpanded };
}

export async function syncLegacyQuestsToTemplates(): Promise<void> {
  const legacyFragments = [
    'What texture or scent makes a space',
    'Describe a sound near water or trees',
    'If dusk had a temperature and a color',
    'What small thing moving in the breeze',
    'Imagine a quiet bridge between two islands',
    'Share one sensory detail from today to anchor',
  ];
  const oldTitles = [
    'Seed Clearing & First Hearth',
    'Lantern Creek & Footbridge',
    'Starlight Pier & Harbor Cove',
    'Windmill Ridge & Tea Grove',
    'Outer Sensory Archipelago',
  ];

  const rooms = await getAllRooms();
  for (const room of rooms) {
    const quests = await getRoomQuests(room.id);
    for (const q of quests) {
      const isLegacyQuestion = legacyFragments.some((frag) => q.questionPrompt.includes(frag));
      const isOldTemplateTitle = oldTitles.includes(q.title);
      if (!isLegacyQuestion && !isOldTemplateTitle) continue;
      const tpl = getChapterTemplate(q.chapterNumber);
      const updatedQuestion = isLegacyQuestion ? tpl.questionPrompt : q.questionPrompt;
      if (USE_POSTGRES) {
        await getPg().query(
          `UPDATE room_quests
           SET title = $1, question_prompt = $2, drawing_prompt = $3, target_answers = $4, target_strokes = $5, unlocked_biome = $6
           WHERE id = $7`,
          [tpl.title, updatedQuestion, tpl.drawingPrompt, tpl.targetAnswers, tpl.targetStrokes, tpl.unlockedBiome, q.id],
        );
      } else {
        getSqlite()
          .prepare(
            `UPDATE room_quests
             SET title = ?, question_prompt = ?, drawing_prompt = ?, target_answers = ?, target_strokes = ?, unlocked_biome = ?
             WHERE id = ?`,
          )
          .run(tpl.title, updatedQuestion, tpl.drawingPrompt, tpl.targetAnswers, tpl.targetStrokes, tpl.unlockedBiome, q.id);
      }
    }
  }
}

function mapTamedAnimal(row: any): TamedAnimalRecord {
  return {
    id: row.id,
    roomId: row.room_id,
    animalKey: row.animal_key,
    species: row.species as WildAnimalSpecies,
    nickname: row.nickname,
    description: row.description,
    tamedByUserId: row.tamed_by_user_id,
    tamedByName: row.tamed_by_name ?? undefined,
    tamedAt: new Date(row.created_at).toISOString(),
  };
}

export async function getTamedAnimalsForRoom(roomId: string): Promise<TamedAnimalRecord[]> {
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      `SELECT t.*, u.display_name AS tamed_by_name
       FROM tamed_animals t
       LEFT JOIN users u ON u.id = t.tamed_by_user_id
       WHERE t.room_id = $1
       ORDER BY t.created_at ASC`,
      [roomId],
    );
    return rows.map(mapTamedAnimal);
  }
  const rows = getSqlite()
    .prepare(
      `SELECT t.*, u.display_name AS tamed_by_name
       FROM tamed_animals t
       LEFT JOIN users u ON u.id = t.tamed_by_user_id
       WHERE t.room_id = ?
       ORDER BY t.created_at ASC`,
    )
    .all(roomId);
  return rows.map(mapTamedAnimal);
}

export async function upsertTamedAnimal(params: {
  roomId: string;
  animalKey: string;
  species: WildAnimalSpecies;
  nickname: string;
  description: string;
  tamedByUserId: string;
}): Promise<TamedAnimalRecord> {
  const id = `ta_${crypto.randomUUID().slice(0, 10)}`;
  const now = new Date().toISOString();
  const cleanNickname = params.nickname.trim().slice(0, 28);
  const cleanDescription = params.description.trim().slice(0, 500);

  if (USE_POSTGRES) {
    await getPg().query(
      `INSERT INTO tamed_animals (id, room_id, animal_key, species, nickname, description, tamed_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (room_id, animal_key) DO UPDATE SET
         nickname = EXCLUDED.nickname,
         description = EXCLUDED.description,
         tamed_by_user_id = EXCLUDED.tamed_by_user_id,
         created_at = EXCLUDED.created_at`,
      [id, params.roomId, params.animalKey, params.species, cleanNickname, cleanDescription, params.tamedByUserId, now],
    );
    const { rows } = await getPg().query(
      `SELECT t.*, u.display_name AS tamed_by_name
       FROM tamed_animals t LEFT JOIN users u ON u.id = t.tamed_by_user_id
       WHERE t.room_id = $1 AND t.animal_key = $2 LIMIT 1`,
      [params.roomId, params.animalKey],
    );
    return mapTamedAnimal(rows[0]);
  }

  getSqlite()
    .prepare(
      `INSERT INTO tamed_animals (id, room_id, animal_key, species, nickname, description, tamed_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(room_id, animal_key) DO UPDATE SET
         nickname = excluded.nickname,
         description = excluded.description,
         tamed_by_user_id = excluded.tamed_by_user_id,
         created_at = excluded.created_at`,
    )
    .run(id, params.roomId, params.animalKey, params.species, cleanNickname, cleanDescription, params.tamedByUserId, now);

  const row = getSqlite()
    .prepare(
      `SELECT t.*, u.display_name AS tamed_by_name
       FROM tamed_animals t LEFT JOIN users u ON u.id = t.tamed_by_user_id
       WHERE t.room_id = ? AND t.animal_key = ? LIMIT 1`,
    )
    .get(params.roomId, params.animalKey);
  return mapTamedAnimal(row);
}

export async function addUserPoints(userId: string, delta: number): Promise<number> {
  const safeDelta = Math.max(0, Math.floor(delta));
  if (USE_POSTGRES) {
    const { rows } = await getPg().query(
      'UPDATE users SET affection_points = GREATEST(0, COALESCE(affection_points, 0) + $1) WHERE id = $2 RETURNING affection_points',
      [safeDelta, userId],
    );
    return Number(rows[0]?.affection_points ?? 0);
  }
  getSqlite()
    .prepare('UPDATE users SET affection_points = MAX(0, COALESCE(affection_points, 0) + ?) WHERE id = ?')
    .run(safeDelta, userId);
  const row = getSqlite().prepare('SELECT affection_points FROM users WHERE id = ?').get(userId) as { affection_points?: number } | undefined;
  return Number(row?.affection_points ?? 0);
}

export async function getAnimalAffectionsForRoom(roomId: string): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  if (USE_POSTGRES) {
    const { rows } = await getPg().query('SELECT animal_key, affection FROM animal_affections WHERE room_id = $1', [roomId]);
    for (const r of rows) {
      result[r.animal_key] = Number(r.affection ?? 0);
    }
    return result;
  }
  const rows = getSqlite().prepare('SELECT animal_key, affection FROM animal_affections WHERE room_id = ?').all(roomId) as Array<{
    animal_key: string;
    affection: number;
  }>;
  for (const r of rows) {
    result[r.animal_key] = Number(r.affection ?? 0);
  }
  return result;
}

export async function spendPointsForAnimalPet(params: {
  roomId: string;
  userId: string;
  animalKey: string;
  cost: number;
  affectionGain: number;
}): Promise<{ ok: boolean; insufficient?: boolean; affectionPoints: number; animalAffection: number }> {
  const safeCost = Math.max(1, Math.floor(params.cost));
  const safeGain = Math.max(1, Math.floor(params.affectionGain));
  const now = new Date().toISOString();

  if (USE_POSTGRES) {
    const client = await getPg().connect();
    try {
      await client.query('BEGIN');
      const userRes = await client.query('SELECT affection_points FROM users WHERE id = $1 FOR UPDATE', [params.userId]);
      const currentPts = Number(userRes.rows[0]?.affection_points ?? 0);
      if (currentPts < safeCost) {
        const affRes = await client.query('SELECT affection FROM animal_affections WHERE room_id = $1 AND animal_key = $2', [
          params.roomId,
          params.animalKey,
        ]);
        await client.query('ROLLBACK');
        return {
          ok: false,
          insufficient: true,
          affectionPoints: currentPts,
          animalAffection: Number(affRes.rows[0]?.affection ?? 0),
        };
      }
      const nextPtsRes = await client.query(
        'UPDATE users SET affection_points = affection_points - $1 WHERE id = $2 RETURNING affection_points',
        [safeCost, params.userId],
      );
      const id = `aff_${crypto.randomUUID().slice(0, 10)}`;
      const affUpsert = await client.query(
        `INSERT INTO animal_affections (id, room_id, animal_key, affection, updated_at)
         VALUES ($1, $2, $3, LEAST(100, $4), $5)
         ON CONFLICT (room_id, animal_key) DO UPDATE SET
           affection = LEAST(100, animal_affections.affection + $4),
           updated_at = EXCLUDED.updated_at
         RETURNING affection`,
        [id, params.roomId, params.animalKey, safeGain, now],
      );
      await client.query('COMMIT');
      return {
        ok: true,
        affectionPoints: Number(nextPtsRes.rows[0]?.affection_points ?? 0),
        animalAffection: Number(affUpsert.rows[0]?.affection ?? safeGain),
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  const db = getSqlite();
  const tx = db.transaction(() => {
    const userRow = db.prepare('SELECT affection_points FROM users WHERE id = ?').get(params.userId) as
      | { affection_points?: number }
      | undefined;
    const currentPts = Number(userRow?.affection_points ?? 0);
    const existingAffRow = db
      .prepare('SELECT affection FROM animal_affections WHERE room_id = ? AND animal_key = ?')
      .get(params.roomId, params.animalKey) as { affection?: number } | undefined;
    const currentAff = Number(existingAffRow?.affection ?? 0);

    if (currentPts < safeCost) {
      return { ok: false, insufficient: true, affectionPoints: currentPts, animalAffection: currentAff };
    }

    const nextPts = currentPts - safeCost;
    db.prepare('UPDATE users SET affection_points = ? WHERE id = ?').run(nextPts, params.userId);

    const nextAff = Math.min(100, currentAff + safeGain);
    const id = `aff_${crypto.randomUUID().slice(0, 10)}`;
    db.prepare(
      `INSERT INTO animal_affections (id, room_id, animal_key, affection, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(room_id, animal_key) DO UPDATE SET
         affection = MIN(100, animal_affections.affection + ?),
         updated_at = excluded.updated_at`,
    ).run(id, params.roomId, params.animalKey, nextAff, now, safeGain);

    return { ok: true, affectionPoints: nextPts, animalAffection: nextAff };
  });

  return tx();
}


