import { Hono } from "hono"
import { db } from "../lib/db"
import { randomUUID } from "crypto"

export const sessionsRouter = new Hono()

// POST /sessions — create session override
sessionsRouter.post("/", async (c) => {
  const body = await c.req.json<{ name: string; dates: string[] }>()
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
