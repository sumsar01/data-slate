import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
import { linkEntities } from "../lib/linkEntities"
import "./Admin.css"
import "./Wiki.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

type WikiEntity = {
  id: string
  name: string
  type: string
  canonical_id: string | null
  description: string | null
  summary: string | null
  image_url: string | null
  status: string | null
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  VIVENDE:    "#4a7a4a",
  MORTIS:     "#8a2a2a",
  IGNOTUS:    "#3a2800",
  HOSTILIS:   "#8a3a00",
  FOEDERATUS: "#2a5a7a",
  INQUISITUS: "#5a3a7a",
}

const STATUS_LABELS: Record<string, string> = {
  VIVENDE:    "Alive",
  MORTIS:     "Deceased",
  IGNOTUS:    "Unknown",
  HOSTILIS:   "Hostile",
  FOEDERATUS: "Allied",
  INQUISITUS: "Under investigation",
}

type Mention = {
  note_id: string
  note_title: string
  date: string
  excerpt: string
  session_name: string | null
}

type Relation = {
  id: string
  from_id: string
  from_name: string
  to_id: string
  to_name: string
  relation_type: string
  source: string
}

type EntityDetail = {
  entity: WikiEntity
  aliases: string[]
  mentions: Mention[]
  all_entities: { id: string; name: string }[]
  relations: Relation[]
}

const INVERSE: Record<string, string> = {
  COMMANDS: "SUBORDINATE_TO",
  SUBORDINATE_TO: "COMMANDS",
  LEADS: "MEMBER_OF",
  MEMBER_OF: "LEADS",
  CONTROLS: "CONTROLLED_BY",
  ALLIED_WITH: "ALLIED_WITH",
  HOSTILE_TO: "HOSTILE_TO",
  INVESTIGATES: "INVESTIGATED_BY",
  AFFILIATED_WITH: "AFFILIATED_WITH",
  WITNESSED_AT: "HOST_OF",
  LOCATED_IN: "CONTAINS",
  OPERATES_FROM: "BASE_OF",
  OWNS: "OWNED_BY",
}

function inverseRelation(rel: string): string {
  return INVERSE[rel] ?? `← ${rel}`
}

export default function WikiPage({ byName }: { byName?: boolean }) {
  const { id, name } = useParams<{ id: string; name: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<EntityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: async fetch pattern, most setState calls happen in .then() callbacks
    setLoading(true)
    setNotFound(false)
    setDetail(null)

    if (byName && name) {
      // Look up by name first, then redirect to ID-based route
      fetch(`${API_URL}/wiki/by-name/${encodeURIComponent(name)}`)
        .then((r) => {
          if (r.status === 404) { setNotFound(true); return null }
          return r.json()
        })
        .then((entity) => {
          if (entity?.id) navigate(`/wiki/${entity.id}`, { replace: true })
          else setNotFound(true)
        })
        .catch(() => setNotFound(true))
        .finally(() => setLoading(false))
      return
    }

    if (!id) return
    fetch(`${API_URL}/wiki/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null }
        return r.json()
      })
      .then((data) => { if (data) setDetail(data) })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [id, name, byName, navigate])

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="scanlines" aria-hidden />
        <div className="admin-loading">ACCESSING ENTITY DOSSIER...</div>
      </div>
    )
  }

  if (notFound || !detail) {
    return (
      <div className="admin-shell">
        <div className="scanlines" aria-hidden />
        <header className="admin-header">
          <div className="admin-header-title">ENTITY NOT FOUND</div>
          <Link to="/wiki" className="admin-back-link">◄ WIKI</Link>
        </header>
        <main className="admin-main">
          <div className="wiki-empty">
            <div className="wiki-empty-text">DOSSIER NOT FOUND</div>
            <div className="wiki-empty-sub">This entity may not be indexed yet. Run SYNC ENTITIES from the admin panel.</div>
          </div>
        </main>
      </div>
    )
  }

  const { entity, aliases, mentions, all_entities, relations } = detail
  // Build entity list for linker, excluding self
  const linkableEntities = all_entities
    .filter((e) => e.id !== entity.id)
    .map((e) => ({ name: e.name, type: "Other" as const }))

  // Group mentions by session
  const sessionMap = new Map<string, { session_name: string | null; date: string; items: Mention[] }>()
  for (const m of mentions) {
    const key = m.session_name ?? m.date
    if (!sessionMap.has(key)) sessionMap.set(key, { session_name: m.session_name, date: m.date, items: [] })
    sessionMap.get(key)!.items.push(m)
  }

  return (
    <div className="admin-shell">
      <div className="scanlines" aria-hidden />

      <header className="admin-header">
        <div>
          <div className="admin-header-title">{entity.name.toUpperCase()}</div>
          <div className="admin-header-sub">
            {entity.type.toUpperCase()}
            {entity.status && (
              <span
                className="wiki-status-badge"
                style={{ color: STATUS_COLORS[entity.status] ?? "#7a5500", borderColor: STATUS_COLORS[entity.status] ?? "#7a5500" }}
                title={`${entity.status} — ${STATUS_LABELS[entity.status] ?? ""}`}
              >
                {entity.status}
              </span>
            )}
            {aliases.length > 0 && ` // ALSO KNOWN AS: ${aliases.join(", ")}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link to="/wiki" className="admin-back-link">◄ WIKI</Link>
          <Link to="/" className="admin-back-link">◄ LOG</Link>
        </div>
      </header>

      <main className="admin-main wiki-main">

        {/* Top section: text left, image right */}
        <section className="admin-section wiki-top-section">
          <div className="wiki-top-content">

            {/* Description */}
            {entity.description && (
              <div className="wiki-description-block">
                <div className="admin-section-title">[ FIELD NOTES ]</div>
                <div className="wiki-description">{linkEntities(entity.description, linkableEntities)}</div>
              </div>
            )}

            {/* Groq summary */}
            {entity.summary && (
              <div className="wiki-summary-block">
                <div className="admin-section-title">[ COGITATOR DOSSIER ]</div>
                <div className="wiki-summary">{linkEntities(entity.summary, linkableEntities)}</div>
              </div>
            )}

            {!entity.description && !entity.summary && (
              <div className="wiki-no-dossier">NO DOSSIER ON FILE</div>
            )}

          </div>

          {/* Image right column */}
          {entity.image_url && (
            <div className="wiki-image-col">
              <div className="wiki-image-box">
                <img src={entity.image_url} alt={entity.name} className="wiki-image" />
              </div>
              <div className="wiki-image-caption">[ PICT-CAPTURE // AUSPEX SCAN ]</div>
            </div>
          )}
        </section>

        {/* Stats + Timeline */}
        <section className="admin-section">
          <div className="admin-section-title">[ INTELLIGENCE REPORT ]</div>
          <div className="admin-row">
            <span className="admin-label">TRANSCRIPT MENTIONS</span>
            <span className="admin-value">{mentions.length}</span>
          </div>
          <div className="admin-row">
            <span className="admin-label">SESSIONS ACTIVE</span>
            <span className="admin-value">{sessionMap.size}</span>
          </div>
          {aliases.length > 0 && (
            <div className="admin-row">
              <span className="admin-label">ALIASES</span>
              <span className="admin-value">{aliases.join(", ")}</span>
            </div>
          )}

          {/* Session activity chart */}
          {sessionMap.size > 0 && (() => {
            const sessions = [...sessionMap.values()]
            const maxCount = Math.max(...sessions.map((s) => s.items.length), 1)
            const firstSeen = sessions[sessions.length - 1]?.session_name ?? sessions[sessions.length - 1]?.date ?? "—"
            const lastActive = sessions[0]?.session_name ?? sessions[0]?.date ?? "—"
            const peak = sessions.reduce((a, b) => a.items.length >= b.items.length ? a : b)
            const peakLabel = peak.session_name ?? peak.date
            return (
              <>
                <div className="admin-divider" />
                <div className="wiki-timeline-meta">
                  <span>FIRST SEEN: <span className="wiki-timeline-val">{firstSeen}</span></span>
                  <span>LAST ACTIVE: <span className="wiki-timeline-val">{lastActive}</span></span>
                  <span>PEAK: <span className="wiki-timeline-val">{peakLabel} ({peak.items.length})</span></span>
                </div>
                <div className="wiki-timeline-chart" aria-label="Session activity chart">
                  {[...sessions].reverse().map((s, i) => {
                    const count = s.items.length
                    const heightPct = (count / maxCount) * 100
                    const label = s.session_name ?? s.date
                    return (
                      <div key={i} className="wiki-timeline-bar-col">
                        <div className="wiki-timeline-count">{count > 0 ? count : ""}</div>
                        <div className="wiki-timeline-bar-wrap">
                          <div
                            className="wiki-timeline-bar"
                            style={{ height: count > 0 ? `${heightPct}%` : "2px", opacity: count > 0 ? 1 : 0.2 }}
                          />
                        </div>
                        <div className="wiki-timeline-label" title={label}>
                          {label.length > 8 ? label.slice(0, 8) + "…" : label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )
          })()}
        </section>

        {/* Known associations */}
        {relations.length > 0 && (
          <section className="admin-section">
            <div className="admin-section-title">[ KENDTE ASSOCIATIONER ]</div>
            <div className="wiki-relations-list">
              {relations.map((r) => {
                const isFrom = r.from_id === entity.id
                const otherName = isFrom ? r.to_name : r.from_name
                const otherId = all_entities.find((e) => e.name.toLowerCase() === otherName.toLowerCase())?.id
                const label = isFrom
                  ? r.relation_type
                  : inverseRelation(r.relation_type)
                return (
                  <div key={r.id} className="wiki-relation-row">
                    {otherId ? (
                      <Link to={`/wiki/${otherId}`} className="wiki-relation-target">
                        {otherName}
                      </Link>
                    ) : (
                      <span className="wiki-relation-target wiki-relation-target--nolink">{otherName}</span>
                    )}
                    <span className="wiki-relation-type">{label}</span>
                    {r.source === "ai" && <span className="wiki-relation-badge">AI</span>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Transcript excerpts by session */}
        {sessionMap.size > 0 && (
          <section className="admin-section">
            <div className="admin-section-title">[ TRANSCRIPT EXCERPTS ]</div>
            {[...sessionMap.values()].map((session, i) => (
              <div key={i} className="wiki-session-group">
                <div className="wiki-session-label">
                  {session.session_name ?? session.date}
                </div>
                {session.items.map((m) => (
                  <div key={m.note_id} className="wiki-excerpt">
                    <div className="wiki-excerpt-title">{m.note_title}</div>
                    <div className="wiki-excerpt-text">
                      {linkEntities(m.excerpt + (m.excerpt.length >= 300 ? "..." : ""), linkableEntities)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}

      </main>

      <footer className="admin-footer">
        OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL
      </footer>
    </div>
  )
}
