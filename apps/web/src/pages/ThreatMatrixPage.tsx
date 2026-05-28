import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { EntityGraph } from '@data-slate/shared'
import { ThreatGraph } from "../components/ThreatGraph"
import { useScrollablePage } from "../hooks/useScrollablePage"
import "./ThreatMatrix.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

const STATUS_COLORS: Record<string, string> = {
  VIVENDE:    "#4a7a4a",
  MORTIS:     "#8a2a2a",
  IGNOTUS:    "#3a5800",
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
  INQUISITUS: "Investigated",
}

export default function ThreatMatrixPage() {
  useScrollablePage()

  const [graph, setGraph] = useState<EntityGraph | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API_URL}/wiki/graph`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setGraph(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="tm-page">
      <div className="scanlines" aria-hidden />
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">
            <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
            THREAT ASSESSMENT
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/wiki" className="app-export-btn">◈ WIKI</Link>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "COMPILING..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="tm-main">
        <div className="tm-legend">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="tm-legend-item">
              <span className="tm-legend-dot" style={{ background: color }} />
              {STATUS_LABELS[status] ?? status}
            </span>
          ))}
          <span className="tm-legend-sep">|</span>
          <span className="tm-legend-item"><span className="tm-shape-circle" /> NPC</span>
          <span className="tm-legend-item"><span className="tm-shape-rect" /> LOCATION</span>
          <span className="tm-legend-item"><span className="tm-shape-diamond" /> FACTION</span>
          <span className="tm-legend-item"><span className="tm-shape-tri" /> ITEM</span>
          <span className="tm-legend-sep">|</span>
          <span className="tm-legend-tip">DRAG to reposition · CLICK for dossier · SCROLL to zoom</span>
        </div>

        {loading && (
          <div className="tm-state">
            COMPILING THREAT ASSESSMENT<span className="blink-cursor">_</span>
          </div>
        )}

        {error && (
          <div className="tm-state tm-state--error">DATA ERROR: {error}</div>
        )}

        {graph && graph.nodes.length === 0 && (
          <div className="tm-state">NO ENTITIES REGISTERED</div>
        )}

        {graph && graph.nodes.length > 0 && (
          <div className="tm-graph-wrap">
            <div className="tm-graph-label">
              [ {graph.nodes.length} ENTITIES // {graph.edges.length} CONNECTIONS ]
            </div>
            <ThreatGraph nodes={graph.nodes} edges={graph.edges} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        {graph && (
          <span>ENTITIES: {graph.nodes.length} // RELATIONS: {graph.edges.length}</span>
        )}
      </footer>
    </div>
  )
}
