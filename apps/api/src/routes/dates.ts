import { Hono } from "hono"
import { db } from "../lib/db"
import type { DateGroup } from "../lib/types"

export const datesRouter = new Hono()

// GET /dates — returns DateGroup[] with session names merged in
datesRouter.get("/", async (c) => {
  const [notesResult, sessionsResult] = await Promise.all([
    db.execute("SELECT * FROM notes ORDER BY date ASC, created_at ASC"),
    db.execute("SELECT * FROM session_overrides"),
  ])

  // Build a map of date -> session_name
  const sessionMap = new Map<string, string>()
  for (const row of sessionsResult.rows) {
    const dates: string[] = JSON.parse(row.dates as string)
    for (const d of dates) {
      sessionMap.set(d, row.name as string)
    }
  }

  // Group notes by date
  const groups = new Map<string, DateGroup>()
  for (const row of notesResult.rows) {
    const date = row.date as string
    if (!groups.has(date)) {
      groups.set(date, {
        date,
        session_name: sessionMap.get(date) ?? null,
        notes: [],
      })
    }
    groups.get(date)!.notes.push({
      id: row.id as string,
      date: row.date as string,
      title: row.title as string,
      transcript: row.transcript as string,
      audio_url: row.audio_url as string | null,
      duration_s: row.duration_s as number,
      tags: JSON.parse(row.tags as string),
      created_at: row.created_at as string,
    })
  }

  return c.json(Array.from(groups.values()))
})
