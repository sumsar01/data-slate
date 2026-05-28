import { useState } from "react"
import type { Arc, TimelineSession } from '@data-slate/shared'
import { createArc, updateArc, deleteArc } from "../data/api"
import "./ArcManager.css"

interface Props {
  arcs: Arc[]
  sessions: TimelineSession[]
  onClose: () => void
  onChanged: () => void
}

const PRESET_COLORS = [
  "#7a5500", "#c88800", "#ffb000",
  "#4a9a4a", "#b04ab0", "#4a8aaa",
  "#aa4a4a", "#4a4aaa", "#8a8a4a",
]

export function ArcManager({ arcs, sessions, onClose, onChanged }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editColor, setEditColor] = useState("#7a5500")
  const [editSessionIds, setEditSessionIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const [newColor, setNewColor] = useState("#7a5500")
  const [newSessionIds, setNewSessionIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // Sessions that have an id (can be assigned to arcs)
  const namedSessions = sessions.filter(s => s.session_id !== null)

  function startEdit(arc: Arc) {
    setEditingId(arc.id)
    setEditName(arc.name)
    setEditColor(arc.color)
    setEditSessionIds([...arc.session_ids])
    setCreating(false)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit() {
    if (!editingId || !editName.trim()) return
    setSaving(true)
    try {
      await updateArc(editingId, { name: editName.trim(), color: editColor, session_ids: editSessionIds })
      setEditingId(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function saveNew() {
    if (!newName.trim()) return
    setSaving(true)
    try {
      await createArc(newName.trim(), newColor, newSessionIds)
      setCreating(false)
      setNewName("")
      setNewColor("#7a5500")
      setNewSessionIds([])
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(arcId: string) {
    if (confirmDeleteId !== arcId) {
      setConfirmDeleteId(arcId)
      return
    }
    setConfirmDeleteId(null)
    setDeletingId(arcId)
    try {
      await deleteArc(arcId)
      onChanged()
    } finally {
      setDeletingId(null)
    }
  }

  function toggleSession(id: string, list: string[], setList: (l: string[]) => void) {
    if (list.includes(id)) setList(list.filter(x => x !== id))
    else setList([...list, id])
  }

  return (
    <div className="arc-manager-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="arc-manager-panel">
        <div className="arc-manager-header">
          <span className="arc-manager-title">[ ARC-ADMINISTRATION ]</span>
          <button className="arc-manager-close" onClick={onClose}>✕</button>
        </div>

        <div className="arc-manager-body">
          {/* Arc list */}
          {arcs.length === 0 && !creating && (
            <div className="arc-manager-empty">INGEN ARCS REGISTRERET</div>
          )}

          {arcs.map(arc => {
            if (editingId === arc.id) {
              return (
                <ArcForm
                  key={arc.id}
                  name={editName}
                  color={editColor}
                  sessionIds={editSessionIds}
                  namedSessions={namedSessions}
                  saving={saving}
                  onNameChange={setEditName}
                  onColorChange={setEditColor}
                  onToggleSession={id => toggleSession(id, editSessionIds, setEditSessionIds)}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                  presetColors={PRESET_COLORS}
                />
              )
            }
            return (
              <div key={arc.id} className="arc-manager-row" style={{ "--arc-color": arc.color } as React.CSSProperties}>
                <div className="arc-manager-row-dot" />
                <div className="arc-manager-row-info">
                  <span className="arc-manager-row-name">{arc.name}</span>
                  <span className="arc-manager-row-meta">
                    {arc.session_ids.length} SESSIONER
                  </span>
                </div>
                <div className="arc-manager-row-actions">
                  <button className="arc-manager-btn" onClick={() => startEdit(arc)}>REDIGER</button>
                  <button
                    className={`arc-manager-btn arc-manager-btn--danger ${confirmDeleteId === arc.id ? "arc-manager-btn--confirm" : ""}`}
                    onClick={() => handleDelete(arc.id)}
                    disabled={deletingId === arc.id}
                  >
                    {deletingId === arc.id ? "…" : confirmDeleteId === arc.id ? "CONFIRM" : "DELETE"}
                  </button>
                </div>
              </div>
            )
          })}

          {/* New arc form */}
          {creating && (
            <ArcForm
              name={newName}
              color={newColor}
              sessionIds={newSessionIds}
              namedSessions={namedSessions}
              saving={saving}
              onNameChange={setNewName}
              onColorChange={setNewColor}
              onToggleSession={id => toggleSession(id, newSessionIds, setNewSessionIds)}
              onSave={saveNew}
              onCancel={() => { setCreating(false); setNewName(""); setNewColor("#7a5500"); setNewSessionIds([]) }}
              presetColors={PRESET_COLORS}
              isNew
            />
          )}

          {!creating && editingId === null && (
            <button
              className="arc-manager-create-btn"
              onClick={() => { setCreating(true); setEditingId(null) }}
            >
              + NY ARC
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface ArcFormProps {
  name: string
  color: string
  sessionIds: string[]
  namedSessions: TimelineSession[]
  saving: boolean
  onNameChange: (v: string) => void
  onColorChange: (v: string) => void
  onToggleSession: (id: string) => void
  onSave: () => void
  onCancel: () => void
  presetColors: string[]
  isNew?: boolean
}

function ArcForm({
  name, color, sessionIds, namedSessions, saving,
  onNameChange, onColorChange, onToggleSession, onSave, onCancel, presetColors, isNew,
}: ArcFormProps) {
  return (
    <div className="arc-form" style={{ "--arc-color": color } as React.CSSProperties}>
      <div className="arc-form-row">
        <input
          className="arc-form-input"
          value={name}
          onChange={e => onNameChange(e.target.value)}
          placeholder="Arc-navn..."
          maxLength={60}
          autoFocus
        />
      </div>

      <div className="arc-form-row arc-form-row--colors">
        <span className="arc-form-label">FARVE</span>
        <div className="arc-form-color-presets">
          {presetColors.map(c => (
            <button
              key={c}
              className={`arc-form-color-swatch ${color === c ? "arc-form-color-swatch--active" : ""}`}
              style={{ background: c, borderColor: color === c ? "#fff" : c }}
              onClick={() => onColorChange(c)}
              title={c}
            />
          ))}
          <input
            type="color"
            className="arc-form-color-picker"
            value={color}
            onChange={e => onColorChange(e.target.value)}
            title="Tilpasset farve"
          />
        </div>
      </div>

      {namedSessions.length > 0 && (
        <div className="arc-form-row arc-form-row--sessions">
          <span className="arc-form-label">SESSIONER</span>
          <div className="arc-form-sessions">
            {namedSessions.map(s => {
              const id = s.session_id!
              const active = sessionIds.includes(id)
              return (
                <button
                  key={id}
                  className={`arc-form-session-pill ${active ? "arc-form-session-pill--active" : ""}`}
                  onClick={() => onToggleSession(id)}
                >
                  {s.session_name ?? id.slice(0, 8)}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="arc-form-row arc-form-row--actions">
        <button className="arc-manager-btn arc-manager-btn--primary" onClick={onSave} disabled={saving || !name.trim()}>
          {saving ? "…" : isNew ? "OPRET" : "GEM"}
        </button>
        <button className="arc-manager-btn" onClick={onCancel} disabled={saving}>ANNULLER</button>
      </div>
    </div>
  )
}
