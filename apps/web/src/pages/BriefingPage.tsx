import { useState, useEffect } from "react"
import { Link, useParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import { toImperialDate } from "../utils/imperialDate"
import { useScrollablePage } from "../hooks/useScrollablePage"
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
  useScrollablePage()

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
            MISSION BRIEFING
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/timeline" className="app-export-btn">◈ TIMELINE</Link>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "GENERATING..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="brief-main">
        {loading && (
          <div className="brief-loading">
            <div className="brief-loading-text">INQUISITORIAL COGITATOR ACTIVATED<span className="blink-cursor">_</span></div>
            <div className="brief-loading-sub">Compiling situation report...</div>
          </div>
        )}

        {error && (
          <div className="brief-error">
            DATA ERROR: {error}<br />
            <span style={{ opacity: 0.6 }}>No sessions recorded, or cogitator unreachable.</span>
          </div>
        )}

        {data && (
          <div className="brief-document">
            <div className="brief-stamp">
              <div className="brief-stamp-top">INQUISITORIUM // ORDO HERETICUS</div>
              <div className="brief-stamp-seal">✦</div>
              <div className="brief-stamp-bottom">CLASSIFIED // ACOLYTE CLEARANCE</div>
            </div>

            <div className="brief-title-block">
              <div className="brief-doc-label">MISSION BRIEFING</div>
              <div className="brief-doc-title">
                {data.session_name ?? "ONGOING OPERATION"}
              </div>
              <div className="brief-doc-meta">
                IMPERIAL DATE: {toImperialDate(today)}
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
              <div>OMNISSIAH PROTECTS // CLASSIFIED DOCUMENT</div>
              <div>DESTROY AFTER READING // MACHINE-SPIRIT APPROVED</div>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        <span>IMPERIAL DATE: {toImperialDate(today)}</span>
      </footer>
    </div>
  )
}
