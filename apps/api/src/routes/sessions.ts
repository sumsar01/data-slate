import { Hono } from "hono"
import { db } from "../lib/db"
import { nameSession, summariseSession } from "../lib/groq"
import { randomUUID } from "crypto"

export const sessionsRouter = new Hono()

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
    sql: `SELECT transcript FROM notes WHERE date IN (${placeholders}) ORDER BY created_at ASC`,
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
    sql: `SELECT transcript FROM notes WHERE date IN (${placeholders}) ORDER BY created_at ASC`,
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
