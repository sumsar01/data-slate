import { Hono } from "hono"
import { db } from "../lib/db"
import { generateBriefing } from "../lib/groq"

export const briefingRouter = new Hono()

// GET /briefing/:sessionId — generate briefing for a specific session
briefingRouter.get("/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId")

  // Fetch session info
  const { rows: sessionRows } = await db.execute({
    sql: "SELECT id, name, dates, summary FROM session_overrides WHERE id = ?1",
    args: [sessionId],
  })
  if (!sessionRows.length) return c.json({ error: "Session not found" }, 404)
  const session = sessionRows[0]

  let dates: string[] = []
  try { dates = JSON.parse(session.dates as string) } catch {}
  // Sanitize dates — only allow YYYY-MM-DD format strings
  dates = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))

  // Fetch notes for this session — use parameterized placeholders (?1, ?2, ...) for Turso
  const notePlaceholders = dates.map((_, i) => `?${i + 1}`).join(",")
  const { rows: notes } = dates.length
    ? await db.execute({
        sql: `SELECT transcript, entities FROM notes WHERE date IN (${notePlaceholders}) ORDER BY created_at ASC`,
        args: dates,
      })
    : { rows: [] }

  // Collect all entities mentioned in this session
  const entityNamesInSession = new Set<string>()
  for (const note of notes) {
    let ents: Array<{ name: string }> = []
    try { ents = JSON.parse((note.entities as string) ?? "[]") } catch {}
    for (const e of ents) entityNamesInSession.add(e.name.toLowerCase())
  }

  // Fetch canonical entity details for those entities
  const { rows: allEntities } = await db.execute(
    "SELECT name, type, status, description FROM entities WHERE canonical_id IS NULL"
  )
  const activeEntities = allEntities.filter((e) =>
    entityNamesInSession.has((e.name as string).toLowerCase())
  ).map((e) => ({
    name: e.name as string,
    type: e.type as string,
    status: e.status as string | null,
    description: e.description as string | null,
  }))

  const sessionSummaries = session.summary ? [session.summary as string] : []
  const recentNotes = notes.map((n) => (n.transcript as string) ?? "").filter(Boolean)

  const briefing = await generateBriefing({
    sessionName: session.name as string | null,
    sessionSummaries,
    activeEntities,
    recentNotes,
  })

  return c.json({
    session_id: sessionId,
    session_name: session.name as string | null,
    dates,
    briefing,
  })
})

// GET /briefing — generate briefing from the most recent sessions (up to 3)
briefingRouter.get("/", async (c) => {
  // Get the 3 most recent sessions
  const { rows: sessions } = await db.execute(
    "SELECT id, name, dates, summary FROM session_overrides ORDER BY rowid DESC LIMIT 3"
  )

  if (!sessions.length) return c.json({ error: "No sessions found" }, 404)

  // Collect all dates across these sessions — sanitize to YYYY-MM-DD only
  const allDates: string[] = []
  for (const s of sessions) {
    let dates: string[] = []
    try { dates = JSON.parse(s.dates as string) } catch {}
    allDates.push(...dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d))))
  }

  // Fetch notes — use parameterized placeholders (?1, ?2, ...) for Turso
  const notePlaceholders = allDates.map((_, i) => `?${i + 1}`).join(",")
  const { rows: notes } = allDates.length
    ? await db.execute({
        sql: `SELECT transcript, entities FROM notes WHERE date IN (${notePlaceholders}) ORDER BY created_at ASC`,
        args: allDates,
      })
    : { rows: [] }

  // Collect entity names
  const entityNamesInSessions = new Set<string>()
  for (const note of notes) {
    let ents: Array<{ name: string }> = []
    try { ents = JSON.parse((note.entities as string) ?? "[]") } catch {}
    for (const e of ents) entityNamesInSessions.add(e.name.toLowerCase())
  }

  const { rows: allEntities } = await db.execute(
    "SELECT name, type, status, description FROM entities WHERE canonical_id IS NULL"
  )
  const activeEntities = allEntities.filter((e) =>
    entityNamesInSessions.has((e.name as string).toLowerCase())
  ).map((e) => ({
    name: e.name as string,
    type: e.type as string,
    status: e.status as string | null,
    description: e.description as string | null,
  }))

  const sessionSummaries = sessions
    .map((s) => s.summary as string | null)
    .filter((s): s is string => !!s)

  const recentNotes = notes.map((n) => (n.transcript as string) ?? "").filter(Boolean)

  const briefing = await generateBriefing({
    sessionName: (sessions[0].name as string | null) ?? null,
    sessionSummaries,
    activeEntities,
    recentNotes,
  })

  return c.json({
    session_ids: sessions.map((s) => s.id as string),
    briefing,
  })
})
