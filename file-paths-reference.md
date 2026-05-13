# Data-Slate File Paths Reference

## Root Directory
`/Users/rasmus/git/github.com/sumsar01/data-slate`

---

## Backend (API) — Hono + Turso

### Core Server Files
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/index.ts` — Server setup, route registration, CORS config
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/package.json` — Dependencies, build scripts
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/.env` — Environment secrets (Turso, Groq, R2)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/.env.example` — Template for env vars
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/tsconfig.json` — TypeScript config
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/Dockerfile` — Container image definition

### Database & Storage Libraries
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/lib/db.ts` — Turso HTTP API client (Bun-compatible wrapper)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/lib/r2.ts` — Cloudflare R2 upload/delete functions
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/lib/groq.ts` — Groq LLM integration (transcribe, summarise, flavour, entities)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/lib/types.ts` — Shared TypeScript types

### Route Handlers
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/routes/notes.ts` — Note CRUD, audio upload, transcription pipeline
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/routes/sessions.ts` — Session override CRUD, summary generation
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/routes/dates.ts` — DateGroup aggregation endpoint
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/routes/shares.ts` — Share token CRUD, public access
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/routes/wiki.ts` — Entity wiki CRUD, sync from notes

---

## Frontend (Web) — React 19 + Vite

### Application Entry Points & Layout
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/main.tsx` — React root, route definitions
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/App.tsx` — Main log view layout (two-panel design)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/App.css` — Main styles (scanlines, terminal theme)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/index.css` — Global styles
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/package.json` — Dependencies, build scripts

### Pages (Route-Level Components)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/Admin.tsx` — Admin panel (export, shares, entity wiki, flavouring)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/Admin.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/Record.tsx` — Audio recorder UI
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/Record.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/ShareView.tsx` — Public read-only session view
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/ShareView.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/Wiki.tsx` — Entity browser listing
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/Wiki.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/WikiPage.tsx` — Entity detail page
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/pages/WikiPage.tsx` — Detail view with bio, dossier, mentions

### Components (Reusable UI)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/NoteList.tsx` — Date-grouped note list, session UI
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/NoteList.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/NoteReader.tsx` — Single note full view
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/NoteReader.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/SessionOverride.tsx` — Inline session name editor
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/SessionOverride.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/AudioPlayer.tsx` — HTML5 audio control
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/AudioPlayer.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/EntityIndex.tsx` — Sidebar entity pills
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/EntityIndex.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/TagFilter.tsx` — Multi-select tag filter
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/TagFilter.css`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/BootSequence.tsx` — Startup animation
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/components/BootSequence.css`

### Hooks (State & Side Effects)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/hooks/useDateGroups.ts` — API polling hook (30s interval)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/hooks/useTypewriter.ts` — Text animation effect

### Data & API Integration
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/data/api.ts` — Frontend API client (upsertSession, deleteNote, generateSummary)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/data/export.ts` — Markdown export functions
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/data/mockData.ts` — Fallback mock data (when API unavailable)

### Shared Types & Configuration
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/shared.ts` — Core types (Note, DateGroup, Entity, Tag)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/audio/sounds.ts` — Audio effects library

### Build Configuration
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/vite.config.ts` — Vite build config
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/.env` — Frontend env vars (VITE_API_URL)

---

## Shared Packages

### Shared Types
- `/Users/rasmus/git/github.com/sumsar01/data-slate/packages/shared/src/index.ts` — Tag, Note, DateGroup, Entity, SessionOverride types
- `/Users/rasmus/git/github.com/sumsar01/data-slate/packages/shared/package.json`

---

## Recorder App (Secondary)

### Entry Point
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/recorder/src/main.tsx`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/recorder/src/App.tsx`

### Configuration
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/recorder/vite.config.ts`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/recorder/.env`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/recorder/.env.example`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/recorder/package.json`

---

## Project Configuration

### Root Level
- `/Users/rasmus/git/github.com/sumsar01/data-slate/package.json` — Workspaces config, dev scripts
- `/Users/rasmus/git/github.com/sumsar01/data-slate/bun.lock` — Bun dependency lock file
- `/Users/rasmus/git/github.com/sumsar01/data-slate/.gitignore`
- `/Users/rasmus/git/github.com/sumsar01/data-slate/AGENTS.md` — Instructions for AI agents (this file!)
- `/Users/rasmus/git/github.com/sumsar01/data-slate/CLAUDE.md` — Notes for Claude (minimal)

### Git & Issue Tracking
- `/Users/rasmus/git/github.com/sumsar01/data-slate/.git/` — Git repository
- `/Users/rasmus/git/github.com/sumsar01/data-slate/.beads/` — Beads issue tracker data
- `/Users/rasmus/git/github.com/sumsar01/data-slate/.claude/` — Claude session notes

### Deployment Configuration
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/railway.json` — Railway deployment config
- `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/nixpacks.toml` — Nix build config for Railway

---

## Key Type Definition Files

### Complete Type Hierarchy
1. **Source of truth:** `/Users/rasmus/git/github.com/sumsar01/data-slate/packages/shared/src/index.ts`
   - Tag, Note, DateGroup, SessionOverride, Entity, EntityType
2. **Backend mirror:** `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/api/src/lib/types.ts`
   - (Same as shared, kept in sync)
3. **Frontend mirror:** `/Users/rasmus/git/github.com/sumsar01/data-slate/apps/web/src/shared.ts`
   - (Same as shared, kept in sync)

---

## Development Commands (from root)

```bash
# Build all
bun install
bun run build:web
bun run build:api

# Dev servers
bun run dev:web        # Vite on localhost:5173
bun run dev:api        # Bun watcher on localhost:3001

# Specific workspace commands
bun run --cwd apps/web lint
bun run --cwd apps/api start

# Deploy
railway up --detach --service serene-analysis  # From apps/api/
```

---

## Important Notes on File Locations

- **No migration files:** Schema is defined inline in route handlers (e.g., `CREATE TABLE IF NOT EXISTS` in `/apps/api/src/routes/wiki.ts`)
- **No test files:** No tests exist yet (AGENTS.md notes "No global test command — no tests exist yet")
- **No ESLint config:** Uses Flat Config (`/apps/web/eslint.config.js`, not `.eslintrc`)
- **No Prettier:** Not configured in this project
- **No standalone typecheck:** TypeScript check runs as part of `bun run build:web` (via `tsc -b`)

