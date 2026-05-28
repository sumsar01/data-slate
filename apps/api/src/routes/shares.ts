import { Hono } from "hono"
import { db } from "../lib/db"
import { randomUUID } from "crypto"
import { rowToNote } from "../lib/mappers"

// Shared handler for public read-only share view
async function getSharedSession(c: any) {
  const token = c.req.param("token")

  const shareResult = await db.execute({
    sql: "SELECT * FROM shares WHERE token = ?",
    args: [token],
  })
  if (shareResult.rows.length === 0) return c.json({ error: "Share not found" }, 404)

  const share = shareResult.rows[0]!
  if (share.expires_at) {
    if (new Date(share.expires_at as string) < new Date()) {
      return c.json({ error: "Share link has expired" }, 410)
    }
  }

  const sessionId = share.session_id as string

  const sessionResult = await db.execute({
    sql: "SELECT * FROM session_overrides WHERE id = ?",
    args: [sessionId],
  })
  if (sessionResult.rows.length === 0) return c.json({ error: "Session not found" }, 404)

  const session = sessionResult.rows[0]!
  const dates: string[] = JSON.parse(session.dates as string)

  const placeholders = dates.map(() => "?").join(",")
  const notesResult = await db.execute({
    sql: `SELECT * FROM notes WHERE date IN (${placeholders}) ORDER BY date ASC, created_at ASC`,
    args: dates,
  })

  const groups: any[] = []
  const dateMap = new Map<string, any>()

  for (const date of dates) {
    const group = {
      date,
      session_id: sessionId,
      session_name: session.name as string | null,
      session_summary: (session.summary as string | null) ?? null,
      notes: [] as any[],
    }
    dateMap.set(date, group)
    groups.push(group)
  }

  for (const row of notesResult.rows) {
    const date = row.date as string
    if (dateMap.has(date)) {
      dateMap.get(date).notes.push(rowToNote(row))
    }
  }

  return c.json({
    session_name: session.name,
    groups: groups.filter((g) => g.notes.length > 0),
  })
}

// Public router — only the read-only share view, no auth required
export const publicSharesRouter = new Hono()
publicSharesRouter.get("/shared/:token", getSharedSession)

// Protected router — all share management endpoints
export const sharesRouter = new Hono()

// POST /shares — create a read-only share token for a session
sharesRouter.post("/", async (c) => {
  const body = await c.req.json<{ session_id: string; expires_in_days?: number }>()
  if (!body.session_id) return c.json({ error: "Missing session_id" }, 400)

  const session = await db.execute({
    sql: "SELECT id FROM session_overrides WHERE id = ?",
    args: [body.session_id],
  })
  if (session.rows.length === 0) return c.json({ error: "Session not found" }, 404)

  const id = randomUUID()
  const token = randomUUID().replace(/-/g, "")
  const created_at = new Date().toISOString()
  const expires_at = body.expires_in_days
    ? new Date(Date.now() + body.expires_in_days * 86400_000).toISOString()
    : null

  await db.execute({
    sql: "INSERT INTO shares (id, token, session_id, created_at, expires_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, token, body.session_id, created_at, expires_at],
  })

  return c.json({ id, token, session_id: body.session_id, created_at, expires_at }, 201)
})

// GET /shares — list all shares (for admin panel)
sharesRouter.get("/", async (c) => {
  const result = await db.execute(
    "SELECT s.*, so.name as session_name FROM shares s LEFT JOIN session_overrides so ON s.session_id = so.id ORDER BY s.created_at DESC"
  )
  return c.json(result.rows)
})

// DELETE /shares/:id — revoke a share
sharesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id")
  await db.execute({ sql: "DELETE FROM shares WHERE id = ?", args: [id] })
  return c.json({ deleted: id })
})

// GET /shares/shared/:token — also accessible via authenticated route
sharesRouter.get("/shared/:token", getSharedSession)
