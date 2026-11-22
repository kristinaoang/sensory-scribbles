-- Tiger Data (TimescaleDB / PostgreSQL) Schema for Sensory Scribbles
-- Run this against a TimescaleDB-enabled PostgreSQL database when DATABASE_URL is configured.

CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  solana_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  affection_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prompts (
  id TEXT PRIMARY KEY,
  prompt_date DATE UNIQUE NOT NULL,
  text TEXT NOT NULL,
  sensory_focus TEXT NOT NULL DEFAULT 'tactile',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hypertable: entries (partitioned by created_at)
CREATE TABLE IF NOT EXISTS entries (
  id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  prompt_id TEXT NOT NULL REFERENCES prompts(id),
  entry_date DATE NOT NULL,
  sentence TEXT NOT NULL CHECK (char_length(sentence) <= 140),
  stroke_json JSONB NOT NULL,
  world_spec JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  moderation_reason TEXT,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  solana_tx TEXT,
  solana_hash TEXT,
  PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('entries', 'created_at', if_not_exists => TRUE);

-- Enforce one entry per user per room per day in application + unique index on (room_id, user_id, entry_date, created_at)
CREATE INDEX IF NOT EXISTS idx_entries_room_date ON entries (room_id, entry_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_user_date ON entries (user_id, entry_date);

-- Hypertable: minigame_events (partitioned by created_at)
CREATE TABLE IF NOT EXISTS minigame_events (
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  entry_id TEXT NOT NULL,
  game_type TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('minigame_events', 'created_at', if_not_exists => TRUE);

CREATE INDEX IF NOT EXISTS idx_minigame_user_time ON minigame_events (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS nightly_captions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  caption_date DATE NOT NULL,
  caption TEXT NOT NULL,
  entry_count INTEGER NOT NULL,
  validated BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, caption_date)
);

CREATE TABLE IF NOT EXISTS minigame_questions (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  entry_id TEXT NOT NULL,
  question_date DATE NOT NULL,
  game_type TEXT NOT NULL,
  question_text TEXT NOT NULL,
  options_json JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Collaborative Shared Canvas strokes
CREATE TABLE IF NOT EXISTS canvas_strokes (
  id TEXT NOT NULL,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  reflection TEXT NOT NULL CHECK (char_length(reflection) <= 140),
  stroke_json JSONB NOT NULL,
  world_spec JSONB NOT NULL,
  chapter_number INTEGER NOT NULL DEFAULT 1,
  flagged BOOLEAN NOT NULL DEFAULT FALSE,
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
);

SELECT create_hypertable('canvas_strokes', 'created_at', if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS idx_canvas_strokes_room ON canvas_strokes (room_id, created_at DESC);

-- Progression-based 3D World Quests (question prompts + collaborative canvas drawing prompts)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_room_quests_room ON room_quests (room_id, chapter_number ASC);

-- Tamed Wild Animal Companions per room
CREATE TABLE IF NOT EXISTS tamed_animals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  animal_key TEXT NOT NULL,
  species TEXT NOT NULL,
  nickname TEXT NOT NULL,
  description TEXT NOT NULL,
  tamed_by_user_id TEXT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, animal_key)
);

CREATE INDEX IF NOT EXISTS idx_tamed_animals_room ON tamed_animals (room_id, created_at ASC);

-- Persistent animal affection levels per room
CREATE TABLE IF NOT EXISTS animal_affections (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id),
  animal_key TEXT NOT NULL,
  affection INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(room_id, animal_key)
);

CREATE INDEX IF NOT EXISTS idx_animal_affections_room ON animal_affections (room_id);

-- Continuous Aggregate 1: Daily entry counts per room using time_bucket('1 day', created_at)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_room_entry_counts
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', created_at) AS day,
  room_id,
  COUNT(*)::INTEGER AS entry_count
FROM entries
WHERE flagged = FALSE
GROUP BY day, room_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('daily_room_entry_counts',
  start_offset => INTERVAL '30 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);

-- Continuous Aggregate 2: Minigame accuracy per user over time (weekly buckets)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_minigame_accuracy_weekly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('7 days', created_at) AS week_start,
  user_id,
  COUNT(*)::INTEGER AS total_attempts,
  SUM(CASE WHEN correct THEN 1 ELSE 0 END)::INTEGER AS correct_count
FROM minigame_events
GROUP BY week_start, user_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('user_minigame_accuracy_weekly',
  start_offset => INTERVAL '90 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE);
