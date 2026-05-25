import { useState, useEffect } from "react"
import { Link, useNavigate } from "react-router-dom"
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

const TYPE_ORDER = ["NPC", "Location", "Faction", "Item", "Other"]

export default function Wiki() {
  const [entities, setEntities] = useState<WikiEntity[]>([])
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetch(`${API_URL}/wiki`)
      .then((r) => r.json())
      .then((data: WikiEntity[]) => {
        setEntities(data)
        setEmpty(data.length === 0)
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false))
  }, [])

  const byType = new Map<string, WikiEntity[]>()
  for (const e of entities) {
    if (!byType.has(e.type)) byType.set(e.type, [])
    byType.get(e.type)!.push(e)
  }

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="scanlines" aria-hidden />
        <div className="admin-loading">ACCESSING ENTITY COGITATOR...</div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <div className="scanlines" aria-hidden />

      <header className="admin-header">
        <div>
          <div className="admin-header-title">DATA-SLATE MK.IV // CAMPAIGN WIKI</div>
          <div className="admin-header-sub">ADEPTUS MECHANICUS // ENTITY INDEX</div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link to="/admin-mechanicus" className="admin-back-link">⚙ ADMIN</Link>
          <Link to="/" className="admin-back-link">◄ LOG</Link>
        </div>
      </header>

      <main className="admin-main wiki-main">
        {empty ? (
          <div className="wiki-empty">
            <div className="wiki-empty-text">NO ENTITIES INDEXED</div>
            <div className="wiki-empty-sub">Run SYNC ENTITIES from the admin panel to populate the wiki</div>
          </div>
        ) : (
          TYPE_ORDER.filter((t) => byType.has(t)).map((type) => (
            <section key={type} className="admin-section">
              <div className="admin-section-title">[ {type.toUpperCase()} ]</div>
              <div className="wiki-entity-grid">
                {byType.get(type)!.map((entity) => (
                  <button
                    key={entity.id}
                    className="wiki-entity-card"
                    onClick={() => navigate(`/wiki/${entity.id}`)}
                  >
                    <span className="wiki-entity-card-name">{entity.name}</span>
                    {entity.status && (
                      <span
                        className="wiki-entity-card-status"
                        style={{ color: STATUS_COLORS[entity.status] ?? "#3a2800" }}
                        title={entity.status}
                      >
                        {entity.status}
                      </span>
                    )}
                    {entity.summary && <span className="wiki-entity-card-dot" title="Has dossier" />}
                  </button>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="admin-footer">
        OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL // ENTITIES: {entities.length}
      </footer>
    </div>
  )
}
