import { Hono } from "hono"
import { db } from "../lib/db"
import { summariseEntity } from "../lib/groq"
import { uploadToR2, deleteFromR2 } from "../lib/r2"

export const wikiRouter = new Hono()

// Ensure entities table exists with all columns
async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS entities (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      canonical_id TEXT,
      description TEXT,
      summary TEXT,
      image_url TEXT,
      created_at TEXT NOT NULL
    )
  `)
  // Add image_url column if table already existed without it
  try {
    await db.execute("ALTER TABLE entities ADD COLUMN image_url TEXT")
  } catch {
    // Column already exists — ignore
  }
}

// GET /wiki — list all canonical entities
wikiRouter.get("/", async (c) => {
  await ensureTable()
  const { rows } = await db.execute(
    "SELECT * FROM entities WHERE canonical_id IS NULL ORDER BY type, name"
  )
  return c.json(rows)
})

// GET /wiki/by-name/:name — lookup entity by name (for pill navigation)
wikiRouter.get("/by-name/:name", async (c) => {
  await ensureTable()
  const name = decodeURIComponent(c.req.param("name"))
  // Look up by name or as alias pointing to canonical
  const { rows } = await db.execute({
    sql: "SELECT * FROM entities WHERE lower(name) = lower(?1) LIMIT 1",
    args: [name],
  })
  if (!rows.length) return c.json({ error: "not found" }, 404)
  const entity = rows[0]
  // If it's an alias, follow to canonical
  if (entity.canonical_id) {
    const { rows: canonical } = await db.execute({
      sql: "SELECT * FROM entities WHERE id = ?1",
      args: [entity.canonical_id as string],
    })
    if (canonical.length) return c.json(canonical[0])
  }
  return c.json(entity)
})

// Extract a context window from a transcript around the first mention of any of the given names
function extractExcerpt(transcript: string, names: string[]): string {
  const lower = transcript.toLowerCase()
  let bestIdx = -1
  for (const name of names) {
    const idx = lower.indexOf(name.toLowerCase())
    if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx
  }
  if (bestIdx === -1) return transcript.slice(0, 300).trim()
  const start = Math.max(0, bestIdx - 100)
  const end = Math.min(transcript.length, bestIdx + 300)
  const prefix = start > 0 ? "..." : ""
  const suffix = end < transcript.length ? "..." : ""
  return prefix + transcript.slice(start, end).trim() + suffix
}

// GET /wiki/:id — entity detail with note excerpts
wikiRouter.get("/:id", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const { rows } = await db.execute({
    sql: "SELECT * FROM entities WHERE id = ?1",
    args: [id],
  })
  if (!rows.length) return c.json({ error: "not found" }, 404)
  let entity = rows[0]

  // Follow canonical redirect
  if (entity.canonical_id) {
    const { rows: canonical } = await db.execute({
      sql: "SELECT * FROM entities WHERE id = ?1",
      args: [entity.canonical_id as string],
    })
    if (canonical.length) entity = canonical[0]
  }

  // Collect all aliases for this entity
  const { rows: aliases } = await db.execute({
    sql: "SELECT name FROM entities WHERE canonical_id = ?1",
    args: [entity.id as string],
  })
  const aliasNames = aliases.map((a) => (a.name as string).toLowerCase())
  const allNames = [entity.name as string, ...aliases.map((a) => a.name as string)]

  // Find all notes that mention this entity (or any alias)
  const { rows: allNotes } = await db.execute(
    "SELECT id, date, title, transcript, entities FROM notes ORDER BY date DESC"
  )

  const mentions: Array<{
    note_id: string
    note_title: string
    date: string
    excerpt: string
    session_name?: string | null
  }> = []

  const sessionDates = new Set<string>()

  for (const note of allNotes) {
    let noteEntities: Array<{ name: string; type: string }> = []
    try {
      noteEntities = JSON.parse((note.entities as string) ?? "[]")
    } catch {
      noteEntities = []
    }

    const matched = noteEntities.some((e) =>
      allNames.some((n) => n.toLowerCase() === e.name.toLowerCase())
    )

    if (matched) {
      sessionDates.add(note.date as string)
      const excerpt = extractExcerpt((note.transcript as string) ?? "", allNames)
      mentions.push({
        note_id: note.id as string,
        note_title: note.title as string,
        date: note.date as string,
        excerpt,
      })
    }
  }

  // Get session info for the dates
  const { rows: sessions } = await db.execute(
    "SELECT id, name, dates FROM session_overrides"
  )
  const dateToSession = new Map<string, string>()
  for (const s of sessions) {
    let dates: string[] = []
    try { dates = JSON.parse(s.dates as string) } catch { dates = [] }
    for (const d of dates) dateToSession.set(d, s.name as string)
  }

  // Attach session names to mentions
  const mentionsWithSession = mentions.map((m) => ({
    ...m,
    session_name: dateToSession.get(m.date) ?? null,
  }))

  return c.json({
    entity,
    aliases: allNames.slice(1),
    mentions: mentionsWithSession,
  })
})

// PATCH /wiki/:id — edit name, type, description
wikiRouter.patch("/:id", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const body = await c.req.json<{ name?: string; type?: string; description?: string }>()

  const fields: string[] = []
  const args: (string | null)[] = []
  if (body.name !== undefined) { fields.push("name = ?"); args.push(body.name) }
  if (body.type !== undefined) { fields.push("type = ?"); args.push(body.type) }
  if (body.description !== undefined) { fields.push("description = ?"); args.push(body.description) }

  if (!fields.length) return c.json({ error: "nothing to update" }, 400)

  args.push(id)
  // Build parameterised query manually (Turso uses ?1, ?2... style)
  const paramFields = fields.map((f, i) => f.replace("?", `?${i + 1}`)).join(", ")
  const paramArgs = args.map((a) => a)

  await db.execute({ sql: `UPDATE entities SET ${paramFields} WHERE id = ?${args.length}`, args: paramArgs })
  const { rows } = await db.execute({ sql: "SELECT * FROM entities WHERE id = ?1", args: [id] })
  return c.json(rows[0] ?? null)
})

// POST /wiki/sync — upsert entities from all notes (idempotent)
wikiRouter.post("/sync", async (c) => {
  await ensureTable()

  const { rows: notes } = await db.execute("SELECT id, entities FROM notes")
  let inserted = 0

  for (const note of notes) {
    let entities: Array<{ name: string; type: string }> = []
    try { entities = JSON.parse((note.entities as string) ?? "[]") } catch { entities = [] }

    for (const e of entities) {
      if (!e.name || !e.type) continue
      // Check if entity with this name already exists
      const { rows: existing } = await db.execute({
        sql: "SELECT id FROM entities WHERE lower(name) = lower(?1)",
        args: [e.name],
      })
      if (existing.length) continue
      const id = crypto.randomUUID()
      await db.execute({
        sql: "INSERT INTO entities (id, name, type, canonical_id, description, summary, created_at) VALUES (?1, ?2, ?3, NULL, NULL, NULL, ?4)",
        args: [id, e.name, e.type, new Date().toISOString()],
      })
      inserted++
    }
  }

  return c.json({ inserted })
})

// POST /wiki/merge — merge drop_id into keep_id
wikiRouter.post("/merge", async (c) => {
  await ensureTable()
  const { keep_id, drop_id } = await c.req.json<{ keep_id: string; drop_id: string }>()
  if (!keep_id || !drop_id || keep_id === drop_id) return c.json({ error: "invalid ids" }, 400)

  // Point drop to keep as canonical
  await db.execute({
    sql: "UPDATE entities SET canonical_id = ?1 WHERE id = ?2",
    args: [keep_id, drop_id],
  })
  // Also reroute any existing aliases that pointed to drop
  await db.execute({
    sql: "UPDATE entities SET canonical_id = ?1 WHERE canonical_id = ?2",
    args: [keep_id, drop_id],
  })

  return c.json({ ok: true })
})

// POST /wiki/:id/summary — generate Groq summary (admin only)
wikiRouter.post("/:id/summary", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const { rows } = await db.execute({ sql: "SELECT * FROM entities WHERE id = ?1", args: [id] })
  if (!rows.length) return c.json({ error: "not found" }, 404)
  const entity = rows[0]

  // Collect all alias names
  const { rows: aliases } = await db.execute({
    sql: "SELECT name FROM entities WHERE canonical_id = ?1",
    args: [id],
  })
  const allNames = [entity.name as string, ...aliases.map((a) => a.name as string)]

  // Gather transcript excerpts
  const { rows: notes } = await db.execute(
    "SELECT transcript, entities FROM notes ORDER BY date ASC"
  )
  const excerpts: string[] = []
  for (const note of notes) {
    let noteEntities: Array<{ name: string }> = []
    try { noteEntities = JSON.parse((note.entities as string) ?? "[]") } catch {}
    const matched = noteEntities.some((e) =>
      allNames.some((n) => n.toLowerCase() === e.name.toLowerCase())
    )
    if (matched && note.transcript) {
      excerpts.push(note.transcript as string)
    }
  }

  if (!excerpts.length) return c.json({ error: "no transcript data for this entity" }, 400)

  const summary = await summariseEntity(entity.name as string, entity.type as string, excerpts)

  await db.execute({
    sql: "UPDATE entities SET summary = ?1 WHERE id = ?2",
    args: [summary, id],
  })

  return c.json({ summary })
})

// POST /wiki/:id/image — upload image to R2
wikiRouter.post("/:id/image", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const { rows } = await db.execute({ sql: "SELECT * FROM entities WHERE id = ?1", args: [id] })
  if (!rows.length) return c.json({ error: "not found" }, 404)
  const entity = rows[0]

  const formData = await c.req.formData()
  const file = formData.get("image") as File | null
  if (!file) return c.json({ error: "no image provided" }, 400)

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const key = `wiki/images/${id}.${ext}`

  // Delete old image from R2 if exists
  if (entity.image_url) {
    const publicBase = process.env.R2_PUBLIC_URL ?? ""
    const oldKey = (entity.image_url as string).replace(`${publicBase}/`, "")
    try { await deleteFromR2(oldKey) } catch { /* ignore */ }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const image_url = await uploadToR2(key, buffer, file.type || "image/jpeg")

  await db.execute({
    sql: "UPDATE entities SET image_url = ?1 WHERE id = ?2",
    args: [image_url, id],
  })

  return c.json({ image_url })
})

// DELETE /wiki/:id/image — remove image
wikiRouter.delete("/:id/image", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const { rows } = await db.execute({ sql: "SELECT image_url FROM entities WHERE id = ?1", args: [id] })
  if (!rows.length) return c.json({ error: "not found" }, 404)

  const image_url = rows[0].image_url as string | null
  if (image_url) {
    const publicBase = process.env.R2_PUBLIC_URL ?? ""
    const key = image_url.replace(`${publicBase}/`, "")
    try { await deleteFromR2(key) } catch { /* ignore */ }
  }

  await db.execute({ sql: "UPDATE entities SET image_url = NULL WHERE id = ?1", args: [id] })
  return c.json({ ok: true })
})
