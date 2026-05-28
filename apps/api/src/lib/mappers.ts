import type { Note } from "@data-slate/shared"
import type { Row } from "@libsql/client"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToNote(row: Row | Record<string, any>): Note {
  return {
    id: row.id as string,
    date: row.date as string,
    title: row.title as string,
    transcript: row.transcript as string,
    audio_url: row.audio_url as string | null,
    duration_s: row.duration_s as number,
    tags: JSON.parse(row.tags as string),
    entities: row.entities ? JSON.parse(row.entities as string) : [],
    reference: row.reference === 1 || row.reference === true,
    created_at: row.created_at as string,
  }
}
