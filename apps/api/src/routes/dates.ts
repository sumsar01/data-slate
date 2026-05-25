import { Hono } from "hono"
import { db } from "../lib/db"
import type { DateGroup } from "../lib/types"

export const datesRouter = new Hono()

// GET /dates — returns DateGroup[] with session names, summaries, cover images and arc info merged in
datesRouter.get("/", async (c) => {
  const [notesResult, sessionsResult, arcsResult] = await Promise.all([
    db.execute("SELECT * FROM notes ORDER BY date ASC, created_at ASC"),
    db.execute("SELECT * FROM session_overrides"),
    db.execute("SELECT * FROM arcs").catch(() => ({ rows: [] })),
  ])

  // Build arc map by id
  const arcMap = new Map<string, { name: string; color: string }>()
  for (const row of arcsResult.rows) {
    arcMap.set(row.id as string, { name: row.name as string, color: row.color as string })
  }

  // Build a map of date -> session info
  const sessionMap = new Map<string, {
    id: string; name: string; summary: string | null
    cover_image_url: string | null
    arc_id: string | null; arc_name: string | null; arc_color: string | null
  }>()
  for (const row of sessionsResult.rows) {
    const dates: string[] = JSON.parse(row.dates as string)
    const arc_id = (row.arc_id as string | null) ?? null
    const arc = arc_id ? arcMap.get(arc_id) : null
    for (const d of dates) {
      sessionMap.set(d, {
        id: row.id as string,
        name: row.name as string,
        summary: (row.summary as string | null) ?? null,
        cover_image_url: (row.cover_image_url as string | null) ?? null,
        arc_id,
        arc_name: arc?.name ?? null,
        arc_color: arc?.color ?? null,
      })
    }
  }

  // Group notes by date
  const groups = new Map<string, any>()
  for (const row of notesResult.rows) {
    const date = row.date as string
    if (!groups.has(date)) {
      const session = sessionMap.get(date) ?? null
      groups.set(date, {
        date,
        session_id: session?.id ?? null,
        session_name: session?.name ?? null,
        session_summary: session?.summary ?? null,
        session_cover_image_url: session?.cover_image_url ?? null,
        session_arc_id: session?.arc_id ?? null,
        session_arc_name: session?.arc_name ?? null,
        session_arc_color: session?.arc_color ?? null,
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
