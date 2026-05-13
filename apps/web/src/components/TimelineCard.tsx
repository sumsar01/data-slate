import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { DateGroup } from "../shared"

interface TimelineSession {
  session_id: string | null
  session_name: string | null
  dates: string[]
  notes: DateGroup["notes"]
}

interface TimelineCardProps {
  session: TimelineSession
  isLast: boolean
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—"
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return "—"
  const sorted = [...dates].sort()
  const fmt = (d: string) => {
    const [, m, day] = d.split("-")
    return `${day} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][parseInt(m) - 1]}`
  }
  if (sorted.length === 1) return fmt(sorted[0])
  return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`
}

export function TimelineCard({ session, isLast }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false)
  const navigate = useNavigate()

  const totalDuration = session.notes.reduce((sum, n) => sum + (n.duration_s ?? 0), 0)
  const recordingCount = session.notes.length
  const dateRange = formatDateRange(session.dates)
  const label = session.session_name ?? `Session · ${dateRange}`
  const earliestDate = [...session.dates].sort()[0] ?? ""

  function handleGoToLog() {
    navigate(`/?date=${earliestDate}`)
  }

  return (
    <div className="tl-entry">
      {/* spine */}
      <div className="tl-spine">
        <div className="tl-node" />
        {!isLast && <div className="tl-line" />}
      </div>

      {/* card */}
      <div className="tl-card-wrap">
        <button
          className={`tl-card-header ${expanded ? "tl-card-header--expanded" : ""}`}
          onClick={() => setExpanded(v => !v)}
          aria-expanded={expanded}
        >
          <span className="tl-card-name">{label}</span>
          <span className="tl-card-meta">
            {recordingCount} REC · {formatDuration(totalDuration)}
          </span>
          <span className="tl-card-chevron">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="tl-card-body">
            <div className="tl-card-dates">DATES: {session.dates.sort().join(", ")}</div>
            <div className="tl-card-recordings">
              {session.notes.map(n => (
                <div key={n.id} className="tl-card-rec-row">
                  <span className="tl-card-rec-title">{n.title || "Untitled"}</span>
                  <span className="tl-card-rec-dur">{formatDuration(n.duration_s)}</span>
                </div>
              ))}
            </div>
            <button className="tl-card-goto" onClick={handleGoToLog}>
              GO TO LOG →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
