import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { authFetch } from "../data/api"
import type { Clue, ClueStatus } from "../shared"
import { toImperialDate } from "../utils/imperialDate"
import "./DeadDrop.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

const STATUS_ORDER: ClueStatus[] = ["ACTIVE", "COLD", "RESOLVED"]
const STATUS_LABELS: Record<ClueStatus, string> = {
  ACTIVE: "AKTIV",
  COLD: "KOLD",
  RESOLVED: "LØST",
}
const PRIORITY_LABELS: Record<number, string> = {
  0: "KRITISK",
  1: "HØJ",
  2: "NORMAL",
  3: "LAV",
  4: "BAGGRUNDSINFO",
}

function PriorityDot({ priority }: { priority: number }) {
  const colors = ["#8a2a2a", "#8a5a00", "#4a7a4a", "#2a5a7a", "#3a2a4a"]
  return (
    <span
      className="dd-priority-dot"
      style={{ background: colors[Math.min(priority, 4)] }}
      title={PRIORITY_LABELS[priority] ?? "UKENDT"}
    />
  )
}

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
        + REGISTRER NYT LEAD
      </button>
    )
  }

  return (
    <form className="dd-new-form" onSubmit={handleSubmit}>
      <div className="dd-new-label">// NYT LEAD</div>
      <input
        className="dd-new-input"
        placeholder="BETEGNELSE..."
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
      />
      <textarea
        className="dd-new-textarea"
        placeholder="DETALJER (valgfrit)..."
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
          {saving ? "REGISTRERER..." : "BEKRÆFT"}
        </button>
        <button className="dd-new-cancel" type="button" onClick={() => setOpen(false)}>ANNULLER</button>
      </div>
    </form>
  )
}

function ClueCard({
  clue,
  onStatusChange,
  onDelete,
}: {
  clue: Clue
  onStatusChange: (id: string, status: ClueStatus) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

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

  return (
    <div className={`dd-card dd-card--${clue.status.toLowerCase()}`}>
      <div className="dd-card-header" onClick={() => setExpanded((v) => !v)}>
        <PriorityDot priority={clue.priority} />
        <span className="dd-card-title">{clue.title}</span>
        <span className="dd-card-chevron">{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div className="dd-card-body">
          {clue.description && (
            <div className="dd-card-desc">{clue.description}</div>
          )}
          <div className="dd-card-meta">
            <span>REGISTRERET: {toImperialDate(clue.created_at.slice(0, 10))}</span>
            {clue.linked_notes > 0 && (
              <span>{clue.linked_notes} SESSION{clue.linked_notes !== 1 ? "ER" : ""} LINKET</span>
            )}
            <span>PRIORITET: {PRIORITY_LABELS[clue.priority] ?? clue.priority}</span>
          </div>
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
            <button
              className="dd-card-btn dd-card-btn--delete"
              onClick={() => onDelete(clue.id)}
            >
              DESTRUER
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function DeadDropPage() {
  const [clues, setClues] = useState<Clue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API_URL}/clues`)
      .then((r) => r.json())
      .then((data) => setClues(data))
      .catch(() => {})
      .finally(() => setLoading(false))
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
    } catch {}
  }

  async function handleDelete(id: string) {
    try {
      await authFetch(`${API_URL}/clues/${id}`, { method: "DELETE" })
      setClues((prev) => prev.filter((c) => c.id !== id))
    } catch {}
  }

  function handleCreated(clue: Clue) {
    setClues((prev) => [clue, ...prev])
  }

  const byStatus = (status: ClueStatus) => clues.filter((c) => c.status === status)

  return (
    <div className="dd-page">
      <div className="scanlines" aria-hidden />
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">
            <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
            DEAD DROP // LEAD-TRACKER
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/wiki" className="app-export-btn">◈ WIKI</Link>
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "HENTER..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="dd-main">
        <div className="dd-top">
          <div className="panel-label">[ VOX-INTERCEPTER // IGANGVÆRENDE LEADS ]</div>
          <NewClueForm onCreated={handleCreated} />
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
                <div className="dd-col-body">
                  {col.length === 0 && (
                    <div className="dd-col-empty">INGEN AKTIVE LEADS</div>
                  )}
                  {col.map((clue) => (
                    <ClueCard
                      key={clue.id}
                      clue={clue}
                      onStatusChange={handleStatusChange}
                      onDelete={handleDelete}
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
        <span>LEADS: {clues.length} // AKTIVE: {byStatus("ACTIVE").length}</span>
      </footer>
    </div>
  )
}
