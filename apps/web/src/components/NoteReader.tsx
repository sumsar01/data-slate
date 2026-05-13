import type { Note } from "../shared"
import { useTypewriter } from "../hooks/useTypewriter"
import { AudioPlayer } from "./AudioPlayer"
import { linkEntities } from "../lib/linkEntities"
import "./NoteReader.css"

interface Props {
  note: Note | null
}

export function NoteReader({ note }: Props) {
  const { displayed, done, skip } = useTypewriter(note?.transcript ?? "", !!note, 12)

  if (!note) {
    return (
      <div className="note-reader note-reader--empty">
        <div className="note-reader-empty-text">
          AWAITING DATA INPUT
          <br />
          <br />
          SELECT A COGITATOR RECORD FROM THE AUSPEX LOG
        </div>
      </div>
    )
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso)
    return (
      d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() +
      " // " +
      d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    )
  }

  function formatDuration(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }

  return (
    <div className="note-reader">
      <div className="note-reader-header">
        <div className="note-reader-title">{note.title}</div>
        <div className="note-reader-meta">
          <span className="note-reader-datetime">{formatDateTime(note.created_at)}</span>
          <div className="note-reader-tags">
            {note.tags.map((tag) => (
              <span key={tag} className="note-reader-tag">
                [{tag}]
              </span>
            ))}
          </div>
        </div>
        <div className="note-reader-divider">
          {"─".repeat(60)}
        </div>
      </div>

      <div className="note-reader-body" onClick={() => { if (!done) skip() }}>
        <div className="note-reader-transcript">
          {done
            ? linkEntities(note.transcript, note.entities ?? [])
            : displayed}
          {!done && <span className="blink">█</span>}
        </div>
        {!done && <div className="note-reader-skip-hint">[ TAP TO SKIP ]</div>}
      </div>

      <div className="note-reader-footer">
        <div className="note-reader-divider">{"─".repeat(60)}</div>
        {note.audio_url ? (
          <div className="note-reader-audio">
            <AudioPlayer src={note.audio_url} duration_s={note.duration_s} />
          </div>
        ) : (
          <div className="note-reader-audio-placeholder">
            <span className="note-reader-audio-icon">▶</span>
            <span className="note-reader-audio-bar">{"━".repeat(32)}</span>
            <span className="note-reader-audio-time">
              {formatDuration(0)} / {formatDuration(note.duration_s)}
            </span>
            <span className="note-reader-audio-label">[ NO AUDIO LINK — COGITATOR RECORD ONLY ]</span>
          </div>
        )}
      </div>
    </div>
  )
}
