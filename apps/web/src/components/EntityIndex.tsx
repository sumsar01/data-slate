import { useNavigate } from "react-router-dom"
import type { DateGroup, EntityType } from "../shared"
import "./EntityIndex.css"

const TYPE_ORDER: EntityType[] = ["NPC", "Location", "Faction", "Item", "Other"]

interface Props {
  groups: DateGroup[]
}

export function EntityIndex({ groups }: Props) {
  const navigate = useNavigate()

  // Collect all unique entities across all notes
  const entityMap = new Map<string, { name: string; type: EntityType; count: number }>()
  for (const group of groups) {
    for (const note of group.notes) {
      for (const e of note.entities ?? []) {
        const key = `${e.type}::${e.name.toLowerCase()}`
        if (entityMap.has(key)) {
          entityMap.get(key)!.count++
        } else {
          entityMap.set(key, { name: e.name, type: e.type as EntityType, count: 1 })
        }
      }
    }
  }

  if (entityMap.size === 0) return null

  // Group by type
  const byType = new Map<EntityType, Array<{ name: string; type: EntityType; count: number }>>()
  for (const [, v] of entityMap) {
    if (!byType.has(v.type)) byType.set(v.type, [])
    byType.get(v.type)!.push(v)
  }
  // Sort each group by count desc
  for (const [, arr] of byType) arr.sort((a, b) => b.count - a.count)

  return (
    <div className="entity-index">
      <div className="entity-index-label">[ ENTITY INDEX ]</div>
      {TYPE_ORDER.filter((t) => byType.has(t)).map((type) => (
        <div key={type} className="entity-group">
          <div className="entity-group-type">{type}</div>
          <div className="entity-group-items">
            {byType.get(type)!.map(({ name, count }) => (
              <button
                key={name}
                className="entity-pill"
                onClick={() => navigate(`/wiki/name/${encodeURIComponent(name)}`)}
                title={`View ${name} in wiki`}
              >
                {name}
                {count > 1 && <span className="entity-pill-count">{count}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
