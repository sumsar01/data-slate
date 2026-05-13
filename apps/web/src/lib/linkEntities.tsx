import { Link } from "react-router-dom"
import type { Entity } from "../shared"

/**
 * Splits `text` into an array of plain strings and React <Link> elements
 * wherever an entity name appears (case-insensitive, whole-word match).
 */
export function linkEntities(text: string, entities: Entity[]): React.ReactNode[] {
  if (!entities.length) return [text]

  // Sort longest-first so "Iron Warriors" matches before "Iron"
  const sorted = [...entities].sort((a, b) => b.name.length - a.name.length)

  // Build a single regex alternation
  const pattern = sorted
    .map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")
  const regex = new RegExp(`(${pattern})`, "gi")

  const parts = text.split(regex)

  return parts.map((part, i) => {
    const match = sorted.find((e) => e.name.toLowerCase() === part.toLowerCase())
    if (match) {
      return (
        <Link
          key={i}
          to={`/wiki/name/${encodeURIComponent(match.name)}`}
          className="entity-link"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </Link>
      )
    }
    return part
  })
}
