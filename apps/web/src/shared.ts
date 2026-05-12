export type Tag =
  | "NPC"
  | "Location"
  | "Combat"
  | "Clue"
  | "Tech-Lore"
  | "Rumour"
  | "Item"
  | "Misc"

export const ALL_TAGS: Tag[] = [
  "NPC",
  "Location",
  "Combat",
  "Clue",
  "Tech-Lore",
  "Rumour",
  "Item",
  "Misc",
]

export type Note = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  transcript: string
  audio_url: string | null
  duration_s: number
  tags: Tag[]
  created_at: string
}

export type DateGroup = {
  date: string // YYYY-MM-DD
  session_id: string | null
  session_name: string | null
  session_summary: string | null
  notes: Note[]
}

export type SessionOverride = {
  id: string
  dates: string[]
  name: string
}
