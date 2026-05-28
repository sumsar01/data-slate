import { useState, useEffect, useRef, useCallback } from "react"
import { Link } from "react-router-dom"
import { authFetch } from "../data/api"
import type { Clue, ClueStatus } from '@data-slate/shared'
import { toImperialDate } from "../utils/imperialDate"
import { useScrollablePage } from "../hooks/useScrollablePage"
import "./DeadDrop.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

const isAdmin = () => !!localStorage.getItem("auth_token")

const STATUS_ORDER: ClueStatus[] = ["ACTIVE", "COLD", "RESOLVED"]
const STATUS_LABELS: Record<ClueStatus, string> = {
  ACTIVE: "ACTIVE",
  COLD: "COLD",
  RESOLVED: "RESOLVED",
}
const PRIORITY_COLORS = ["#8a2a2a", "#8a5a00", "#4a7a4a", "#2a5a7a", "#3a2a4a"]
const DRAG_THRESHOLD = 8 // px movement before drag starts

const PRIORITY_LABELS: Record<number, string> = {
  0: "CRITICAL",
  1: "HIGH",
  2: "NORMAL",
  3: "LOW",
  4: "BACKGROUND",
}

function PriorityDot({ priority }: { priority: number }) {
  return (
    <span
      className="dd-priority-dot"
      style={{ background: PRIORITY_COLORS[Math.min(priority, 4)] }}
      title={PRIORITY_LABELS[priority] ?? "UNKNOWN"}
    />
  )
}

type NoteOption = { id: string; title: string; date: string }

function NewClueForm({ onCreated }: { onCreated: (clue: Clue) => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [priority, setPriority] = useState(2)
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(`${API_URL}/clues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description: description.trim() || null, priority }),
      })
      if (!res.ok) throw new Error("Failed")
      const clue = await res.json()
      onCreated(clue)
      setTitle("")
      setDescription("")
      setPriority(2)
      setOpen(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <button className="dd-new-btn" onClick={() => setOpen(true)}>
        + LOG NEW LEAD
      </button>
    )
  }

  return (
    <form className="dd-new-form" onSubmit={handleSubmit}>
      <div className="dd-new-label">// NEW LEAD</div>
      <input
        className="dd-new-input"
        placeholder="DESIGNATION..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="dd-new-textarea"
        placeholder="DETAILS (optional)..."
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={3}
      />
      <div className="dd-new-row">
        <select className="dd-new-select" value={priority} onChange={(e) => setPriority(Number(e.target.value))}>
          {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <button className="dd-new-submit" type="submit" disabled={saving}>
          {saving ? "LOGGING..." : "CONFIRM"}
        </button>
        <button className="dd-new-cancel" type="button" onClick={() => setOpen(false)}>CANCEL</button>
      </div>
    </form>
  )
}

function ClueCard({
  clue,
  notes,
  onStatusChange,
  onDelete,
  onUpdated,
  onDragStart,
  draggingId,
}: {
  clue: Clue
  notes: NoteOption[]
  onStatusChange: (id: string, status: ClueStatus) => void
  onDelete: (id: string) => void
  onUpdated: (clue: Clue) => void
  onDragStart: (id: string, title: string, priority: number, e: React.PointerEvent) => void
  draggingId: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(clue.title)
  const [editDesc, setEditDesc] = useState(clue.description ?? "")
  const [editPriority, setEditPriority] = useState(clue.priority)
  const [saving, setSaving] = useState(false)
  const [linkingNote, setLinkingNote] = useState(false)
  const [selectedNoteId, setSelectedNoteId] = useState("")
  const [linkedNoteCount, setLinkedNoteCount] = useState(clue.linked_notes)
  const admin = isAdmin()

  const nextStatus: Record<ClueStatus, ClueStatus | null> = {
    ACTIVE: "COLD",
    COLD: "RESOLVED",
    RESOLVED: null,
  }
  const prevStatus: Record<ClueStatus, ClueStatus | null> = {
    ACTIVE: null,
    COLD: "ACTIVE",
    RESOLVED: "COLD",
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) return
    setSaving(true)
    try {
      const res = await authFetch(`${API_URL}/clues/${clue.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || null,
          priority: editPriority,
        }),
      })
      if (!res.ok) throw new Error("Failed")
      const updated = await res.json()
      onUpdated({ ...clue, ...updated })
      setEditing(false)
    } catch {
      // ignore
    } finally {
      setSaving(false)
    }
  }

  async function handleLinkNote() {
    if (!selectedNoteId) return
    setLinkingNote(true)
    try {
      await authFetch(`${API_URL}/clues/${clue.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_id: selectedNoteId }),
      })
      setLinkedNoteCount((n) => n + 1)
      setSelectedNoteId("")
    } catch {
      // ignore
    } finally {
      setLinkingNote(false)
    }
  }

  return (
    <div
      className={`dd-card dd-card--${clue.status.toLowerCase()}${draggingId === clue.id ? " dd-card--dragging" : ""}`}
      onPointerDown={(e) => {
        // Don't initiate drag from buttons/inputs/selects
        if ((e.target as HTMLElement).closest("button,input,textarea,select")) return
        onDragStart(clue.id, clue.title, clue.priority, e)
      }}
    >
      <div className="dd-card-header" onClick={() => { if (!editing && draggingId !== clue.id) setExpanded((v) => !v) }}>
        <PriorityDot priority={clue.priority} />
        <span className="dd-card-title">{clue.title}</span>
        <span className="dd-card-chevron">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="dd-card-body">
          {editing ? (
            <div className="dd-edit-form">
              <input
                className="dd-new-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="DESIGNATION..."
              />
              <textarea
                className="dd-new-textarea"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="DETAILS..."
                rows={3}
              />
              <div className="dd-new-row">
                <select className="dd-new-select" value={editPriority} onChange={(e) => setEditPriority(Number(e.target.value))}>
                  {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <button className="dd-new-submit" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "SAVING..." : "SAVE"}
                </button>
                <button className="dd-new-cancel" onClick={() => { setEditing(false); setEditTitle(clue.title); setEditDesc(clue.description ?? ""); setEditPriority(clue.priority) }}>
                  CANCEL
                </button>
              </div>
            </div>
          ) : (
            <>
              {clue.description && (
                <div className="dd-card-desc">{clue.description}</div>
              )}
              <div className="dd-card-meta">
                <span>LOGGED: {toImperialDate(clue.created_at.slice(0, 10))}</span>
                {linkedNoteCount > 0 && (
                  <span>{linkedNoteCount} SESSION{linkedNoteCount !== 1 ? "S" : ""} LINKED</span>
                )}
                <span>PRIORITY: {PRIORITY_LABELS[clue.priority] ?? clue.priority}</span>
              </div>
            </>
          )}

          {/* Link a note — admin only */}
          {admin && !editing && (
            <div className="dd-link-row">
              <select
                className="dd-new-select dd-link-select"
                value={selectedNoteId}
                onChange={(e) => setSelectedNoteId(e.target.value)}
              >
                <option value="">— link recording —</option>
                {notes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.date} · {n.title.slice(0, 40)}
                  </option>
                ))}
              </select>
              <button
                className="dd-card-btn"
                onClick={handleLinkNote}
                disabled={!selectedNoteId || linkingNote}
              >
                {linkingNote ? "..." : "⊕ LINK"}
              </button>
            </div>
          )}

          <div className="dd-card-actions">
            {prevStatus[clue.status] && (
              <button
                className="dd-card-btn dd-card-btn--back"
                onClick={() => onStatusChange(clue.id, prevStatus[clue.status]!)}
              >
                ◄ {STATUS_LABELS[prevStatus[clue.status]!]}
              </button>
            )}
            {nextStatus[clue.status] && (
              <button
                className="dd-card-btn dd-card-btn--advance"
                onClick={() => onStatusChange(clue.id, nextStatus[clue.status]!)}
              >
                {STATUS_LABELS[nextStatus[clue.status]!]} ►
              </button>
            )}
            {admin && !editing && (
              <button className="dd-card-btn" onClick={() => setEditing(true)}>
                ✎ EDIT
              </button>
            )}
            {admin && (
              <button
                className="dd-card-btn dd-card-btn--delete"
                onClick={() => onDelete(clue.id)}
              >
                DESTROY
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function DeadDropPage() {
  useScrollablePage()

  const [clues, setClues] = useState<Clue[]>([])
  const [notes, setNotes] = useState<NoteOption[]>([])
  const [loading, setLoading] = useState(true)
  const [dragOverStatus, setDragOverStatus] = useState<ClueStatus | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const admin = isAdmin()

  // Pointer drag state refs (not React state — updated every pointermove)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const dragState = useRef<{
    id: string
    startX: number
    startY: number
    started: boolean
  } | null>(null)

  const colRefs = useRef<Partial<Record<ClueStatus, HTMLDivElement | null>>>({})

  const getStatusFromPoint = useCallback((x: number, y: number): ClueStatus | null => {
    for (const status of STATUS_ORDER) {
      const el = colRefs.current[status]
      if (!el) continue
      const rect = el.getBoundingClientRect()
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return status
      }
    }
    return null
  }, [])

  const removeGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove()
      ghostRef.current = null
    }
  }, [])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const ds = dragState.current
    if (!ds) return

    if (!ds.started) {
      const dx = e.clientX - ds.startX
      const dy = e.clientY - ds.startY
      if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return
      ds.started = true
      setDraggingId(ds.id)
    }

    // Move ghost
    if (ghostRef.current) {
      ghostRef.current.style.left = `${e.clientX + 12}px`
      ghostRef.current.style.top = `${e.clientY + 12}px`
    }

    // Highlight column
    const status = getStatusFromPoint(e.clientX, e.clientY)
    setDragOverStatus(status)
  }, [getStatusFromPoint])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    const ds = dragState.current
    if (!ds) return

    if (ds.started) {
      const status = getStatusFromPoint(e.clientX, e.clientY)
      if (status) {
        const clue = clues.find((c) => c.id === ds.id)
        if (clue && clue.status !== status) {
          // Optimistic update
          setClues((prev) => prev.map((c) => c.id === ds.id ? { ...c, status } : c))
          authFetch(`${import.meta.env.VITE_API_URL ?? ""}/clues/${ds.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          }).then((res) => {
            if (!res.ok) {
              // Revert on failure
              setClues((prev) => prev.map((c) => c.id === ds.id ? { ...c, status: clue.status } : c))
            } else {
              res.json().then((updated) => {
                setClues((prev) => prev.map((c) => c.id === ds.id ? { ...c, ...updated } : c))
              })
            }
          }).catch(() => {
            setClues((prev) => prev.map((c) => c.id === ds.id ? { ...c, status: clue.status } : c))
          })
        }
      }
    }

    removeGhost()
    setDraggingId(null)
    setDragOverStatus(null)
    dragState.current = null
    document.body.style.touchAction = ""
    document.body.style.userSelect = ""

    window.removeEventListener("pointermove", handlePointerMove)
    window.removeEventListener("pointerup", handlePointerUp)
    window.removeEventListener("pointercancel", handlePointerUp)
  }, [clues, getStatusFromPoint, handlePointerMove, removeGhost])

  const handleCardDragStart = useCallback((
    id: string,
    title: string,
    priority: number,
    e: React.PointerEvent
  ) => {
    dragState.current = { id, startX: e.clientX, startY: e.clientY, started: false }

    // Create ghost element
    const ghost = document.createElement("div")
    ghost.className = "dd-drag-ghost"
    ghost.innerHTML = `
      <span class="dd-priority-dot" style="background:${PRIORITY_COLORS[Math.min(priority, 4)]};display:inline-block;width:6px;height:6px;border-radius:50%;flex-shrink:0"></span>
      <span class="dd-drag-ghost-title">${title}</span>
    `
    ghost.style.left = `${e.clientX + 12}px`
    ghost.style.top = `${e.clientY + 12}px`
    document.body.appendChild(ghost)
    ghostRef.current = ghost
    document.body.style.touchAction = "none"
    document.body.style.userSelect = "none"

    window.addEventListener("pointermove", handlePointerMove)
    window.addEventListener("pointerup", handlePointerUp)
    window.addEventListener("pointercancel", handlePointerUp)
  }, [handlePointerMove, handlePointerUp])

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/clues`).then((r) => r.json()).catch(() => []),
      fetch(`${API_URL}/dates`).then((r) => r.json()).catch(() => []),
    ]).then(([clueData, dateGroups]) => {
      setClues(clueData)
      const allNotes: NoteOption[] = (dateGroups as { notes?: { id: string; title: string; date: string }[] }[]).flatMap((g) =>
        (g.notes ?? []).map((n) => ({ id: n.id, title: n.title, date: n.date }))
      )
      setNotes(allNotes)
    }).finally(() => setLoading(false))
  }, [])

  async function handleStatusChange(id: string, status: ClueStatus) {
    try {
      const res = await authFetch(`${API_URL}/clues/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) return
      const updated = await res.json()
      setClues((prev) => prev.map((c) => (c.id === id ? { ...c, ...updated } : c)))
    } catch { /* ignore */ }
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`${API_URL}/clues/${id}`, { method: "DELETE" })
      setClues((prev) => prev.filter((c) => c.id !== id))
    } catch { /* ignore */ }
  }

  function handleCreated(clue: Clue) {
    setClues((prev) => [clue, ...prev])
  }

  function handleUpdated(clue: Clue) {
    setClues((prev) => prev.map((c) => (c.id === clue.id ? clue : c)))
  }

  const byStatus = (status: ClueStatus) => clues.filter((c) => c.status === status)

  return (
    <div className="dd-page">
      <div className="scanlines" aria-hidden />
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">
            <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
            DEAD DROP // LEAD TRACKER
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/wiki" className="app-export-btn">◈ WIKI</Link>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "RETRIEVING..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="dd-main">
        <div className="dd-top">
          <div className="panel-label">[ VOX-INTERCEPTS // ACTIVE LEADS ]</div>
          {admin && <NewClueForm onCreated={handleCreated} />}
        </div>

        <div className="dd-columns">
          {STATUS_ORDER.map((status) => {
            const col = byStatus(status)
            return (
              <div key={status} className={`dd-col dd-col--${status.toLowerCase()}`}>
                <div className="dd-col-header">
                  <span className="dd-col-status">{STATUS_LABELS[status]}</span>
                  <span className="dd-col-count">[{col.length}]</span>
                </div>
                <div
                  ref={(el) => { colRefs.current[status] = el }}
                  className={`dd-col-body${dragOverStatus === status ? " dd-col-body--drag-over" : ""}`}
                >
                  {col.length === 0 && (
                    <div className="dd-col-empty">NO ACTIVE LEADS</div>
                  )}
                  {col.map((clue) => (
                    <ClueCard
                      key={clue.id}
                      clue={clue}
                      notes={notes}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
                      onUpdated={handleUpdated}
                      onDragStart={handleCardDragStart}
                      draggingId={draggingId}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        <span>LEADS: {clues.length} // ACTIVE: {byStatus("ACTIVE").length}</span>
      </footer>
    </div>
  )
}
