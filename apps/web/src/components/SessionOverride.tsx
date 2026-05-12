import { useState } from "react"
import "./SessionOverride.css"

interface Props {
  date: string
  currentName: string | null
  onSave: (name: string) => Promise<void>
}

export function SessionOverride({ date, currentName, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(currentName ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!value.trim()) return
    setSaving(true)
    try {
      await onSave(value.trim())
      setEditing(false)
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave()
    if (e.key === "Escape") { setEditing(false); setValue(currentName ?? "") }
  }

  if (!editing) {
    return (
      <button
        className="session-override-trigger"
        onClick={() => { setValue(currentName ?? ""); setEditing(true) }}
        title="Set session name"
      >
        {currentName
          ? <span className="session-override-name">{currentName}</span>
          : <span className="session-override-empty">[ SET SESSION NAME ]</span>
        }
        <span className="session-override-edit-icon">✎</span>
      </button>
    )
  }

  return (
    <div className="session-override-form">
      <input
        className="session-override-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={`Session name for ${date}`}
        autoFocus
        maxLength={80}
      />
      <button
        className="session-override-btn session-override-btn--save"
        onClick={handleSave}
        disabled={saving || !value.trim()}
      >
        {saving ? "..." : "OK"}
      </button>
      <button
        className="session-override-btn session-override-btn--cancel"
        onClick={() => { setEditing(false); setValue(currentName ?? "") }}
      >
        ✕
      </button>
    </div>
  )
}
