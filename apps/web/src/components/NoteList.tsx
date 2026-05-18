import { useState } from "react"
import type { Note, Tag, DateGroup } from "../shared"
import { soundClick } from "../audio/sounds"
import { SessionOverride } from "./SessionOverride"
import { upsertSession, deleteNote, autoAnalyseSession, patchNote } from "../data/api"
import "./NoteList.css"

interface Props {
  groups: DateGroup[]
  selectedId: string | null
  activeTagFilters: Tag[]
  searchQuery: string
  onSelect: (note: Note) => void
  onReload: () => void
  onDeleted: (noteId: string) => void
}

export function NoteList({ groups, selectedId, activeTagFilters, searchQuery, onSelect, onReload, onDeleted }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [sessionIds] = useState<Map<string, string>>(new Map())
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [autoLoading, setAutoLoading] = useState<Set<string>>(new Set())
  const [togglingRefId, setTogglingRefId] = useState<string | null>(null)

  function toggleGroup(date: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function filteredNotes(notes: Note[]) {
    let result = notes
    if (activeTagFilters.length > 0) {
      result = result.filter((n) => activeTagFilters.some((t) => n.tags.includes(t)))
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          (n.transcript ?? "").toLowerCase().includes(q)
      )
    }
    return result
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  }

  async function handleSessionSave(date: string, name: string) {
    const existingId = sessionIds.get(date)
    await upsertSession(date, name, existingId)
    onReload()
  }

  async function handleDelete(note: Note) {    if (confirmId !== note.id) {
      setConfirmId(note.id)
      return
    }
    setConfirmId(null)
    setDeletingId(note.id)
    try {
      await deleteNote(note.id)
      onDeleted(note.id)
    } catch (e) {
      console.error("Delete failed", e)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAutoAnalyse(group: DateGroup) {
    setAutoLoading((prev) => new Set(prev).add(group.date))
    try {
      await autoAnalyseSession([group.date])
      onReload()
    } catch (e) {
      console.error("Auto-analyse failed", e)
    } finally {
      setAutoLoading((prev) => { const s = new Set(prev); s.delete(group.date); return s })
    }
  }

  return (
    <div className="note-list">
      {groups.map((group) => {
        const notes = filteredNotes(group.notes)
        const isCollapsed = collapsed.has(group.date)
  async function handleToggleReference(note: Note) {
    setTogglingRefId(note.id)
    try {
      await patchNote(note.id, { reference: !note.reference })
      onReload()
    } catch (e) {
      console.error("Toggle reference failed", e)
    } finally {
      setTogglingRefId(null)
    }
  }

  return (
          <div key={group.date} className="note-group">
            <button className="note-group-header" onClick={() => toggleGroup(group.date)}>
              <span className="note-group-chevron">{isCollapsed ? "▶" : "▼"}</span>
              <span className="note-group-date">{formatDate(group.date)}</span>
              <span className="note-group-count">[{notes.length}]</span>
            </button>

            {!isCollapsed && (
              <SessionOverride
                date={group.date}
                currentName={group.session_name}
                onSave={(name) => handleSessionSave(group.date, name)}
              />
            )}

            {!isCollapsed && !group.session_id && (
              <div className="note-group-summary">
                <button
                  className="note-group-summary-btn note-group-summary-btn--auto"
                  onClick={() => handleAutoAnalyse(group)}
                  disabled={autoLoading.has(group.date)}
                >
                  {autoLoading.has(group.date) ? "COGITATOR PROCESSING..." : "▶ AUTO-ANALYSE SESSION"}
                </button>
              </div>
            )}



            {!isCollapsed && (
              <div className="note-group-items">
                {notes.map((note) => (
                  <div
                    key={note.id}
                    className={`note-item-row ${selectedId === note.id ? "note-item-row--active" : ""}`}
                  >
                    <button
                      className={`note-item ${selectedId === note.id ? "note-item--active" : ""}`}
                      onClick={() => {
                        soundClick()
                        onSelect(note)
                        setConfirmId(null)
                      }}
                    >
                      <span className="note-item-prefix">›</span>
                      <span className="note-item-title">{note.title}</span>
                      {note.reference && <span className="note-item-badge">REF</span>}
                      <span className="note-item-time">{formatTime(note.created_at)}</span>
                    </button>
                    <button
                      className={`note-ref-btn ${note.reference ? "note-ref-btn--active" : ""}`}
                      onClick={() => handleToggleReference(note)}
                      disabled={togglingRefId === note.id}
                      aria-label={note.reference ? "Unmark as reference" : "Mark as reference"}
                      title={note.reference ? "Reference entry — click to unmark" : "Mark as reference (exclude from summaries)"}
                    >
                      {togglingRefId === note.id ? "…" : "REF"}
                    </button>
                    <button
                      className={`note-delete-btn ${confirmId === note.id ? "note-delete-btn--confirm" : ""}`}
                      onClick={() => handleDelete(note)}
                      disabled={deletingId === note.id}
                      aria-label={confirmId === note.id ? "Confirm delete" : "Delete note"}
                      title={confirmId === note.id ? "Tap again to confirm deletion" : "Delete note"}
                    >
                      {deletingId === note.id ? "…" : confirmId === note.id ? "!" : "✕"}
                    </button>
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="note-item-empty">NO RECORDS MATCH FILTER</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
