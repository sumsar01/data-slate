import type { DateGroup, Entity, EntityType } from "../shared"
import "./EntityIndex.css"

const TYPE_ORDER: EntityType[] = ["NPC", "Location", "Faction", "Item", "Other"]

interface Props {
  groups: DateGroup[]
  onFilter: (entityName: string) => void
}

export function EntityIndex({ groups, onFilter }: Props) {
  // Collect all unique entities across all notes
  const entityMap = new Map<string, { entity: Entity; count: number }>()
  for (const group of groups) {
    for (const note of group.notes) {
      for (const e of note.entities ?? []) {
        const key = `${e.type}::${e.name.toLowerCase()}`
        if (entityMap.has(key)) {
          entityMap.get(key)!.count++
        } else {
          entityMap.set(key, { entity: e, count: 1 })
        }
      }
    }
  }

  if (entityMap.size === 0) return null

  // Group by type
  const byType = new Map<EntityType, Array<{ entity: Entity; count: number }>>()
  for (const [, v] of entityMap) {
    const t = v.entity.type as EntityType
    if (!byType.has(t)) byType.set(t, [])
    byType.get(t)!.push(v)
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
            {byType.get(type)!.map(({ entity, count }) => (
              <button
                key={entity.name}
                className="entity-pill"
                onClick={() => onFilter(entity.name)}
                title={`Search for ${entity.name}`}
              >
                {entity.name}
                {count > 1 && <span className="entity-pill-count">{count}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
