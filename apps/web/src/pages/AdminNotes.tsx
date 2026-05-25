import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { Note, Tag, Entity, EntityType } from "../shared"
import { ALL_TAGS } from "../shared"
import { authFetch } from "../data/api"
import "./AdminNotes.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

const ENTITY_TYPES: EntityType[] = ["NPC", "Location", "Faction", "Item", "Other"]

type EditState = {
  title: string
  date: string
  transcript: string
  tags: Tag[]
  entities: Entity[]
  reference: boolean
}

function noteToEditState(note: Note): EditState {
  return {
    title: note.title,
    date: note.date,
    transcript: note.transcript,
    tags: [...note.tags],
    entities: note.entities.map((e) => ({ ...e })),
    reference: note.reference ?? false,
  }
}

type DateGroup = {
  date: string
  notes: Note[]
}

function groupByDate(notes: Note[]): DateGroup[] {
  const map = new Map<string, Note[]>()
  for (const note of notes) {
    const key = note.date || "UNKNOWN"
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(note)
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, notes]) => ({ date, notes }))
}

export default function AdminNotes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [saveResult, setSaveResult] = useState<string | null>(null)
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set())

  function toggleDateGroup(date: string) {
    setCollapsedDates((prev) => {
      const next = new Set(prev)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })
  }

  useEffect(() => {
    authFetch(`${API_URL}/notes`)
      .then((r) => r.json())
      .then((data: Note[]) => {
        // Sort newest first
        setNotes(data.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)))
      })
      .finally(() => setLoading(false))
  }, [])

  function startEdit(note: Note) {
    setEditingId(note.id)
    setEditState(noteToEditState(note))
    setSaveResult(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditState(null)
    setSaveResult(null)
  }

  async function saveEdit(note: Note) {
    if (!editState) return
    setSaving(true)
    setSaveResult(null)
    try {
      const res = await authFetch(`${API_URL}/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editState),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated: Note = await res.json()
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)))
      setSaveResult("SAVED")
      setEditingId(null)
      setEditState(null)
    } catch (e) {
      setSaveResult(`ERROR: ${e}`)
    } finally {
      setSaving(false)
    }
  }

  async function reextractEntities(noteId: string) {
    if (!editState) return
    // Save first, then re-extract
    setSaving(true)
    setSaveResult(null)
    try {
      const patchRes = await authFetch(`${API_URL}/notes/${noteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editState),
      })
      if (!patchRes.ok) throw new Error(await patchRes.text())

      setReextracting(true)
      const extractRes = await authFetch(`${API_URL}/notes/${noteId}/entities`, { method: "POST" })
      if (!extractRes.ok) throw new Error(await extractRes.text())
      const { entities } = await extractRes.json()

      // Update local note with saved edits + new entities
      const updated: Note = { ...((await patchRes.clone().json()) as Note), entities }
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)))
      setSaveResult("SAVED + ENTITIES RE-EXTRACTED")
      setEditingId(null)
      setEditState(null)
    } catch (e) {
      setSaveResult(`ERROR: ${e}`)
    } finally {
      setSaving(false)
      setReextracting(false)
    }
  }

  function toggleTag(tag: Tag) {
    setEditState((prev) => {
      if (!prev) return prev
      const has = prev.tags.includes(tag)
      return { ...prev, tags: has ? prev.tags.filter((t) => t !== tag) : [...prev.tags, tag] }
    })
  }

  function updateEntity(idx: number, field: keyof Entity, value: string) {
    setEditState((prev) => {
      if (!prev) return prev
      const entities = prev.entities.map((e, i) =>
        i === idx ? { ...e, [field]: value } : e
      )
      return { ...prev, entities }
    })
  }

  function addEntity() {
    setEditState((prev) => {
      if (!prev) return prev
      return { ...prev, entities: [...prev.entities, { name: "", type: "Other" }] }
    })
  }

  function removeEntity(idx: number) {
    setEditState((prev) => {
      if (!prev) return prev
      return { ...prev, entities: prev.entities.filter((_, i) => i !== idx) }
    })
  }

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="admin-loading">RETRIEVING LOG ENTRIES...</div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div>
          <div className="admin-header-title">// LOG ENTRY EDITOR //</div>
          <div className="admin-header-sub">EDIT &amp; CORRECT MISSION RECORDS</div>
        </div>
        <Link to="/admin-mechanicus" className="admin-back-link">◄ ADMIN</Link>
      </header>

      <main className="admin-main">
        <section className="admin-section">
          <div className="admin-section-title">LOG ENTRIES ({notes.length})</div>

          {saveResult && (
            <div className={`an-save-result ${saveResult.startsWith("ERROR") ? "an-save-result--error" : ""}`}>
              {saveResult}
            </div>
          )}

          <div className="an-note-list">
            {groupByDate(notes).map(({ date, notes: groupNotes }) => {
              const isCollapsed = collapsedDates.has(date)
              return (
                <div key={date} className="an-date-group">
                  <button
                    className="an-date-group-header"
                    onClick={() => toggleDateGroup(date)}
                  >
                    <span className="an-date-group-arrow">{isCollapsed ? "▶" : "▼"}</span>
                    <span className="an-date-group-label">SESSION // {date}</span>
                    <span className="an-date-group-count">{groupNotes.length} {groupNotes.length === 1 ? "RECORD" : "RECORDS"}</span>
                  </button>

                  {!isCollapsed && groupNotes.map((note) => {
                    const isEditing = editingId === note.id
                    return (
                      <div key={note.id} className={`an-note-row ${isEditing ? "an-note-row--editing" : ""}`}>
                        {!isEditing ? (
                          <div className="an-note-summary">
                            <span className="an-note-title">{note.title}</span>
                            <span className="an-note-meta">{note.tags.join(", ") || "—"}</span>
                            {note.reference && <span className="an-note-ref-badge">REF</span>}
                            <button className="an-btn an-btn--edit" onClick={() => startEdit(note)}>
                              EDIT
                            </button>
                          </div>
                        ) : (
                          editState && (
                            <div className="an-edit-form">
                        <div className="an-field-row">
                          <label className="an-label">TITLE</label>
                          <input
                            className="an-input"
                            type="text"
                            value={editState.title}
                            onChange={(e) => setEditState((s) => s && { ...s, title: e.target.value })}
                          />
                        </div>

                        <div className="an-field-row">
                          <label className="an-label">DATE</label>
                          <input
                            className="an-input an-input--date"
                            type="date"
                            value={editState.date}
                            onChange={(e) => setEditState((s) => s && { ...s, date: e.target.value })}
                          />
                        </div>

                        <div className="an-field-row">
                          <label className="an-label">TRANSCRIPT</label>
                          <textarea
                            className="an-textarea"
                            rows={12}
                            value={editState.transcript}
                            onChange={(e) => setEditState((s) => s && { ...s, transcript: e.target.value })}
                          />
                        </div>

                        <div className="an-field-row">
                          <label className="an-label">TAGS</label>
                          <div className="an-tag-grid">
                            {ALL_TAGS.map((tag) => (
                              <label key={tag} className="an-tag-option">
                                <input
                                  type="checkbox"
                                  checked={editState.tags.includes(tag)}
                                  onChange={() => toggleTag(tag)}
                                />
                                {tag}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div className="an-field-row">
                          <label className="an-label">REFERENCE</label>
                          <label className="an-tag-option" style={{ cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={editState.reference}
                              onChange={(e) => setEditState((s) => s && { ...s, reference: e.target.checked })}
                            />
                            Exclude from session summaries
                          </label>
                        </div>

                        <div className="an-field-row">
                          <label className="an-label">ENTITIES</label>
                          <div className="an-entity-list">
                            {editState.entities.map((entity, idx) => (
                              <div key={idx} className="an-entity-row">
                                <input
                                  className="an-input an-entity-name"
                                  type="text"
                                  placeholder="Name"
                                  value={entity.name}
                                  onChange={(e) => updateEntity(idx, "name", e.target.value)}
                                />
                                <select
                                  className="an-select"
                                  value={entity.type}
                                  onChange={(e) => updateEntity(idx, "type", e.target.value)}
                                >
                                  {ENTITY_TYPES.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                                <button
                                  className="an-btn an-btn--remove"
                                  onClick={() => removeEntity(idx)}
                                  title="Remove entity"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button className="an-btn an-btn--add" onClick={addEntity}>
                              + ADD ENTITY
                            </button>
                          </div>
                        </div>

                        <div className="an-form-actions">
                          <button
                            className="an-btn an-btn--save"
                            onClick={() => saveEdit(note)}
                            disabled={saving}
                          >
                            {saving && !reextracting ? "SAVING..." : "SAVE"}
                          </button>
                          <button
                            className="an-btn an-btn--reextract"
                            onClick={() => reextractEntities(note.id)}
                            disabled={saving}
                            title="Save and re-run AI entity extraction from transcript"
                          >
                            {reextracting ? "EXTRACTING..." : "SAVE + RE-EXTRACT ENTITIES"}
                          </button>
                          <button
                            className="an-btn an-btn--cancel"
                            onClick={cancelEdit}
                            disabled={saving}
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    )
                  )}
                    </div>
                  )
                })}
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="admin-footer">
        OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL
      </footer>
    </div>
  )
}
