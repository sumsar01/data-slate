# Data-Slate Code Reference & Examples

## Quick Type Reference

### Note (Log Entry)
```typescript
// From: apps/web/src/shared.ts and apps/api/src/lib/types.ts

type Note = {
  id: string                    // "123e4567-e89b-12d3-a456-426614174000"
  date: string                  // "2024-01-15"
  title: string                 // "Initial contact with Magos Biologis"
  transcript: string            // Full 40K-flavoured text
  audio_url: string | null      // "https://r2.example.com/audio/123.webm"
  duration_s: number            // 180.5
  tags: Tag[]                   // ["NPC", "Tech-Lore"]
  entities: Entity[]            // [{ name: "Magos Biologis Hekaton", type: "NPC" }]
  created_at: string            // "2024-01-15T14:30:45.123Z"
}
```

### DateGroup (Notes grouped by date + session)
```typescript
type DateGroup = {
  date: string                  // "2024-01-15"
  session_id: string | null     // "session-uuid" or null
  session_name: string | null   // "Port Wrath Investigation" or null
  session_summary: string | null // Groq-generated summary or null
  notes: Note[]                 // All notes for this date
}
```

---

## API Usage Examples

### 1. Upload a Recording (Frontend)
```typescript
// From: apps/web/src/pages/Record.tsx

const formData = new FormData()
formData.append("audio", audioBlob, "recording.webm")
formData.append("date", "2024-01-15")
formData.append("duration_s", "180")
formData.append("tags", "NPC")
formData.append("tags", "Combat")

const response = await fetch(`${API_URL}/notes`, {
  method: "POST",
  body: formData
})

const newNote: Note = await response.json()
// Note has auto-generated title, transcription, entities
```

### 2. Fetch Notes by Date
```typescript
// From: apps/web/src/hooks/useDateGroups.ts

const response = await fetch(`${API_URL}/dates`)
const groups: DateGroup[] = await response.json()

// groups[0] = {
//   date: "2024-01-15",
//   session_id: "...",
//   session_name: "Port Wrath Investigation",
//   notes: [...]
// }
```

### 3. Auto-Analyse a Session
```typescript
// From: apps/web/src/data/api.ts

const response = await fetch(`${API_URL}/sessions/auto`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    dates: ["2024-01-15", "2024-01-16"]
  })
})

const session = await response.json()
// { id: "...", name: "Port Wrath Investigation", summary: "..." }
```

### 4. Update Session Name
```typescript
// From: apps/web/src/components/SessionOverride.tsx

const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
  method: "PATCH",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "Custom Session Name",
    dates: ["2024-01-15", "2024-01-16"]
  })
})
```

### 5. Delete a Note
```typescript
// From: apps/web/src/data/api.ts

await fetch(`${API_URL}/notes/${noteId}`, {
  method: "DELETE"
})
// Also deletes audio from R2
```

---

## Component Usage Examples

### NoteList with Filtering
```typescript
// From: apps/web/src/components/NoteList.tsx

<NoteList
  groups={groups}
  selectedId={selectedNote?.id ?? null}
  activeTagFilters={["NPC", "Combat"]}    // Only show notes with these tags
  searchQuery="Magos"                     // Full-text search
  onSelect={(note) => setSelectedNote(note)}
  onReload={() => refetchData()}
  onDeleted={(noteId) => removeNoteFromUI(noteId)}
/>
```

### Displaying a Note
```typescript
// From: apps/web/src/components/NoteReader.tsx

<NoteReader note={selectedNote} />
// Renders: title, metadata, typewriter-animated transcript, audio player
```

### Tag Filter
```typescript
// From: apps/web/src/components/TagFilter.tsx

<TagFilter
  active={["NPC", "Faction"]}
  onChange={(newTags) => setActiveFilters(newTags)}
/>
// Shows all 9 tags, user can multi-select
```

---

## Data Flow: Recording → Display

```
User Record Audio (/record)
    ↓
Record.tsx captures:
  - audio blob (webm/mp4)
  - date (YYYY-MM-DD)
  - duration_s (seconds)
  - tags (selected by user)
    ↓
FormData → POST /notes
    ↓
Backend Pipeline:
  1. Upload audio → R2
  2. Transcribe (Groq) + detect language
  3. Flavour with 40K terminology (Groq)
  4. Generate title (Groq)
  5. Extract entities (Groq) [async, fire-and-forget]
  6. INSERT into notes table
    ↓
Response: { id, date, title, transcript, audio_url, duration_s, tags, created_at }
    ↓
Frontend: useDateGroups polls /dates every 30s
    ↓
NoteList re-renders showing new note
    ↓
User clicks note → NoteReader displays with audio player
```

---

## Data Flow: Session Analysis

```
User clicks "AUTO-ANALYSE SESSION"
    ↓
NoteList.tsx → autoAnalyseSession([date])
    ↓
POST /sessions/auto { dates: ["2024-01-15"] }
    ↓
Backend:
  1. SELECT transcript FROM notes WHERE date IN (dates)
  2. Generate name via Groq
  3. Generate summary via Groq
  4. INSERT into session_overrides
    ↓
Response: { id, name, summary, dates }
    ↓
Frontend: reload() → /dates endpoint re-queried
    ↓
DateGroup now has session_id, session_name, session_summary
    ↓
NoteList re-renders showing session metadata
```

---

## Backend Route Structure

### Server Setup
```typescript
// apps/api/src/index.ts

import { Hono } from "hono"
import { cors } from "hono/cors"
import { notesRouter } from "./routes/notes"
import { datesRouter } from "./routes/dates"
import { sessionsRouter } from "./routes/sessions"

const app = new Hono()
app.use("*", cors({ /* config */ }))

app.get("/health", (c) => c.json({ status: "ok" }))
app.route("/notes", notesRouter)
app.route("/dates", datesRouter)
app.route("/sessions", sessionsRouter)
```

### Database Query Pattern
```typescript
// apps/api/src/lib/db.ts

const result = await db.execute({
  sql: "SELECT * FROM notes WHERE id = ?",
  args: [noteId]
})

const notes: Note[] = result.rows.map(row => ({
  id: row.id,
  date: row.date,
  title: row.title,
  transcript: row.transcript,
  audio_url: row.audio_url,
  duration_s: row.duration_s,
  tags: JSON.parse(row.tags),
  entities: row.entities ? JSON.parse(row.entities) : [],
  created_at: row.created_at
}))
```

---

## Admin Panel Actions

### Add Entity Image
```typescript
// From: apps/web/src/pages/Admin.tsx (line 183-198)

async function uploadImage(entityId: string, file: File) {
  setUploadingImageFor(entityId)
  try {
    const fd = new FormData()
    fd.append("image", file)
    const res = await fetch(`${API_URL}/wiki/${entityId}/image`, {
      method: "POST",
      body: fd
    })
    if (res.ok) {
      const { image_url } = await res.json()
      setWikiEntities(prev => 
        prev.map(e => e.id === entityId ? { ...e, image_url } : e)
      )
    }
  } finally {
    setUploadingImageFor(null)
  }
}
```

### Merge Duplicate Entities
```typescript
// From: apps/web/src/pages/Admin.tsx (line 166-181)

async function mergeEntities(dropId: string, keepId: string) {
  await fetch(`${API_URL}/wiki/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keep_id: keepId, drop_id: dropId })
  })
  // Remove dropped entity from list
  setWikiEntities(prev => prev.filter(e => e.id !== dropId))
}
```

### Generate Entity Summary
```typescript
// From: apps/web/src/pages/Admin.tsx (line 132-145)

async function generateSummary(entityId: string) {
  setGeneratingSummaryFor(entityId)
  try {
    const res = await fetch(`${API_URL}/wiki/${entityId}/summary`, {
      method: "POST"
    })
    if (res.ok) {
      const { summary } = await res.json()
      setWikiEntities(prev =>
        prev.map(e => e.id === entityId ? { ...e, summary } : e)
      )
    }
  } finally {
    setGeneratingSummaryFor(null)
  }
}
```

---

## Common Patterns

### Optimistic Updates
```typescript
// Update UI immediately, revert on error
const oldValue = state.value
setState(newValue)
try {
  await api.update(newValue)
} catch (error) {
  setState(oldValue)  // Rollback
}
```

### Two-Tap Delete Confirmation
```typescript
// From: NoteList.tsx

async function handleDelete(note: Note) {
  if (confirmId !== note.id) {
    setConfirmId(note.id)  // First tap: show confirm button
    return
  }
  setConfirmId(null)
  setDeletingId(note.id)
  try {
    await deleteNote(note.id)
    onDeleted(note.id)
  } finally {
    setDeletingId(null)
  }
}
```

### Polling with Fallback
```typescript
// From: useDateGroups hook

const [groups, setGroups] = useState<DateGroup[]>(mockData)

useEffect(() => {
  const interval = setInterval(async () => {
    try {
      const response = await fetch(`${API_URL}/dates`)
      if (!response.ok) throw new Error("API unavailable")
      const data = await response.json()
      setGroups(data)
    } catch (error) {
      // Keep using mock data or previous state
    }
  }, 30000)
  return () => clearInterval(interval)
}, [])
```

---

## Export to Markdown

```typescript
// From: apps/web/src/data/export.ts

function exportGroupsToMarkdown(groups: DateGroup[]): string {
  return groups.map(group => {
    const title = group.session_name ?? group.date
    return `## ${title}\n\n${group.notes.map(note => 
      `### ${note.title}\n\n${note.transcript}`
    ).join("\n\n")}`
  }).join("\n\n")
}

function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## Type Guards & Assertions

### Check if Note has Audio
```typescript
if (note.audio_url) {
  // Safe to display audio player
}
```

### Check if DateGroup has Session
```typescript
if (group.session_id) {
  // This date is part of a named session
  console.log(group.session_name)
}
```

### Filter Notes with Entities
```typescript
const notesWithEntities = notes.filter(n => n.entities.length > 0)
const notesWithoutEntities = notes.filter(n => n.entities.length === 0)
```

---

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001
```

### Backend (.env)
```
PORT=3001
TURSO_URL=libsql://...
TURSO_AUTH_TOKEN=...
GROQ_API_KEY=...
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=data-slate
R2_PUBLIC_URL=https://r2.example.com
CORS_ORIGIN=http://localhost:5173,https://data-slate.example.com
```

---

## Testing Common Scenarios

### Test Note Deletion
1. Go to main log
2. Select a note
3. Click delete button (first tap)
4. Confirm delete button shows
5. Click again to confirm
6. Note should disappear from UI
7. Verify audio removed from R2

### Test Session Auto-Analyse
1. Go to main log
2. Find a date group without session name
3. Click "AUTO-ANALYSE SESSION"
4. Wait for Groq processing
5. Verify session name and summary appear

### Test Entity Sync
1. Go to Admin panel
2. Click "⚙ SYNC ENTITIES"
3. Wait for extraction
4. Check "INDEXED ENTITIES" count increased
5. Edit entity type, description
6. Generate dossier (Groq)

