# Data-Slate Quick Reference Card

## What is Data-Slate?
A 40K-themed campaign management system. Record audio → automatic transcription → entity extraction → searchable archive.

---

## Key Concepts

### Sessions (Campaigns)
- **What:** Named groupings of one or more dates (e.g., "Session 1: The Void Born")
- **Code name:** `SessionOverride` / `DateGroup` (in frontend types)
- **DB table:** `session_overrides` (id, name, dates JSON, summary)
- **Can span:** Multiple dates, each with 0+ notes

### Notes (Recordings)
- **What:** Individual audio recordings + auto-generated transcript
- **Stored in:** `notes` table (id, date, title, transcript, audio_url, duration_s, tags, entities, created_at)
- **Transcript is "flavoured"** with 40K terminology via Groq
- **Entities extracted** automatically (NPC, Location, Faction, Item, Other)

### Entities (Wiki)
- **What:** Named NPCs, Locations, Factions, Items extracted from note transcripts
- **Stored in:** `entities` table (with canonical_id for deduplication)
- **Features:** Type, description, image, Groq dossier, mentions in notes

---

## Database Schema at a Glance

```sql
notes (id, date, title, transcript, audio_url, duration_s, tags, entities, created_at)
session_overrides (id, name, dates JSON, summary)
shares (id, token, session_id, created_at, expires_at)
entities (id, name, type, canonical_id, description, summary, image_url, created_at)
```

---

## API Endpoints Quick List

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/notes` | Upload audio, transcribe, store |
| GET | `/dates` | Get all notes grouped by date + sessions |
| POST | `/sessions` | Create session override |
| PATCH | `/sessions/:id` | Update session name/dates |
| POST | `/sessions/:id/summary` | Generate battle report via Groq |
| POST | `/shares` | Create share token |
| GET | `/wiki` | List all entities |
| POST | `/wiki/sync` | Extract all entities from transcripts |
| PATCH | `/wiki/:id` | Edit entity (type, description, etc.) |

---

## Frontend Routes

| Path | Component | Purpose |
|------|-----------|---------|
| `/` | App.tsx | Main log (left: notes, right: detail) |
| `/record` | Record.tsx | Audio recorder |
| `/admin-mechanicus` | Admin.tsx | Admin panel (export, share, sync) |
| `/wiki` | Wiki.tsx | Entity browser |
| `/wiki/:id` | WikiPage.tsx | Entity detail + mentions |
| `/share/:token` | ShareView.tsx | Public read-only view |

---

## Key Files to Know

### Backend
- **Server:** `/apps/api/src/index.ts`
- **Database client:** `/apps/api/src/lib/db.ts` (Turso HTTP API)
- **LLM calls:** `/apps/api/src/lib/groq.ts` (transcribe, flavour, extract, summarise)
- **Session routes:** `/apps/api/src/routes/sessions.ts`
- **Note routes:** `/apps/api/src/routes/notes.ts`

### Frontend
- **Main view:** `/apps/web/src/App.tsx` + `/apps/web/src/components/NoteList.tsx`
- **Session UI:** `/apps/web/src/components/SessionOverride.tsx`
- **Admin:** `/apps/web/src/pages/Admin.tsx`
- **API client:** `/apps/web/src/data/api.ts` (upsertSession, deleteNote, generateSummary)
- **Types:** `/apps/web/src/shared.ts` (Note, DateGroup, Entity, Tag)

### Shared Types
- `/packages/shared/src/index.ts` (source of truth for all types)

---

## Common Tasks

### Add a Note
```
1. Record audio at /record
2. POST /notes with FormData (audio, date, duration_s, tags)
3. Backend: transcribe → flavour → extract entities → store
4. Frontend polls /dates every 30s, data appears
```

### Create a Session
```
1. Navigate to date in main log
2. Click [ SET SESSION NAME ]
3. Enter name, click OK
4. Frontend calls upsertSession() → POST /sessions or PATCH /sessions/:id
```

### Generate Session Summary
```
1. In NoteList, click "▶ GENERATE BATTLE REPORT" under session
2. Frontend calls generateSummary(sessionId) → POST /sessions/:id/summary
3. Groq reads all notes for that session, generates summary
4. Summary stored in session_overrides.summary, display updated
```

### Create Share Link
```
1. Go to /admin-mechanicus
2. Find session, click "+ SHARE"
3. Frontend calls POST /shares with session_id
4. Share token returned, can distribute URL
5. Anyone with URL can view at /share/:token (read-only)
```

### Sync Entity Wiki
```
1. Go to /admin-mechanicus
2. Click "⚙ SYNC ENTITIES"
3. Backend scans all notes, extracts entities via Groq
4. Inserts new entries into entities table
5. Admin can then edit types, descriptions, upload images
```

---

## Deployment

### Frontend (Vercel)
- Auto-deploys from `main` branch
- Build: `bun run build:web` (tsc -b + vite build)

### Backend (Railway)
- Manual deploy: `cd apps/api && railway up --detach --service serene-analysis`
- Check health: `curl https://serene-analysis-production-145c.up.railway.app/health`

### Database (Turso)
- URL: `libsql://dataslate-sumsar01.aws-eu-west-1.turso.io`
- Client: Turso HTTP API (no native Bun support yet)

### Storage (Cloudflare R2)
- Bucket: `data-slate`
- Audio files: `/audio/{uuid}.{mp4|webm}`
- Entity images: `/images/{uuid}.{jpg|png}`

---

## Development

```bash
# Install
bun install

# Dev servers (both)
bun run dev:web    # Vite, localhost:5173
bun run dev:api    # Bun watcher, localhost:3001

# Build & test
bun run build:web
bun run --cwd apps/web lint

# Start API (production)
bun run --cwd apps/api start
```

---

## Important Gotchas

1. **No tests yet** — AGENTS.md says "no tests exist yet"
2. **Schema inline** — CREATE TABLE statements are in route handlers, no migrations
3. **Types in 3 places** — Keep `/packages/shared/src/index.ts`, `/apps/api/src/lib/types.ts`, and `/apps/web/src/shared.ts` in sync
4. **Non-interactive shell** — Use `-f` flag with cp/mv/rm to avoid prompts
5. **30s poll interval** — Frontend refreshes from `/dates` every 30 seconds (not real-time)
6. **JSON storage** — tags, entities, dates stored as JSON strings in SQLite

---

## Terminology Mapping

| Codebase | UI Label |
|----------|----------|
| Note | Record / Entry |
| SessionOverride | Session / Campaign |
| EntityIndex | AUSPEX LOG (sidebar) |
| DateGroup | Date Group |
| Entity | Dossier / Wiki Entry |

---

## Links

- **Production API:** `https://serene-analysis-production-145c.up.railway.app`
- **Database:** `libsql://dataslate-sumsar01.aws-eu-west-1.turso.io`
- **Git:** `/Users/rasmus/git/github.com/sumsar01/data-slate`

---

See `codebase-summary.md` for full architectural details.
See `file-paths-reference.md` for complete file listing.

