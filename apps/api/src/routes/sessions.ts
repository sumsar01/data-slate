import { Hono } from "hono"
import { db } from "../lib/db"
import { nameSession, summariseSession } from "../lib/groq"
import { uploadToR2 } from "../lib/r2"
import { randomUUID } from "crypto"

export const sessionsRouter = new Hono()

// Ensure columns exist (idempotent — ALTER TABLE IF NOT EXISTS not supported in SQLite,
// so we catch the "duplicate column" error and ignore it)
async function ensureColumns() {
  for (const sql of [
    "ALTER TABLE session_overrides ADD COLUMN cover_image_url TEXT",
    "ALTER TABLE session_overrides ADD COLUMN arc_id TEXT",
  ]) {
    try { await db.execute(sql) } catch { /* already exists */ }
  }
  try {
    await db.execute(
      "CREATE TABLE IF NOT EXISTS arcs (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#7a5500', session_ids TEXT NOT NULL DEFAULT '[]')"
    )
  } catch { /* already exists */ }
}
ensureColumns().catch(console.error)

// POST /sessions/auto — create session with Groq-generated name + summary
sessionsRouter.post("/auto", async (c) => {
  const body = await c.req.json<{ dates: string[] }>()
  if (!Array.isArray(body.dates) || body.dates.length === 0) {
    return c.json({ error: "Missing required field: dates" }, 400)
  }
  const dates: string[] = body.dates

  // Fetch transcripts for these dates
  const placeholders = dates.map(() => "?").join(",")
  const notesResult = await db.execute({
    sql: `SELECT transcript FROM notes WHERE date IN (${placeholders}) AND reference = 0 ORDER BY created_at ASC`,
    args: dates,
  })
  const transcripts = notesResult.rows
    .map((r) => (r.transcript as string) ?? "")
    .filter(Boolean)

  if (transcripts.length === 0) {
    return c.json({ error: "No transcripts found for these dates" }, 422)
  }

  // Generate name + summary in parallel
  const [name, summary] = await Promise.all([
    nameSession(transcripts),
    summariseSession(transcripts),
  ])

  const id = randomUUID()
  await db.execute({
    sql: "INSERT INTO session_overrides (id, name, dates, summary) VALUES (?, ?, ?, ?)",
    args: [id, name, JSON.stringify(dates), summary],
  })

  return c.json({ id, name, summary, dates }, 201)
})

// POST /sessions — create session override
sessionsRouter.post("/", async (c) => {
  if (!body.name || !Array.isArray(body.dates)) {
    return c.json({ error: "Missing required fields: name, dates" }, 400)
  }

  const id = randomUUID()
  await db.execute({
    sql: "INSERT INTO session_overrides (id, name, dates) VALUES (?, ?, ?)",
    args: [id, body.name, JSON.stringify(body.dates)],
  })

  return c.json({ id, name: body.name, dates: body.dates }, 201)
})

// PATCH /sessions/:id
sessionsRouter.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json<{ name?: string; dates?: string[] }>()

  const existing = await db.execute({ sql: "SELECT * FROM session_overrides WHERE id = ?", args: [id] })
  if (existing.rows.length === 0) return c.json({ error: "Not found" }, 404)

  const current = existing.rows[0]
  const name = body.name ?? (current.name as string)
  const dates = body.dates ? JSON.stringify(body.dates) : (current.dates as string)

  await db.execute({
    sql: "UPDATE session_overrides SET name = ?, dates = ? WHERE id = ?",
    args: [name, dates, id],
  })

  return c.json({ id, name, dates: JSON.parse(dates) })
})

// POST /sessions/:id/summary — generate and store session summary via Groq
sessionsRouter.post("/:id/summary", async (c) => {
  const id = c.req.param("id")

  const sessionResult = await db.execute({ sql: "SELECT * FROM session_overrides WHERE id = ?", args: [id] })
  if (sessionResult.rows.length === 0) return c.json({ error: "Session not found" }, 404)
  const session = sessionResult.rows[0]!
  const dates: string[] = JSON.parse(session.dates as string)

  // Fetch all notes for the dates in this session
  const placeholders = dates.map(() => "?").join(",")
  const notesResult = await db.execute({
    sql: `SELECT transcript FROM notes WHERE date IN (${placeholders}) AND reference = 0 ORDER BY created_at ASC`,
    args: dates,
  })

  const transcripts = notesResult.rows
    .map((r) => (r.transcript as string) ?? "")
    .filter(Boolean)

  if (transcripts.length === 0) {
    return c.json({ error: "No transcripts found for this session" }, 422)
  }

  const summary = await summariseSession(transcripts)

  await db.execute({
    sql: "UPDATE session_overrides SET summary = ? WHERE id = ?",
    args: [summary, id],
  })

  return c.json({ id, summary })
})

// POST /sessions/:id/cover — upload a cover image to R2
sessionsRouter.post("/:id/cover", async (c) => {
  const id = c.req.param("id")
  const existing = await db.execute({ sql: "SELECT id FROM session_overrides WHERE id = ?", args: [id] })
  if (existing.rows.length === 0) return c.json({ error: "Session not found" }, 404)

  const formData = await c.req.formData()
  const file = formData.get("file") as File | null
  if (!file) return c.json({ error: "Missing file field" }, 400)

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg"
  const key = `covers/${id}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  const url = await uploadToR2(key, buf, file.type || "image/jpeg")

  await db.execute({ sql: "UPDATE session_overrides SET cover_image_url = ? WHERE id = ?", args: [url, id] })
  return c.json({ id, cover_image_url: url })
})

// DELETE /sessions/:id/cover — remove cover image
sessionsRouter.delete("/:id/cover", async (c) => {
  const id = c.req.param("id")
  await db.execute({ sql: "UPDATE session_overrides SET cover_image_url = NULL WHERE id = ?", args: [id] })
  return c.json({ id, cover_image_url: null })
})

// ── Arc routes ────────────────────────────────────────────────────────────

// GET /sessions/arcs
sessionsRouter.get("/arcs", async (c) => {
  const result = await db.execute("SELECT * FROM arcs ORDER BY rowid ASC")
  return c.json(result.rows.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color,
    session_ids: JSON.parse(r.session_ids as string),
  })))
})

// POST /sessions/arcs
sessionsRouter.post("/arcs", async (c) => {
  const body = await c.req.json<{ name: string; color?: string; session_ids?: string[] }>()
  if (!body.name) return c.json({ error: "Missing required field: name" }, 400)
  const id = randomUUID()
  const color = body.color ?? "#7a5500"
  const session_ids = body.session_ids ?? []
  await db.execute({
    sql: "INSERT INTO arcs (id, name, color, session_ids) VALUES (?, ?, ?, ?)",
    args: [id, body.name, color, JSON.stringify(session_ids)],
  })
  // Update arc_id on affected sessions
  for (const sid of session_ids) {
    await db.execute({ sql: "UPDATE session_overrides SET arc_id = ? WHERE id = ?", args: [id, sid] })
  }
  return c.json({ id, name: body.name, color, session_ids }, 201)
})

// PATCH /sessions/arcs/:arcId
sessionsRouter.patch("/arcs/:arcId", async (c) => {
  const arcId = c.req.param("arcId")
  const body = await c.req.json<{ name?: string; color?: string; session_ids?: string[] }>()
  const existing = await db.execute({ sql: "SELECT * FROM arcs WHERE id = ?", args: [arcId] })
  if (existing.rows.length === 0) return c.json({ error: "Arc not found" }, 404)
  const cur = existing.rows[0]
  const name = body.name ?? (cur.name as string)
  const color = body.color ?? (cur.color as string)
  const oldIds: string[] = JSON.parse(cur.session_ids as string)
  const newIds = body.session_ids ?? oldIds
  await db.execute({ sql: "UPDATE arcs SET name = ?, color = ?, session_ids = ? WHERE id = ?", args: [name, color, JSON.stringify(newIds), arcId] })
  // Sync arc_id on sessions
  for (const sid of oldIds) {
    if (!newIds.includes(sid)) await db.execute({ sql: "UPDATE session_overrides SET arc_id = NULL WHERE id = ?", args: [sid] })
  }
  for (const sid of newIds) {
    await db.execute({ sql: "UPDATE session_overrides SET arc_id = ? WHERE id = ?", args: [arcId, sid] })
  }
  return c.json({ id: arcId, name, color, session_ids: newIds })
})

// DELETE /sessions/arcs/:arcId
sessionsRouter.delete("/arcs/:arcId", async (c) => {
  const arcId = c.req.param("arcId")
  await db.execute({ sql: "UPDATE session_overrides SET arc_id = NULL WHERE arc_id = ?", args: [arcId] })
  await db.execute({ sql: "DELETE FROM arcs WHERE id = ?", args: [arcId] })
  return c.json({ deleted: arcId })
})
