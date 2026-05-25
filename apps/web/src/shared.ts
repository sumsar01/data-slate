export type Tag =
  | "NPC"
  | "Location"
  | "Faction"
  | "Combat"
  | "Clue"
  | "Tech-Lore"
  | "Rumour"
  | "Item"
  | "Misc"

export const ALL_TAGS: Tag[] = [
  "NPC",
  "Location",
  "Faction",
  "Combat",
  "Clue",
  "Tech-Lore",
  "Rumour",
  "Item",
  "Misc",
]

export type EntityType = "NPC" | "Location" | "Faction" | "Item" | "Other"

export type Entity = {
  name: string
  type: EntityType
}

export type Note = {
  id: string
  date: string // YYYY-MM-DD
  title: string
  transcript: string
  audio_url: string | null
  duration_s: number
  tags: Tag[]
  entities: Entity[]
  reference?: boolean
  created_at: string
}

export type DateGroup = {
  date: string // YYYY-MM-DD
  session_id: string | null
  session_name: string | null
  session_summary: string | null
  session_cover_image_url?: string | null
  session_arc_id?: string | null
  session_arc_name?: string | null
  session_arc_color?: string | null
  notes: Note[]
}

export type SessionOverride = {
  id: string
  dates: string[]
  name: string
  cover_image_url?: string | null
  arc_id?: string | null
}

export type Arc = {
  id: string
  name: string
  color: string
  session_ids: string[]
}

export interface TimelineSession {
  session_id: string | null
  session_name: string | null
  session_summary: string | null
  session_cover_image_url?: string | null
  session_arc_id?: string | null
  session_arc_name?: string | null
  session_arc_color?: string | null
  dates: string[]
  notes: DateGroup["notes"]
  opusIndex?: number
}
