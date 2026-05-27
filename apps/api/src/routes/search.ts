import { Hono } from "hono"
import { db } from "../lib/db"

export const searchRouter = new Hono()

// GET /search?q=&tags=&entity_id=
// Full-text search across note transcripts and titles
searchRouter.get("/", async (c) => {
  const q = (c.req.query("q") ?? "").trim()
  const tags = c.req.query("tags") // comma-separated
  const entityId = c.req.query("entity_id")

  if (!q && !tags && !entityId) {
    return c.json({ results: [] })
  }

  // Build base query — fetch all notes with relevant fields
  const { rows: notes } = await db.execute(
    "SELECT id, date, title, transcript, tags, entities FROM notes ORDER BY date DESC"
  )

  // Resolve entity name filter if entity_id provided
  let entityNames: string[] = []
  if (entityId) {
    const { rows: entRows } = await db.execute({
      sql: "SELECT name FROM entities WHERE id = ?1 OR canonical_id = ?1",
      args: [entityId],
    })
    entityNames = entRows.map((r) => (r.name as string).toLowerCase())
  }

  const tagFilter = tags ? tags.split(",").map((t) => t.trim()).filter(Boolean) : []
  const qLower = q.toLowerCase()

  const results: Array<{
    id: string
    date: string
    title: string
    excerpt: string
    tags: string[]
  }> = []

  for (const note of notes) {
    const transcript = (note.transcript as string) ?? ""
    const title = (note.title as string) ?? ""
    let noteTags: string[] = []
    try { noteTags = JSON.parse((note.tags as string) ?? "[]") } catch { noteTags = [] }

    // Tag filter
    if (tagFilter.length > 0 && !tagFilter.some((t) => noteTags.includes(t))) continue

    // Entity filter
    if (entityNames.length > 0) {
      let noteEntities: Array<{ name: string }> = []
      try { noteEntities = JSON.parse((note.entities as string) ?? "[]") } catch {}
      const matched = noteEntities.some((e) =>
        entityNames.includes(e.name.toLowerCase())
      )
      if (!matched) continue
    }

    // Text search
    if (q) {
      const inTitle = title.toLowerCase().includes(qLower)
      const transcriptLower = transcript.toLowerCase()
      const idx = transcriptLower.indexOf(qLower)
      if (!inTitle && idx === -1) continue

      // Build excerpt around the match
      let excerpt = ""
      if (idx !== -1) {
        const start = Math.max(0, idx - 80)
        const end = Math.min(transcript.length, idx + q.length + 120)
        excerpt = (start > 0 ? "…" : "") + transcript.slice(start, end).trim() + (end < transcript.length ? "…" : "")
      } else {
        excerpt = transcript.slice(0, 200).trim() + (transcript.length > 200 ? "…" : "")
      }

      results.push({ id: note.id as string, date: note.date as string, title, excerpt, tags: noteTags })
    } else {
      // No text query — just tag/entity filter match
      const excerpt = transcript.slice(0, 200).trim() + (transcript.length > 200 ? "…" : "")
      results.push({ id: note.id as string, date: note.date as string, title, excerpt, tags: noteTags })
    }
  }

  // Get session names for the matched dates
  const { rows: sessions } = await db.execute("SELECT name, dates FROM session_overrides")
  const dateToSession = new Map<string, string>()
  for (const s of sessions) {
    let dates: string[] = []
    try { dates = JSON.parse(s.dates as string) } catch {}
    for (const d of dates) dateToSession.set(d, s.name as string)
  }

  const enriched = results.map((r) => ({
    ...r,
    session_name: dateToSession.get(r.date) ?? null,
  }))

  return c.json({ results: enriched })
})
