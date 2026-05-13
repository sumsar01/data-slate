import { useState, useEffect } from "react"
import { Link, useParams, useNavigate } from "react-router-dom"
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
  created_at: string
}

type Mention = {
  note_id: string
  note_title: string
  date: string
  excerpt: string
  session_name: string | null
}

type EntityDetail = {
  entity: WikiEntity
  aliases: string[]
  mentions: Mention[]
}

export default function WikiPage({ byName }: { byName?: boolean }) {
  const { id, name } = useParams<{ id: string; name: string }>()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<EntityDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
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
  }, [id, name, byName])

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

  const { entity, aliases, mentions } = detail

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
            {aliases.length > 0 && ` // ALSO KNOWN AS: ${aliases.join(", ")}`}
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link to="/wiki" className="admin-back-link">◄ WIKI</Link>
          <Link to="/" className="admin-back-link">◄ LOG</Link>
        </div>
      </header>

      <main className="admin-main wiki-main">

        {/* Description */}
        {entity.description && (
          <section className="admin-section">
            <div className="admin-section-title">[ FIELD NOTES ]</div>
            <div className="wiki-description">{entity.description}</div>
          </section>
        )}

        {/* Groq summary */}
        {entity.summary && (
          <section className="admin-section wiki-summary-section">
            <div className="admin-section-title">[ COGITATOR DOSSIER ]</div>
            <div className="wiki-summary">{entity.summary}</div>
          </section>
        )}

        {/* Stats */}
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
        </section>

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
                      {m.excerpt}{m.excerpt.length >= 300 ? "..." : ""}
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
