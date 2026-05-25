import { Hono } from "hono"
import { db } from "../lib/db"
import { uploadToR2, deleteFromR2 } from "../lib/r2"
import { transcribeAudio, flavourTranscript, generateTitle, extractEntities } from "../lib/groq"
import { randomUUID } from "crypto"
import type { Tag } from "../lib/types"

export const notesRouter = new Hono()

// POST /notes — upload audio, transcribe, flavour, store
notesRouter.post("/", async (c) => {
  const formData = await c.req.formData()
  const audio = formData.get("audio") as File | null
  const date = formData.get("date") as string
  const duration_s = parseFloat(formData.get("duration_s") as string)
  const tagsRaw = formData.getAll("tags") as Tag[]

  if (!audio || !date || isNaN(duration_s)) {
    return c.json({ error: "Missing required fields: audio, date, duration_s" }, 400)
  }

  const referenceRaw = formData.get("reference") as string | null
  const reference = referenceRaw === "true" ? 1 : 0

  const id = randomUUID()
  const ext = audio.name?.endsWith(".mp4") ? "mp4" : "webm"
  const key = `audio/${id}.${ext}`

  const buffer = Buffer.from(await audio.arrayBuffer())

  // Upload to R2
  const audio_url = await uploadToR2(key, buffer, audio.type || "audio/webm")

  // Transcribe — get raw transcript + detected language
  const { transcript: rawTranscript, detectedLanguage } = await transcribeAudio(buffer, audio.name || `recording.${ext}`)

  // Flavour the transcript with in-world 40K terminology (keeps original language)
  const transcript = await flavourTranscript(rawTranscript, detectedLanguage)

  // Generate English title from the flavoured transcript
  const title = await generateTitle(transcript)

  const created_at = new Date().toISOString()
  const tags = JSON.stringify(tagsRaw)

  await db.execute({
    sql: `INSERT INTO notes (id, date, title, transcript, audio_url, duration_s, tags, created_at, reference)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [id, date, title, transcript, audio_url, duration_s, tags, created_at, reference],
  })

  // Fire-and-forget entity extraction on flavoured transcript
  ;(async () => {
    try {
      const entities = await extractEntities(transcript)
      await db.execute({
        sql: "UPDATE notes SET entities = ? WHERE id = ?",
        args: [JSON.stringify(entities), id],
      })
    } catch (e) {
      console.warn(`[WARN] Entity extraction failed for note ${id}:`, e)
    }
  })()

  return c.json({ id, date, title, transcript, audio_url, duration_s, tags: tagsRaw, reference: reference === 1, created_at }, 201)
})

// POST /notes/text — create a plain-text reference note (no audio)
notesRouter.post("/text", async (c) => {
  const body = await c.req.json<{ date: string; title: string; content: string; tags?: string[]; reference?: boolean }>()
  const { date, title, content, tags: tagsRaw = [], reference: referenceFlag = true } = body

  if (!date || !title || !content) {
    return c.json({ error: "Missing required fields: date, title, content" }, 400)
  }

  const id = randomUUID()
  const created_at = new Date().toISOString()
  const tags = JSON.stringify(tagsRaw)
  const reference = referenceFlag ? 1 : 0

  await db.execute({
    sql: `INSERT INTO notes (id, date, title, transcript, audio_url, duration_s, tags, created_at, reference)
          VALUES (?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
    args: [id, date, title, content, tags, created_at, reference],
  })

  // Fire-and-forget entity extraction
  ;(async () => {
    try {
      const entities = await extractEntities(content)
      await db.execute({
        sql: "UPDATE notes SET entities = ? WHERE id = ?",
        args: [JSON.stringify(entities), id],
      })
    } catch (e) {
      console.warn(`[WARN] Entity extraction failed for note ${id}:`, e)
    }
  })()

  return c.json({ id, date, title, transcript: content, audio_url: null, duration_s: 0, tags: tagsRaw, reference: referenceFlag, created_at }, 201)
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

// POST /notes/:id/entities — retry entity extraction for a note
notesRouter.post("/:id/entities", async (c) => {
  const id = c.req.param("id")
  const result = await db.execute({ sql: "SELECT transcript FROM notes WHERE id = ?", args: [id] })
  if (result.rows.length === 0) return c.json({ error: "Not found" }, 404)
  const transcript = (result.rows[0]!.transcript ?? "") as string
  if (!transcript) return c.json({ error: "No transcript" }, 422)

  const entities = await extractEntities(transcript)
  await db.execute({ sql: "UPDATE notes SET entities = ? WHERE id = ?", args: [JSON.stringify(entities), id] })
  return c.json({ id, entities })
})

// POST /notes/flavour-all — retroactively flavour all notes and re-extract entities
notesRouter.post("/flavour-all", async (c) => {
  const result = await db.execute("SELECT id, transcript FROM notes ORDER BY created_at ASC")
  const notes = result.rows

  let processed = 0
  let failed = 0

  for (const row of notes) {
    const noteId = row.id as string
    const rawTranscript = (row.transcript ?? "") as string
    if (!rawTranscript.trim()) continue

    try {
      // Flavour (tell Groq to detect language from text)
      const flavoured = await flavourTranscript(rawTranscript, "the original language of the text")
      // Generate English title
      const title = await generateTitle(flavoured)
      // Re-extract entities on flavoured text
      const entities = await extractEntities(flavoured)

      await db.execute({
        sql: "UPDATE notes SET transcript = ?, title = ?, entities = ? WHERE id = ?",
        args: [flavoured, title, JSON.stringify(entities), noteId],
      })
      processed++
    } catch (e) {
      console.warn(`[WARN] Flavour-all failed for note ${noteId}:`, e)
      failed++
    }
  }

  return c.json({ total: notes.length, processed, failed })
})

// POST /notes/retitle-all — regenerate titles for all notes using current generateTitle logic
// Returns immediately; processes in background
notesRouter.post("/retitle-all", async (c) => {
  const result = await db.execute("SELECT id, transcript FROM notes ORDER BY created_at ASC")
  const notes = result.rows

  // Fire and forget
  ;(async () => {
    let processed = 0
    let failed = 0
    for (const row of notes) {
      const noteId = row.id as string
      const transcript = (row.transcript ?? "") as string
      if (!transcript.trim()) continue
      try {
        const title = await generateTitle(transcript)
        await db.execute({ sql: "UPDATE notes SET title = ? WHERE id = ?", args: [title, noteId] })
        console.log(`[retitle-all] ${noteId}: ${title}`)
        processed++
      } catch (e) {
        console.warn(`[WARN] Retitle failed for note ${noteId}:`, e)
        failed++
      }
    }
    console.log(`[retitle-all] done — ${processed} processed, ${failed} failed`)
  })()

  return c.json({ status: "started", total: notes.length })
})

// PATCH /notes/:id — update editable fields
notesRouter.patch("/:id", async (c) => {
  const id = c.req.param("id")
  const body = await c.req.json()

  const updates: string[] = []
  const args: unknown[] = []

  const textFields = ["title", "date", "transcript"] as const
  const jsonFields = ["tags", "entities"] as const

  for (const field of textFields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      args.push(body[field])
    }
  }
  for (const field of jsonFields) {
    if (field in body) {
      updates.push(`${field} = ?`)
      args.push(JSON.stringify(body[field]))
    }
  }
  if (typeof body.reference === "boolean") {
    updates.push("reference = ?")
    args.push(body.reference ? 1 : 0)
  }

  if (updates.length === 0) return c.json({ error: "No valid fields to update" }, 400)

  args.push(id)
  await db.execute({ sql: `UPDATE notes SET ${updates.join(", ")} WHERE id = ?`, args })

  const result = await db.execute({ sql: "SELECT * FROM notes WHERE id = ?", args: [id] })
  if (result.rows.length === 0) return c.json({ error: "Not found" }, 404)
  return c.json(rowToNote(result.rows[0]))
})

// DELETE /notes/:id
notesRouter.delete("/:id", async (c) => {
  const id = c.req.param("id")
  const result = await db.execute({ sql: "SELECT audio_url FROM notes WHERE id = ?", args: [id] })
  if (result.rows.length === 0) return c.json({ error: "Not found" }, 404)
  const row = result.rows[0]!

  const audio_url = (row.audio_url ?? "") as string
  const publicBase = process.env.R2_PUBLIC_URL ?? ""
  const key = audio_url.startsWith(publicBase) ? audio_url.slice(publicBase.length + 1) : null

  await db.execute({ sql: "DELETE FROM notes WHERE id = ?", args: [id] })

  if (key) {
    try { await deleteFromR2(key) } catch (e) {
      console.warn(`[WARN] Failed to delete R2 object ${key}:`, e)
    }
  }

  return c.json({ deleted: id })
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
    entities: row.entities ? JSON.parse(row.entities as string) : [],
    reference: row.reference === 1,
    created_at: row.created_at,
  }
}
