import { Hono } from "hono"
import { db } from "../lib/db"
import { extractClues } from "../lib/groq"

export const cluesRouter = new Hono()

async function ensureTable() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clues (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      priority INTEGER NOT NULL DEFAULT 2,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS clue_notes (
      clue_id TEXT NOT NULL,
      note_id TEXT NOT NULL,
      PRIMARY KEY (clue_id, note_id)
    )
  `)
}

// POST /clues/suggest/:sessionId — scan session transcripts and return lead suggestions (does not save)
cluesRouter.post("/suggest/:sessionId", async (c) => {
  await ensureTable()
  const sessionId = c.req.param("sessionId")

  // Resolve session dates
  const { rows: sessionRows } = await db.execute({
    sql: "SELECT dates FROM session_overrides WHERE id = ?1",
    args: [sessionId],
  })
  if (!sessionRows.length) return c.json({ error: "Session not found" }, 404)

  let dates: string[] = []
  try { dates = JSON.parse(sessionRows[0].dates as string) } catch {}
  dates = dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
  if (!dates.length) return c.json({ suggestions: [] })

  // Fetch transcripts for this session
  // placeholders are positional (?1, ?2...) — values passed separately via args, not interpolated
  const placeholders = dates.map((_, i) => `?${i + 1}`).join(",")
  const safePlaceholders = placeholders.replace(/[^?,\d]/g, "") // strip anything not ?, digit, or comma
  const { rows: notes } = await db.execute({
    sql: `SELECT transcript FROM notes WHERE date IN (${safePlaceholders}) AND transcript IS NOT NULL ORDER BY created_at ASC`,
    args: dates,
  })

  const transcripts = notes.map((n) => n.transcript as string).filter(Boolean)
  if (!transcripts.length) return c.json({ suggestions: [] })

  const suggestions = await extractClues(transcripts)
  return c.json({ suggestions })
})

// GET /clues — list all clues with linked note count
cluesRouter.get("/", async (c) => {
  await ensureTable()
  const { rows } = await db.execute(`
    SELECT c.id, c.title, c.description, c.status, c.priority, c.created_at, c.updated_at,
           COUNT(cn.note_id) as linked_notes
    FROM clues c
    LEFT JOIN clue_notes cn ON cn.clue_id = c.id
    GROUP BY c.id
    ORDER BY c.priority ASC, c.created_at DESC
  `)
  return c.json(rows)
})

// POST /clues — create clue
cluesRouter.post("/", async (c) => {
  await ensureTable()
  const body = await c.req.json<{ title: string; description?: string; status?: string; priority?: number }>()
  if (!body.title) return c.json({ error: "title required" }, 400)
  const id = crypto.randomUUID()
  const now = new Date().toISOString()
  await db.execute({
    sql: "INSERT INTO clues (id, title, description, status, priority, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
    args: [id, body.title, body.description ?? null, body.status ?? "ACTIVE", body.priority ?? 2, now, now],
  })
  const { rows } = await db.execute({ sql: "SELECT * FROM clues WHERE id = ?1", args: [id] })
  return c.json(rows[0], 201)
})

// GET /clues/:id — detail with linked notes
cluesRouter.get("/:id", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const { rows } = await db.execute({ sql: "SELECT * FROM clues WHERE id = ?1", args: [id] })
  if (!rows.length) return c.json({ error: "not found" }, 404)

  const { rows: noteRows } = await db.execute({
    sql: `SELECT n.id, n.title, n.date FROM notes n
          JOIN clue_notes cn ON cn.note_id = n.id
          WHERE cn.clue_id = ?1
          ORDER BY n.date DESC`,
    args: [id],
  })

  return c.json({ ...rows[0], notes: noteRows })
})

// PATCH /clues/:id — update
cluesRouter.patch("/:id", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  const body = await c.req.json<{ title?: string; description?: string; status?: string; priority?: number }>()

  const fields: string[] = []
  const args: (string | number | null)[] = []
  if (body.title !== undefined) { fields.push(`title = ?${args.length + 1}`); args.push(body.title) }
  if (body.description !== undefined) { fields.push(`description = ?${args.length + 1}`); args.push(body.description ?? null) }
  if (body.status !== undefined) { fields.push(`status = ?${args.length + 1}`); args.push(body.status) }
  if (body.priority !== undefined) { fields.push(`priority = ?${args.length + 1}`); args.push(body.priority) }

  if (!fields.length) return c.json({ error: "nothing to update" }, 400)

  fields.push(`updated_at = ?${args.length + 1}`)
  args.push(new Date().toISOString())
  args.push(id)

  await db.execute({ sql: `UPDATE clues SET ${fields.join(", ")} WHERE id = ?${args.length}`, args })
  const { rows } = await db.execute({ sql: "SELECT * FROM clues WHERE id = ?1", args: [id] })
  return c.json(rows[0] ?? null)
})

// DELETE /clues/:id
cluesRouter.delete("/:id", async (c) => {
  await ensureTable()
  const id = c.req.param("id")
  await db.execute({ sql: "DELETE FROM clue_notes WHERE clue_id = ?1", args: [id] })
  await db.execute({ sql: "DELETE FROM clues WHERE id = ?1", args: [id] })
  return c.json({ ok: true })
})

// POST /clues/:id/notes — link a note
cluesRouter.post("/:id/notes", async (c) => {
  await ensureTable()
  const clueId = c.req.param("id")
  const { note_id } = await c.req.json<{ note_id: string }>()
  if (!note_id) return c.json({ error: "note_id required" }, 400)
  try {
    await db.execute({
      sql: "INSERT OR IGNORE INTO clue_notes (clue_id, note_id) VALUES (?1, ?2)",
      args: [clueId, note_id],
    })
  } catch {
    // Already linked — ignore
  }
  return c.json({ ok: true })
})

// DELETE /clues/:id/notes/:noteId — unlink
cluesRouter.delete("/:id/notes/:noteId", async (c) => {
  await ensureTable()
  const clueId = c.req.param("id")
  const noteId = c.req.param("noteId")
  await db.execute({
    sql: "DELETE FROM clue_notes WHERE clue_id = ?1 AND note_id = ?2",
    args: [clueId, noteId],
  })
  return c.json({ ok: true })
})
