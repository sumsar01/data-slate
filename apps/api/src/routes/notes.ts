import { Hono } from "hono"
import { db } from "../lib/db"
import { uploadToR2 } from "../lib/r2"
import { transcribeAudio } from "../lib/groq"
import { randomUUID } from "crypto"
import type { Tag } from "../lib/types"

export const notesRouter = new Hono()

// POST /notes — upload audio, transcribe, store
notesRouter.post("/", async (c) => {
  const formData = await c.req.formData()
  const audio = formData.get("audio") as File | null
  const date = formData.get("date") as string
  const duration_s = parseFloat(formData.get("duration_s") as string)
  const tagsRaw = formData.getAll("tags") as Tag[]

  if (!audio || !date || isNaN(duration_s)) {
    return c.json({ error: "Missing required fields: audio, date, duration_s" }, 400)
  }

  const id = randomUUID()
  const key = `audio/${id}.webm`

  const buffer = Buffer.from(await audio.arrayBuffer())

  // Upload to R2
  const audio_url = await uploadToR2(key, buffer, audio.type || "audio/webm")

  // Transcribe
  const { transcript, title } = await transcribeAudio(buffer, audio.name || "recording.webm")

  const created_at = new Date().toISOString()
  const tags = JSON.stringify(tagsRaw)

  await db.execute({
    sql: `INSERT INTO notes (id, date, title, transcript, audio_url, duration_s, tags, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, date, title, transcript, audio_url, duration_s, tags, created_at],
  })

  return c.json({ id, date, title, transcript, audio_url, duration_s, tags: tagsRaw, created_at }, 201)
})

// GET /notes
notesRouter.get("/", async (c) => {
  const result = await db.execute("SELECT * FROM notes ORDER BY created_at DESC")
  const notes = result.rows.map(rowToNote)
  return c.json(notes)
})

// GET /notes/:id
notesRouter.get("/:id", async (c) => {
  const id = c.req.param("id")
  const result = await db.execute({ sql: "SELECT * FROM notes WHERE id = ?", args: [id] })
  if (result.rows.length === 0) return c.json({ error: "Not found" }, 404)
  return c.json(rowToNote(result.rows[0]))
})

function rowToNote(row: any) {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    transcript: row.transcript,
    audio_url: row.audio_url,
    duration_s: row.duration_s,
    tags: JSON.parse(row.tags as string),
    created_at: row.created_at,
  }
}
