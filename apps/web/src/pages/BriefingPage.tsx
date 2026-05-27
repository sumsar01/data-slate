import { useState, useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { toImperialDate } from "../utils/imperialDate"
import "./Briefing.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

type BriefingData = {
  session_id?: string
  session_name?: string | null
  session_ids?: string[]
  briefing: string
  dates?: string[]
}

export default function BriefingPage() {
  const { sessionId } = useParams<{ sessionId?: string }>()
  const [data, setData] = useState<BriefingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    setLoading(true)
    setError(null)
    setData(null)
    const url = sessionId
      ? `${API_URL}/briefing/${sessionId}`
      : `${API_URL}/briefing`
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [sessionId])

  return (
    <div className="brief-page">
      <div className="scanlines" aria-hidden />
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">
            <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
            MISSIONSBRIEFING
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/timeline" className="app-export-btn">◈ TIMELINE</Link>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "GENERERER..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="brief-main">
        {loading && (
          <div className="brief-loading">
            <div className="brief-loading-text">INQUISITORIEL COGITATOR AKTIVERET<span className="blink-cursor">_</span></div>
            <div className="brief-loading-sub">Kompilerer situationsrapport...</div>
          </div>
        )}

        {error && (
          <div className="brief-error">
            DATAFEJL: {error}<br />
            <span style={{ opacity: 0.6 }}>Ingen sessioner registreret, eller cogitator utilgængelig.</span>
          </div>
        )}

        {data && (
          <div className="brief-document">
            {/* Document header — Imperial stamp */}
            <div className="brief-stamp">
              <div className="brief-stamp-top">INQUISITORIUM // ORDO HERETICUS</div>
              <div className="brief-stamp-seal">✦</div>
              <div className="brief-stamp-bottom">KLASSIFICERET // AKOLYT-NIVEAU</div>
            </div>

            <div className="brief-title-block">
              <div className="brief-doc-label">MISSIONSBRIEFING</div>
              <div className="brief-doc-title">
                {data.session_name ?? "IGANGVÆRENDE OPERATION"}
              </div>
              <div className="brief-doc-meta">
                IMPERIEL DATO: {toImperialDate(today)}
                {data.dates && data.dates.length > 0 && (
                  <> // SESSION: {toImperialDate(data.dates[0])}</>
                )}
              </div>
            </div>

            <div className="brief-divider" />

            <div className="brief-content">
              <ReactMarkdown
                components={{
                  h2: ({ children }) => <h2 className="brief-section-heading">{children}</h2>,
                  p: ({ children }) => <p className="brief-para">{children}</p>,
                  ul: ({ children }) => <ul className="brief-list">{children}</ul>,
                  li: ({ children }) => <li className="brief-list-item">{children}</li>,
                }}
              >
                {data.briefing}
              </ReactMarkdown>
            </div>

            <div className="brief-divider" />

            <div className="brief-footer">
              <div>OMNISSIAH PROTECTS // KLASSIFICERET DOKUMENT</div>
              <div>DESTRUER EFTER LÆSNING // MACHINE-SPIRIT GODKENDT</div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        <span>IMPERIEL DATO: {toImperialDate(today)}</span>
      </footer>
    </div>
  )
}
