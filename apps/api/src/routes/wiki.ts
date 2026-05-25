import { Hono } from "hono"
import { db } from "../lib/db"
import { summariseEntity, extractRelations } from "../lib/groq"
import { uploadToR2, deleteFromR2 } from "../lib/r2"

// Levenshtein distance between two strings
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return dp[m][n]
}

// Find potential duplicates among entity names
function findDuplicates(entities: { id: string; name: string }[]): Array<{
  a: { id: string; name: string }
  b: { id: string; name: string }
  similarity: "HIGH" | "MEDIUM"
}> {
  const results: Array<{ a: { id: string; name: string }; b: { id: string; name: string }; similarity: "HIGH" | "MEDIUM" }> = []
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const a = entities[i].name.toLowerCase()
      const b = entities[j].name.toLowerCase()
      // Skip if one contains the other (likely a short alias vs full name)
      if (a.includes(b) || b.includes(a)) {
        // Only flag if the shorter one is ≥ 4 chars to avoid noise
        if (Math.min(a.length, b.length) >= 4) {
          results.push({ a: entities[i], b: entities[j], similarity: "HIGH" })
        }
        continue
      }
      const dist = levenshtein(a, b)
      const maxLen = Math.max(a.length, b.length)
      const ratio = 1 - dist / maxLen
      if (ratio >= 0.85) results.push({ a: entities[i], b: entities[j], similarity: "HIGH" })
      else if (ratio >= 0.70) results.push({ a: entities[i], b: entities[j], similarity: "MEDIUM" })
    }
  }
  return results
}

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
  // Add status column if table already existed without it
  try {
    await db.execute("ALTER TABLE entities ADD COLUMN status TEXT")
  } catch {
    // Column already exists — ignore
  }
  // Ensure entity_relations table exists
  await db.execute(`
    CREATE TABLE IF NOT EXISTS entity_relations (
      id TEXT PRIMARY KEY,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      relation_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL
    )
  `)
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

  // Collect all entity names for cross-linking
  const { rows: allEntities } = await db.execute(
    "SELECT id, name FROM entities WHERE canonical_id IS NULL"
  )

  // Fetch relations (both directions) for this entity
  const entityId = entity.id as string
  const { rows: relRows } = await db.execute({
    sql: `SELECT r.id, r.from_id, r.to_id, r.relation_type, r.source,
                 f.name as from_name, t.name as to_name
          FROM entity_relations r
          JOIN entities f ON f.id = r.from_id
          JOIN entities t ON t.id = r.to_id
          WHERE r.from_id = ?1 OR r.to_id = ?1`,
    args: [entityId],
  })

  const relations = relRows.map((r) => ({
    id: r.id as string,
    from_id: r.from_id as string,
    from_name: r.from_name as string,
    to_id: r.to_id as string,
    to_name: r.to_name as string,
    relation_type: r.relation_type as string,
    source: r.source as string,
  }))

  return c.json({
    entity,
    aliases: allNames.slice(1),
    mentions: mentionsWithSession,
    all_entities: allEntities.map((e) => ({ id: e.id as string, name: e.name as string })),
    relations,
  })
})

// PATCH /wiki/:id — edit name, type, description
wikiRouter.patch("/:id", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const body = await c.req.json<{ name?: string; type?: string; description?: string; status?: string | null }>()

  const fields: string[] = []
  const args: (string | null)[] = []
  if (body.name !== undefined) { fields.push("name = ?"); args.push(body.name) }
  if (body.type !== undefined) { fields.push("type = ?"); args.push(body.type) }
  if (body.description !== undefined) { fields.push("description = ?"); args.push(body.description) }
  if (body.status !== undefined) { fields.push("status = ?"); args.push(body.status ?? null) }

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

  // Find potential duplicates across all canonical entities
  const { rows: allEntities } = await db.execute(
    "SELECT id, name FROM entities WHERE canonical_id IS NULL"
  )
  const potential_duplicates = findDuplicates(
    allEntities.map((e) => ({ id: e.id as string, name: e.name as string }))
  )

  return c.json({ inserted, potential_duplicates })
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

  // Auto-extract relations from transcripts
  const { rows: allEntityRows } = await db.execute({
    sql: "SELECT id, name FROM entities WHERE canonical_id IS NULL AND id != ?1",
    args: [id],
  })
  const knownNames = allEntityRows.map((e) => e.name as string)
  try {
    const relations = await extractRelations(
      entity.name as string,
      entity.type as string,
      knownNames,
      excerpts
    )
    for (const rel of relations) {
      // Resolve names to ids
      const fromRow = allEntityRows.find((e) => (e.name as string).toLowerCase() === rel.from_name.toLowerCase())
        ?? (rel.from_name.toLowerCase() === (entity.name as string).toLowerCase() ? { id } : null)
      const toRow = allEntityRows.find((e) => (e.name as string).toLowerCase() === rel.to_name.toLowerCase())
        ?? (rel.to_name.toLowerCase() === (entity.name as string).toLowerCase() ? { id } : null)
      if (!fromRow || !toRow || fromRow.id === toRow.id) continue
      const fromId = typeof fromRow.id === "string" ? fromRow.id : fromRow.id as string
      const toId = typeof toRow.id === "string" ? toRow.id : toRow.id as string
      // Skip if this relation already exists
      const { rows: existing } = await db.execute({
        sql: "SELECT id FROM entity_relations WHERE from_id = ?1 AND to_id = ?2 AND relation_type = ?3",
        args: [fromId, toId, rel.relation_type],
      })
      if (existing.length) continue
      await db.execute({
        sql: "INSERT INTO entity_relations (id, from_id, to_id, relation_type, source, created_at) VALUES (?1, ?2, ?3, ?4, 'ai', ?5)",
        args: [crypto.randomUUID(), fromId, toId, rel.relation_type, new Date().toISOString()],
      })
    }
  } catch {
    // Relation extraction failure is non-fatal
  }

  return c.json({ summary })
})

// POST /wiki/relations — create a manual relation
wikiRouter.post("/relations", async (c) => {
  await ensureTable()
  const { from_id, to_id, relation_type } = await c.req.json<{ from_id: string; to_id: string; relation_type: string }>()
  if (!from_id || !to_id || !relation_type || from_id === to_id) return c.json({ error: "invalid" }, 400)
  const relId = crypto.randomUUID()
  await db.execute({
    sql: "INSERT INTO entity_relations (id, from_id, to_id, relation_type, source, created_at) VALUES (?1, ?2, ?3, ?4, 'manual', ?5)",
    args: [relId, from_id, to_id, relation_type, new Date().toISOString()],
  })
  return c.json({ id: relId, from_id, to_id, relation_type, source: "manual" })
})

// DELETE /wiki/relations/:id — remove a relation
wikiRouter.delete("/relations/:id", async (c) => {
  await ensureTable()
  const relId = c.req.param("id")
  await db.execute({ sql: "DELETE FROM entity_relations WHERE id = ?1", args: [relId] })
  return c.json({ ok: true })
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
