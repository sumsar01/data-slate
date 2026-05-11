import { useState } from "react"
import type { Note, Tag, DateGroup } from "@data-slate/shared"
import "./NoteList.css"

interface Props {
  groups: DateGroup[]
  selectedId: string | null
  activeTagFilters: Tag[]
  onSelect: (note: Note) => void
}

export function NoteList({ groups, selectedId, activeTagFilters, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  function toggleGroup(date: string) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  function filteredNotes(notes: Note[]) {
    if (activeTagFilters.length === 0) return notes
    return notes.filter((n) => activeTagFilters.some((t) => n.tags.includes(t)))
  }

  function formatDate(dateStr: string) {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div className="note-list">
      {groups.map((group) => {
        const notes = filteredNotes(group.notes)
        const isCollapsed = collapsed.has(group.date)
        return (
          <div key={group.date} className="note-group">
            <button className="note-group-header" onClick={() => toggleGroup(group.date)}>
              <span className="note-group-chevron">{isCollapsed ? "▶" : "▼"}</span>
              <span className="note-group-date">{formatDate(group.date)}</span>
              <span className="note-group-count">[{notes.length}]</span>
            </button>
            {group.session_name && !isCollapsed && (
              <div className="note-group-session">{group.session_name}</div>
            )}
            {!isCollapsed && (
              <div className="note-group-items">
                {notes.map((note) => (
                  <button
                    key={note.id}
                    className={`note-item ${selectedId === note.id ? "note-item--active" : ""}`}
                    onClick={() => {
                      onSelect(note)
                    }}
                  >
                    <span className="note-item-prefix">›</span>
                    <span className="note-item-title">{note.title}</span>
                    <span className="note-item-time">{formatTime(note.created_at)}</span>
                  </button>
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

