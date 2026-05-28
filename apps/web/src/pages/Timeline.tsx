import { useState, useCallback } from "react"
import { Link } from "react-router-dom"
import { useDateGroups } from "../hooks/useDateGroups"
import { TimelineCard } from "../components/TimelineCard"
import { EntityThreadView } from "../components/EntityThreadView"
import { ArcManager } from "../components/ArcManager"
import { fetchArcs } from "../data/api"
import type { DateGroup, TimelineSession, Arc } from "../shared"

interface ArcGroup {
  arc_id: string | null
  arc_name: string | null
  arc_color: string | null
  sessions: TimelineSession[]
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
        session_cover_image_url: g.session_cover_image_url,
        session_arc_id: g.session_arc_id,
        session_arc_name: g.session_arc_name,
        session_arc_color: g.session_arc_color,
        dates: [],
        notes: [],
      })
    }
    const s = map.get(key)!
    s.dates.push(g.date)
    s.notes.push(...g.notes)
  }

  // Sort newest first by latest date in each session, then assign opus indices (oldest=1)
  const sorted = Array.from(map.values()).sort((a, b) => {
    const aDate = [...a.dates].sort().reverse()[0] ?? ""
    const bDate = [...b.dates].sort().reverse()[0] ?? ""
    return bDate.localeCompare(aDate)
  })

  // Assign opusIndex in chronological order (reversed array)
  const reversed = [...sorted].reverse()
  reversed.forEach((s, i) => { s.opusIndex = i })

  return sorted
}

function groupByArcs(sessions: TimelineSession[]): ArcGroup[] {
  const arcMap = new Map<string, ArcGroup>()
  const noArc: ArcGroup = { arc_id: null, arc_name: null, arc_color: null, sessions: [] }

  for (const s of sessions) {
    if (!s.session_arc_id) {
      noArc.sessions.push(s)
    } else {
      if (!arcMap.has(s.session_arc_id)) {
        arcMap.set(s.session_arc_id, {
          arc_id: s.session_arc_id,
          arc_name: s.session_arc_name ?? null,
          arc_color: s.session_arc_color ?? "#7a5500",
          sessions: [],
        })
      }
      arcMap.get(s.session_arc_id)!.sessions.push(s)
    }
  }

  // Build the final list: arcs in order of their newest session, ungrouped at end
  const arcList = Array.from(arcMap.values())
  if (noArc.sessions.length > 0) arcList.push(noArc)
  return arcList
}

type ViewMode = "sessions" | "threads"

export default function Timeline() {
  const { groups, loading, reload } = useDateGroups()
  const [viewMode, setViewMode] = useState<ViewMode>("sessions")
  const [arcManagerOpen, setArcManagerOpen] = useState(false)
  const [arcs, setArcs] = useState<Arc[]>([])
  const sessions = groupBySessions(groups)
  const arcGroups = groupByArcs(sessions)
  const hasArcs = arcGroups.some(a => a.arc_id !== null)

  async function openArcManager() {
    const fetched = await fetchArcs()
    setArcs(fetched)
    setArcManagerOpen(true)
  }

  const handleArcChanged = useCallback(async () => {
    const fetched = await fetchArcs()
    setArcs(fetched)
    reload()
  }, [reload])

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
          <button className="app-export-btn" onClick={openArcManager}>ARCS</button>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "RETRIEVING..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="tl-main">
        <div className="tl-panel-label">
          <span>[ CAMPAIGN TIMELINE ]</span>
          {/* View toggle — feature 9 */}
          <div className="tl-view-toggle">
            <button
              className={`tl-view-toggle-btn ${viewMode === "sessions" ? "tl-view-toggle-btn--active" : ""}`}
              onClick={() => setViewMode("sessions")}
            >SESSIONER</button>
            <button
              className={`tl-view-toggle-btn ${viewMode === "threads" ? "tl-view-toggle-btn--active" : ""}`}
              onClick={() => setViewMode("threads")}
            >ENTITY THREADS</button>
          </div>
        </div>

        {loading && sessions.length === 0 && (
          <div className="tl-empty">RETRIEVING RECORDS<span className="blink-cursor">_</span></div>
        )}

        {!loading && sessions.length === 0 && (
          <div className="tl-empty">NO SESSIONS RECORDED</div>
        )}

        {viewMode === "threads" ? (
          <EntityThreadView sessions={sessions} />
        ) : (
          <div className="tl-list">
            {/* Feature 11: arc grouping */}
            {hasArcs ? (
              arcGroups.map((arc, ai) => {
                if (arc.arc_id === null) {
                  // Ungrouped sessions — render without bracket
                  return arc.sessions.map((s, i) => {
                    const globalLast = i === arc.sessions.length - 1 && ai === arcGroups.length - 1
                    return (
                      <TimelineCard
                        key={s.session_id ?? s.dates[0]}
                        session={s}
                        isLast={globalLast}
                      />
                    )
                  })
                }
                return (
                  <div
                    key={arc.arc_id}
                    className="tl-arc-group"
                    style={{ "--arc-color": arc.arc_color ?? "#7a5500" } as React.CSSProperties}
                  >
                    <div className="tl-arc-bracket" />
                    <div className="tl-arc-label-wrap">
                      <span className="tl-arc-label">
                        <span className="tl-arc-dot" />
                        {arc.arc_name ?? "UKENDT ARC"}
                        <span className="tl-arc-session-count">{arc.sessions.length} SESSIONER</span>
                      </span>
                    </div>
                    <div className="tl-arc-sessions">
                      {arc.sessions.map((s, i) => (
                        <TimelineCard
                          key={s.session_id ?? s.dates[0]}
                          session={s}
                          isLast={i === arc.sessions.length - 1}
                        />
                      ))}
                    </div>
                  </div>
                )
              })
            ) : (
              sessions.map((s, i) => (
                <TimelineCard
                  key={s.session_id ?? s.dates[0]}
                  session={s}
                  isLast={i === sessions.length - 1}
                />
              ))
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        <span>SESSIONER: {sessions.length}</span>
      </footer>

      {arcManagerOpen && (
        <ArcManager
          arcs={arcs}
          sessions={sessions}
          onClose={() => setArcManagerOpen(false)}
          onChanged={handleArcChanged}
        />
      )}
    </div>
  )
}
