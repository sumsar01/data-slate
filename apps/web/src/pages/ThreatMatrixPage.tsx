import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { EntityGraph } from "../shared"
import { ThreatGraph } from "../components/ThreatGraph"
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
  VIVENDE:    "I live",
  MORTIS:     "Afdød",
  IGNOTUS:    "Ukendt",
  HOSTILIS:   "Fjendtlig",
  FOEDERATUS: "Allieret",
  INQUISITUS: "Efterforsket",
}

export default function ThreatMatrixPage() {
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
            TRUSSELSVURDERING
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/wiki" className="app-export-btn">◈ WIKI</Link>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "KOMPILERER..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="tm-main">
        {/* Legend */}
        <div className="tm-legend">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <span key={status} className="tm-legend-item">
              <span className="tm-legend-dot" style={{ background: color }} />
              {STATUS_LABELS[status] ?? status}
            </span>
          ))}
          <span className="tm-legend-sep">|</span>
          <span className="tm-legend-item"><span className="tm-shape-circle" /> NPC</span>
          <span className="tm-legend-item"><span className="tm-shape-rect" /> LOKATION</span>
          <span className="tm-legend-item"><span className="tm-shape-diamond" /> FRAKTION</span>
          <span className="tm-legend-item"><span className="tm-shape-tri" /> GENSTAND</span>
          <span className="tm-legend-sep">|</span>
          <span className="tm-legend-tip">TRÆK for at flytte · KLIK for dossier · SCROLL for zoom</span>
        </div>

        {loading && (
          <div className="tm-state">
            KOMPILERER TRUSSELSVURDERING<span className="blink-cursor">_</span>
          </div>
        )}

        {error && (
          <div className="tm-state tm-state--error">DATAFEJL: {error}</div>
        )}

        {graph && graph.nodes.length === 0 && (
          <div className="tm-state">INGEN ENTITETER REGISTRERET</div>
        )}

        {graph && graph.nodes.length > 0 && (
          <div className="tm-graph-wrap">
            <div className="tm-graph-label">
              [ {graph.nodes.length} ENTITETER // {graph.edges.length} FORBINDELSER ]
            </div>
            <ThreatGraph nodes={graph.nodes} edges={graph.edges} />
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        {graph && (
          <span>ENTITETER: {graph.nodes.length} // RELATIONER: {graph.edges.length}</span>
        )}
      </footer>
    </div>
  )
}
