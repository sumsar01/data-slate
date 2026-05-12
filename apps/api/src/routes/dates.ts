import { Hono } from "hono"
import { db } from "../lib/db"
import type { DateGroup } from "../lib/types"

export const datesRouter = new Hono()

// GET /dates — returns DateGroup[] with session names and summaries merged in
datesRouter.get("/", async (c) => {
  const [notesResult, sessionsResult] = await Promise.all([
    db.execute("SELECT * FROM notes ORDER BY date ASC, created_at ASC"),
    db.execute("SELECT * FROM session_overrides"),
  ])

  // Build a map of date -> { session_id, session_name, session_summary }
  const sessionMap = new Map<string, { id: string; name: string; summary: string | null }>()
  for (const row of sessionsResult.rows) {
    const dates: string[] = JSON.parse(row.dates as string)
    for (const d of dates) {
      sessionMap.set(d, {
        id: row.id as string,
        name: row.name as string,
        summary: (row.summary as string | null) ?? null,
      })
    }
  }

  // Group notes by date
  const groups = new Map<string, DateGroup & { session_id: string | null; session_summary: string | null }>()
  for (const row of notesResult.rows) {
    const date = row.date as string
    if (!groups.has(date)) {
      const session = sessionMap.get(date) ?? null
      groups.set(date, {
        date,
        session_id: session?.id ?? null,
        session_name: session?.name ?? null,
        session_summary: session?.summary ?? null,
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
      entities: row.entities ? JSON.parse(row.entities as string) : [],
      created_at: row.created_at as string,
    })
  }

  return c.json(Array.from(groups.values()))
})
