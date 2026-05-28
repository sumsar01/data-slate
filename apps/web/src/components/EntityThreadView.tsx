import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import type { TimelineSession, EntityType } from '@data-slate/shared'

interface EntityThreadViewProps {
  sessions: TimelineSession[]
}

interface EntityRow {
  name: string
  type: EntityType
  counts: number[] // one per session slot
}

const TYPE_ORDER: EntityType[] = ["NPC", "Location", "Faction", "Item", "Other"]

const TYPE_COLORS: Record<EntityType, { node: string; connector: string; label: string; badge: string }> = {
  NPC:      { node: "#ffb000", connector: "#ffb00066", label: "#c88800",  badge: "#7a5500"  },
  Location: { node: "#4a9a4a", connector: "#4a9a4a66", label: "#4a9a4a",  badge: "#1a4a1a"  },
  Faction:  { node: "#b04ab0", connector: "#b04ab066", label: "#b04ab0",  badge: "#4a1a4a"  },
  Item:     { node: "#4a8aaa", connector: "#4a8aaa66", label: "#4a8aaa",  badge: "#1a3a4a"  },
  Other:    { node: "#7a5500", connector: "#7a550066", label: "#7a5500",  badge: "#3a2800"  },
}

function abbreviateSessionName(name: string | null, index: number): string {
  if (!name) return `S${index + 1}`
  // Take first significant word, max 8 chars
  const words = name.split(/[\s·\-—]+/).filter(Boolean)
  return words[0]?.substring(0, 8).toUpperCase() ?? `S${index + 1}`
}

export function EntityThreadView({ sessions }: EntityThreadViewProps) {
  const navigate = useNavigate()
  const [typeFilter, setTypeFilter] = useState<EntityType | null>(null)
  // Sessions in chronological order for columns (oldest first)
  const chronological = [...sessions].reverse()

  // Build entity rows: collect all entities with per-session mention counts
  const entityMap = new Map<string, EntityRow>()
  for (let si = 0; si < chronological.length; si++) {
    const s = chronological[si]
    const counts = new Map<string, number>()
    for (const note of s.notes) {
      for (const e of note.entities ?? []) {
        const key = `${e.type}::${e.name}`
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    for (const [key, count] of counts) {
      if (!entityMap.has(key)) {
        const [type, ...nameParts] = key.split("::")
        entityMap.set(key, {
          name: nameParts.join("::"),
          type: type as EntityType,
          counts: new Array(chronological.length).fill(0),
        })
      }
      entityMap.get(key)!.counts[si] = count
    }
  }

  // Group rows by type, sorted by total mention count desc
  const rowsByType = new Map<EntityType, EntityRow[]>()
  for (const type of TYPE_ORDER) rowsByType.set(type, [])
  for (const row of entityMap.values()) {
    const t = TYPE_ORDER.includes(row.type) ? row.type : "Other"
    rowsByType.get(t)!.push(row)
  }
  for (const [, rows] of rowsByType) {
    rows.sort((a, b) => b.counts.reduce((s, v) => s + v, 0) - a.counts.reduce((s, v) => s + v, 0))
  }

  const totalEntities = entityMap.size

  return (
    <div className="tl-thread-view">
      {/* Type filter bar */}
      <div className="tl-thread-filter-bar">
        <button
          className={`tl-thread-filter-btn ${typeFilter === null ? "tl-thread-filter-btn--active" : ""}`}
          onClick={() => setTypeFilter(null)}
        >ALLE</button>
        {TYPE_ORDER.map(t => (
          <button
            key={t}
            className={`tl-thread-filter-btn ${typeFilter === t ? "tl-thread-filter-btn--active" : ""}`}
            style={typeFilter === t ? { color: TYPE_COLORS[t].node, borderColor: TYPE_COLORS[t].node } : {}}
            onClick={() => setTypeFilter(t === typeFilter ? null : t)}
          >{t}</button>
        ))}
      </div>

      {/* Column headers */}
      <div className="tl-thread-header">
        <div className="tl-thread-entity-col" />
        <div className="tl-thread-session-cols">
          {chronological.map((s, i) => (
            <div
              key={s.session_id ?? i}
              className="tl-thread-session-label"
              title={s.session_name ?? undefined}
              onClick={() => navigate(`/?date=${[...s.dates].sort()[0]}`)}
            >
              {abbreviateSessionName(s.session_name, i)}
            </div>
          ))}
        </div>
      </div>

      {/* Entity rows grouped by type */}
      {TYPE_ORDER.filter(t => typeFilter === null || t === typeFilter).map(type => {
        const rows = rowsByType.get(type) ?? []
        if (rows.length === 0) return null
        const colors = TYPE_COLORS[type]
        return (
          <div key={type} className="tl-thread-type-group">
            <div className="tl-thread-type-header" style={{ color: colors.label }}>
              {type.toUpperCase()}
            </div>
            {rows.map(row => {
              // Find span: first and last active session
              const firstActive = row.counts.findIndex(c => c > 0)
              const lastActive = row.counts.reduce((last, c, i) => c > 0 ? i : last, -1)

              return (
                <div key={`${row.type}::${row.name}`} className="tl-thread-row">
                  <div className="tl-thread-entity-col">
                    <Link
                      to={`/wiki/name/${encodeURIComponent(row.name)}`}
                      className="tl-thread-entity-name"
                      style={{ color: colors.label }}
                      title={`Open ${row.name} in wiki`}
                    >
                      {row.name}
                    </Link>
                  </div>
                  <div className="tl-thread-session-cols">
                    {row.counts.map((count, ci) => {
                      const active = count > 0
                      // Draw connector if there's an active node ahead
                      const showConnector = active && ci < lastActive
                      const showBackConnector = active && ci > firstActive
                      return (
                        <div key={ci} className="tl-thread-cell">
                          {(showConnector || showBackConnector) && (
                            <div
                              className="tl-thread-connector"
                              style={{ background: colors.connector }}
                            />
                          )}
                          {/* Inactive faint node */}
                          {!active && (
                            <div className="tl-thread-node tl-thread-node--faint" />
                          )}
                          {active && (
                            <div
                              className="tl-thread-node"
                              title={`${row.name} — ${count} mention${count !== 1 ? "s" : ""}`}
                              style={{ borderColor: colors.node, boxShadow: `0 0 5px ${colors.node}66` }}
                            >
                              {count > 1 && (
                                <span
                                  className="tl-thread-count"
                                  style={{ color: colors.badge }}
                                >{count}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })}

      {totalEntities === 0 && (
        <div className="tl-thread-empty">INGEN ENTITETER REGISTRERET</div>
      )}

      <div className="tl-thread-footer">
        ENTITETER: {totalEntities} · SESSIONER: {chronological.length}
      </div>
    </div>
  )
}
