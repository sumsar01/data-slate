import { Link } from "react-router-dom"
import { useDateGroups } from "../hooks/useDateGroups"
import { TimelineCard } from "../components/TimelineCard"
import type { DateGroup } from "../shared"

interface TimelineSession {
  session_id: string | null
  session_name: string | null
  session_summary: string | null
  dates: string[]
  notes: DateGroup["notes"]
}

function groupBySessions(groups: DateGroup[]): TimelineSession[] {
  const map = new Map<string, TimelineSession>()

  for (const g of groups) {
    const key = g.session_id ?? `__date__${g.date}`
    if (!map.has(key)) {
      map.set(key, {
        session_id: g.session_id,
        session_name: g.session_name,
        session_summary: g.session_summary,
        dates: [],
        notes: [],
      })
    }
    const s = map.get(key)!
    s.dates.push(g.date)
    s.notes.push(...g.notes)
  }

  // Sort newest first by earliest date in each session
  return Array.from(map.values()).sort((a, b) => {
    const aDate = [...a.dates].sort().reverse()[0] ?? ""
    const bDate = [...b.dates].sort().reverse()[0] ?? ""
    return bDate.localeCompare(aDate)
  })
}

export default function Timeline() {
  const { groups, loading } = useDateGroups()
  const sessions = groupBySessions(groups)

  return (
    <div className="tl-page">
      <div className="scanlines" aria-hidden />

      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">
            <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
            CAMPAIGN TIMELINE
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "RETRIEVING..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="tl-main">
        <div className="tl-panel-label">[ CAMPAIGN TIMELINE ]</div>

        {loading && sessions.length === 0 && (
          <div className="tl-empty">RETRIEVING RECORDS<span className="blink-cursor">_</span></div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="tl-empty">NO SESSIONS RECORDED</div>
        )}

        <div className="tl-list">
          {sessions.map((s, i) => (
            <TimelineCard
              key={s.session_id ?? s.dates[0]}
              session={s}
              isLast={i === sessions.length - 1}
            />
          ))}
        </div>
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        <span>SESSIONS: {sessions.length}</span>
      </footer>
    </div>
  )
}
