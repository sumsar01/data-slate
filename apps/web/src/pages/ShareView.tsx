import { useState, useEffect } from "react"
import { useParams, Link } from "react-router-dom"
import type { DateGroup, Note } from "../shared"
import { NoteReader } from "../components/NoteReader"
import "../App.css"
import "./ShareView.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

export default function ShareView() {
  const { token } = useParams<{ token: string }>()
  const [groups, setGroups] = useState<DateGroup[]>([])
  const [sessionName, setSessionName] = useState<string | null>(null)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    fetch(`${API_URL}/shares/shared/${token}`)
      .then((r) => {
        if (!r.ok) return r.json().then((e) => Promise.reject(e.error ?? "Failed"))
        return r.json()
      })
      .then((data) => {
        setGroups(data.groups)
        setSessionName(data.session_name)
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [token])

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  }

  if (loading) {
    return (
      <div className="share-shell">
        <div className="scanlines" aria-hidden />
        <div className="share-status">RETRIEVING CLASSIFIED RECORDS...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="share-shell">
        <div className="scanlines" aria-hidden />
        <div className="share-status share-status--err">
          ACCESS DENIED // {error.toUpperCase()}
        </div>
      </div>
    )
  }

  return (
    <div className="share-shell">
      <div className="scanlines" aria-hidden />

      <header className="share-header">
        <div className="share-header-title">DATA-SLATE MK.IV // CLASSIFIED RECORD</div>
        {sessionName && <div className="share-header-sub">{sessionName.toUpperCase()}</div>}
        <div className="share-header-badge">READ-ONLY // INQUISITORIAL ACCESS</div>
      </header>

      <main className="share-main">
        <aside className="share-list">
          {groups.map((group) => (
            <div key={group.date} className="share-group">
              <div className="share-group-date">{formatDate(group.date)}</div>
              {group.session_summary && (
                <div className="share-group-summary">{group.session_summary}</div>
              )}
              <div className="share-group-notes">
                {group.notes.map((note) => (
                  <button
                    key={note.id}
                    className={`share-note-item ${selectedNote?.id === note.id ? "share-note-item--active" : ""}`}
                    onClick={() => setSelectedNote(note)}
                  >
                    <span className="share-note-prefix">›</span>
                    <span className="share-note-title">{note.title}</span>
                    <span className="share-note-time">{formatTime(note.created_at)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <div className="panel-divider" aria-hidden />

        <section className="share-reader">
          <NoteReader note={selectedNote} />
        </section>
      </main>

      <footer className="share-footer">
        OMNISSIAH PROTECTS // READ-ONLY TRANSMISSION //
        <Link to="/" className="share-footer-link">DATA-SLATE MK.IV</Link>
      </footer>
    </div>
  )
}
