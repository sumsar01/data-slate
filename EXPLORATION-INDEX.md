# Data-Slate Codebase Exploration Index

This index guides you through the comprehensive exploration documents created for the Data-Slate project.

## Documents

### 1. EXPLORATION-REPORT.md
**Comprehensive technical reference for the entire codebase**

Best for: Understanding the overall architecture, design decisions, and complete feature list

Contents:
- Executive summary (system overview)
- Admin panel UI features and structure
- Complete log entry data structures (Note, DateGroup, Entity, Tag types)
- All API endpoints (11 CRUD operations with request/response examples)
- Frontend display and editing components
- Database schema (4 tables: notes, session_overrides, entities, shares)
- Key file paths (organized by backend/frontend)
- Edit/create capabilities analysis
- Groq AI integration
- Deployment information
- Mock data fallback

Key Sections:
- Section 1: Admin Panel UI
- Section 2: Log Entry Data Structure
- Section 3: API Endpoints
- Section 4: Frontend Display & Editing
- Section 5: Database Schema
- Section 6: Key File Paths
- Section 10: Mock Data Fallback

### 2. CODE-REFERENCE.md
**Practical code examples and usage patterns**

Best for: Getting started with specific features, copy-paste examples, common patterns

Contents:
- Quick type reference (Note, DateGroup)
- 5+ API usage examples
- Component usage patterns
- Data flow diagrams (Recording → Display, Session Analysis)
- Backend route structure
- Admin panel action examples (image upload, merge entities, generate summary)
- Common patterns:
  - Optimistic updates
  - Two-tap delete confirmation
  - Polling with fallback
- Export to markdown
- Type guards
- Environment variables
- Testing scenarios

Highlights:
- Ready-to-use fetch examples
- Component prop examples
- Data transformation patterns
- Admin panel integration examples

### 3. FILE-PATHS-REFERENCE.md (existing)
**Complete file organization and locations**

Best for: Finding specific features or understanding project structure

## Quick Start

### I want to understand...

**The admin panel UI**
→ Read: EXPLORATION-REPORT.md Section 1 + CODE-REFERENCE.md "Admin Panel Actions"

**Log entry structure (what fields does a note have?)**
→ Read: EXPLORATION-REPORT.md Section 2 + CODE-REFERENCE.md "Quick Type Reference"

**All available API endpoints**
→ Read: EXPLORATION-REPORT.md Section 3 (includes request/response formats)

**How to display notes in the frontend**
→ Read: EXPLORATION-REPORT.md Section 4 + CODE-REFERENCE.md "Component Usage Examples"

**Database design**
→ Read: EXPLORATION-REPORT.md Section 5

**How the recording → display flow works**
→ Read: CODE-REFERENCE.md "Data Flow: Recording → Display"

**How session analysis works**
→ Read: CODE-REFERENCE.md "Data Flow: Session Analysis"

**How to add/edit a feature**
→ Read: EXPLORATION-REPORT.md Section 7 "Edit/Create Patterns"

**Where a specific file is located**
→ Read: FILE-PATHS-REFERENCE.md

**Actual code examples**
→ Read: CODE-REFERENCE.md

## Key Learnings

### Admin Panel Features (5 areas)
1. **DATA EXPORT** - Markdown export of all/individual sessions
2. **SHARE LINKS** - Create shareable tokens, manage access
3. **ENTITY INDEX STATUS** - Track extraction progress, retry
4. **TRANSCRIPT FLAVOURING** - Batch rewrite with 40K terminology
5. **ENTITY WIKI** - Full CRUD, sync, merge, image upload, AI summaries

### Log Entry Type (Note)
```typescript
{
  id: UUID
  date: YYYY-MM-DD
  title: string (auto-generated)
  transcript: string (flavoured)
  audio_url: string | null (R2)
  duration_s: number
  tags: Tag[] (9 types)
  entities: Entity[] (extracted)
  created_at: ISO timestamp
}
```

### API Endpoints Summary
| Operation | Endpoint | Purpose |
|-----------|----------|---------|
| Create | POST /notes | Record + transcribe |
| List | GET /notes, GET /dates | Retrieve notes |
| Extract | POST /notes/:id/entities | Retry entity extraction |
| Delete | DELETE /notes/:id | Remove note |
| Batch | POST /notes/flavour-all | Rewrite all transcripts |
| Session | POST /sessions/auto, PATCH /sessions/:id | Manage campaigns |

### Frontend Components
- **NoteList** - Session groups, filtering, deletion
- **NoteReader** - Display with typewriter animation, audio player
- **Admin** - Wiki management, share links, batch operations
- **Record** - Audio capture with tag selection

### Current Editing Capabilities
Can edit:
- Session names
- Entity metadata (type, description, image, merge)

Cannot edit:
- Note content (transcript, title, tags, date, audio, duration)

## File Locations (Quick Reference)

| Component | Location |
|-----------|----------|
| Admin Panel | apps/web/src/pages/Admin.tsx |
| Main Log | apps/web/src/App.tsx |
| Note List | apps/web/src/components/NoteList.tsx |
| Note Display | apps/web/src/components/NoteReader.tsx |
| Types (Frontend) | apps/web/src/shared.ts |
| Types (Backend) | apps/api/src/lib/types.ts |
| Notes API | apps/api/src/routes/notes.ts |
| Sessions API | apps/api/src/routes/sessions.ts |
| Dates API | apps/api/src/routes/dates.ts |
| Database | apps/api/src/lib/db.ts |
| Groq Integration | apps/api/src/lib/groq.ts |

## Reading Order

For a complete understanding, read in this order:

1. **EXPLORATION-REPORT.md** - Start here for overview
2. **CODE-REFERENCE.md** - See practical examples
3. **FILE-PATHS-REFERENCE.md** - Find specific files
4. **Source code** - Dive into specific implementations

## Development Commands

```bash
# Install dependencies
bun install

# Frontend development
bun run dev:web              # Vite on localhost:5173

# Backend development
bun run dev:api              # Bun watcher on localhost:3001

# Build
bun run build:web
bun run build:api

# Deployment
cd apps/api && railway up --detach --service serene-analysis
```

## Key Technologies

- **Frontend:** React 19, Vite, TypeScript
- **Backend:** Hono, Bun, TypeScript
- **Database:** Turso (libsql/SQLite)
- **Storage:** Cloudflare R2
- **AI:** Groq SDK

## Architecture Overview

```
User Input
  ↓
React Components (NoteList, NoteReader, Admin)
  ↓
API Client (data/api.ts)
  ↓
REST Endpoints (Hono)
  ↓
Database (Turso) + Storage (R2) + AI (Groq)
  ↓
JSON Response
  ↓
UI Update
```

## Notes

- No authentication currently implemented
- Polling every 30 seconds (not real-time)
- Mock data fallback if API unavailable
- Groq processes: transcription, flavouring, title generation, entity extraction, summarization
- Notes are immutable after creation (delete to modify)
- Sessions can be auto-generated or manually created

## What's NOT in the Codebase

- Tests (no test files exist yet)
- User authentication
- Real-time updates (polling-based)
- Note content editing
- Role-based access control

---

**Last Updated:** May 13, 2026

For the latest code, see: `/Users/rasmus/git/github.com/sumsar01/data-slate`
