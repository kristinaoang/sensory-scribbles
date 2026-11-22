# Sensory Scribbles

Every day, everyone in a room (a friend group, class, or dorm) receives the same sensory reflection prompt. Each person answers with **one sentence** (max 140 characters) and **one continuous stroke** made out of the words in their reflection. Together, those tiles shape the room's mosaic and sculpt a shared **Three.js 3D world** where every entry transforms a plot.

## Features Implemented

1. **Daily Prompt & Mobile Word-Stroke Canvas**: Join or create rooms with unique invite codes (`SS-...`), answer today's sensory prompt once per day, and draw one continuous stroke that weaves your sentence along the curve (works with mobile touch, mouse, or keyboard auto-curve).
2. **Room Invitation System**: Creating a room auto-generates a unique invite code (`SS-...`). Members inside a room can view, copy, or share their invite code and invite link (`/?invite=SS-...`), or join any existing room by entering a valid invite code.
3. **Collective 2D Room Picture & Shared Free Canvas**: Everyone's 2D word-strokes are arranged together on a shared 2D scale to form a harmonious landscape picture, alongside a collaborative free-draw layer (`room_free_strokes`) where everyone in the room can sketch together, plus a date picker and nightly two-sentence caption below the mosaic.
4. **Walkable Natural 3D Worlds (Text-Interpreted Three.js)**: Instead of drawing 3D stroke tubes, each journal sentence is interpreted by Gemini (with deterministic sensory fallbacks) into a natural clearing—cabins, stone lanterns, windmills, tea pavilions, ponds, weaver looms, pines, peach trees, and wildflowers—placed on a rolling sunlit island you can freely walk (`WASD`/Arrows, drag-look, tap terrain to stroll, mobile D-pad, 3rd-person or 1st-person mode).
5. **Modular Minigames**:
   - *Guess the Prompt*: inspect a tile's word-stroke and pick which prompt it answered from 4 options.
   - *Whose Is It?*: match 3 sentences to 3 drawn strokes.
   - *3D Text-Interpretation Minigame*: walk up to a friend's 3D clearing and match the habitat back to the journal reflection that sculpted it.
   - All results persist to `minigame_events`.
6. **Gemini Moderation Gate**: Before any entry becomes visible, the server sends the sentence to Gemini (`@google/genai`) alongside deterministic URL/PII screening to block slurs, harassment, sexual content, threats, links, and personal info.
7. **Admin Console (`/admin`)**: Password-protected dashboard (with first-run passcode setup if `ADMIN_PASSWORD` is unset) with stable labeled buttons for flagging/unflagging today's entries, scheduling tomorrow's prompt, reviewing past prompts, toggling Solana Devnet per room, and triggering the Mastra workflow.
8. **Mastra Nightly Workflow (`src/mastra/nightlyWorkflow.ts`)**: Queries the day's entries, calls Gemini to draft a 2-sentence mosaic caption and 3 minigame questions, runs a strict validation check (zero participant names, max 5 consecutive quoted words, grounded entry IDs), and fails safely if data is missing.
9. **Stats Page**: Weekly minigame accuracy chart and daily room counts powered by `time_bucket()` continuous aggregates.
10. **Demo Seed Script (`npm run seed`)**: Generates 42 varied sensory demo entries across 7 days (`is_demo = true`).
11. **Solana Devnet Hash Layer (Opt-In)**: Per-room opt-in server-sponsored Memo transaction anchoring only a privacy-preserving SHA-256 hash of `(entry_id, hour_bucket)` — never the sentence, user, or room.

## Local Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and set your secrets:
   - `GEMINI_API_KEY` — Required for Gemini moderation and Mastra nightly summaries.
   - `DATABASE_URL` — Optional Tiger Data (TimescaleDB / PostgreSQL) connection string. When omitted, the app runs out-of-the-box using local SQLite (`sensory_scribbles.db`).
   - `ADMIN_PASSWORD` — Optional shared admin password for `/admin` (if unset, `/admin` presents a one-time setup form).
   - `SOLANA_SPONSOR_SECRET` — Optional Devnet sponsor keypair JSON byte array or base64 secret for sponsoring Memo anchors.
3. (Optional) Initialize Tiger Data schema when using TimescaleDB:
   ```bash
   psql "$DATABASE_URL" -f db/timescale_schema.sql
   ```
4. Seed demo entries (also auto-runs once on empty startup):
   ```bash
   npm run seed
   ```
5. Start the development server on port 3000:
   ```bash
   npm run dev
   ```
6. Build & run in production (e.g. on Vultr):
   ```bash
   npm run build
   NODE_ENV=production npm start
   ```

## How We Used Cursor, Grok Bot, Gemini, Tiger Data, Mastra, and Vultr

- **Cursor**: Accelerated modular TypeScript scaffolding across the Express API, React components, Three.js procedural geometry builders, and database abstractions.
- **Grok Bot**: Automates daily moderation sweeps and tomorrow's prompt scheduling against the stable, labeled `/admin` controls (`data-testid` anchors, clear Flag/Unflag and Save Prompt buttons, no drag-and-drop).
- **Gemini (`@google/genai`)**: Powers real-time pre-publish safety & privacy moderation on every submitted sentence and generates the nightly two-sentence mosaic reflection plus grounded minigame questions.
- **Tiger Data (TimescaleDB)**: Stores `entries` and `minigame_events` as time-series hypertables and powers weekly accuracy and daily room activity charts via `time_bucket()` continuous aggregates (`db/timescale_schema.sql`).
- **Mastra**: Orchestrates the 4-step nightly workflow (`src/mastra/nightlyWorkflow.ts`) with a dedicated validation check that blocks leaked names, excessive quotes, or hallucinated entries when data is absent.
- **Vultr**: Hosts the unified Node/Express + Vite production bundle (`npm run build && npm start`) behind HTTPS on a single lightweight compute instance.

Gemini writes the campus narration once, at build time, with `npm run narration` (`scripts/generate-narration.ts`). That script calls Gemini text-to-speech and saves wav files under `public/audio`. The campus does not need a live speech call to play the welcome. The same key, kept on the server, can refresh the short quest prompts cached in the database, suggest three draw-or-write ideas, and answer a tap on an animal. Animal replies are one turn only: a structured line of at most 25 words, then a second model check, a banned-word list, and a length check. If the key is missing, the call fails, or the line does not pass, the campus shows the saved prompt or a canned line and still lets the child walk in. Nothing from the child is stored except counts of help taps and animal taps.

Audio credits: `public/audio/ambient-lofi.wav` is an original instrumental written for this demo and released CC0. `public/audio/footstep.wav` is an original short soft footstep synthesized for this demo and released CC0. Narration files in `public/audio` are generated from `content/narration.json` with Gemini text-to-speech using the adult prebuilt voice named by `GEMINI_TTS_VOICE`. No recordings of children are used.
