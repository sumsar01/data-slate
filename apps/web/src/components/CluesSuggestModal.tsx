import { useState } from "react"
import { authFetch } from "../data/api"
import "./CluesSuggestModal.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

export type ClueSuggestion = {
  title: string
  description: string
  priority: number
}

const PRIORITY_LABELS: Record<number, string> = {
  0: "CRITICAL",
  1: "HIGH",
  2: "NORMAL",
  3: "LOW",
  4: "BACKGROUND",
}

const PRIORITY_COLORS: Record<number, string> = {
  0: "#8a2a2a",
  1: "#8a5a00",
  2: "#4a7a4a",
  3: "#2a5a7a",
  4: "#3a2a4a",
}

type SuggestionState = "pending" | "approved" | "rejected"

interface Props {
  sessionId: string
  sessionName: string | null
  suggestions: ClueSuggestion[]
  onClose: () => void
  onSaved: (count: number) => void
}

export function CluesSuggestModal({ sessionName, suggestions, onClose, onSaved }: Props) {
  const [states, setStates] = useState<SuggestionState[]>(() => suggestions.map(() => "pending"))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [savedCount, setSavedCount] = useState(0)

  function setOne(i: number, state: SuggestionState) {
    setStates((prev) => prev.map((s, j) => (j === i ? state : s)))
  }

  function approveAll() {
    setStates(suggestions.map(() => "approved"))
  }

  function rejectAll() {
    setStates(suggestions.map(() => "rejected"))
  }

  async function handleConfirm() {
    const toSave = suggestions.filter((_, i) => states[i] === "approved")
    if (!toSave.length) { onClose(); return }
    setSaving(true)
    let count = 0
    for (const s of toSave) {
      try {
        const res = await authFetch(`${API_URL}/clues`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: s.title, description: s.description, priority: s.priority }),
        })
        if (res.ok) count++
      } catch { /* ignore */ }
    }
    setSavedCount(count)
    setSaving(false)
    setDone(true)
    onSaved(count)
  }

  const approvedCount = states.filter((s) => s === "approved").length
  const pendingCount = states.filter((s) => s === "pending").length

  return (
    <div className="csm-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="csm-modal">
        <div className="csm-header">
          <div className="csm-header-top">
            <span className="csm-title">// INQUISITORIAL LEAD EXTRACTION</span>
            <button className="csm-close" onClick={onClose}>✕</button>
          </div>
          {sessionName && (
            <div className="csm-session-label">SESSION: {sessionName}</div>
          )}
          <div className="csm-sub">
            {suggestions.length} LEAD{suggestions.length !== 1 ? "S" : ""} DETECTED — CONFIRM OR REJECT EACH
          </div>
        </div>

        {done ? (
          <div className="csm-done">
            <div className="csm-done-icon">✦</div>
            <div className="csm-done-text">{savedCount} LEAD{savedCount !== 1 ? "S" : ""} LOGGED TO DEAD DROP</div>
            <button className="csm-btn csm-btn--confirm" onClick={onClose}>CLOSE</button>
          </div>
        ) : (
          <>
            <div className="csm-bulk-row">
              <button className="csm-btn csm-btn--approve-all" onClick={approveAll}>
                ✓ APPROVE ALL
              </button>
              <button className="csm-btn csm-btn--reject-all" onClick={rejectAll}>
                ✕ REJECT ALL
              </button>
            </div>

            <div className="csm-list">
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className={`csm-card csm-card--${states[i]}`}
                >
                  <div className="csm-card-header">
                    <span
                      className="csm-priority-dot"
                      style={{ background: PRIORITY_COLORS[s.priority] }}
                      title={PRIORITY_LABELS[s.priority]}
                    />
                    <span className="csm-card-title">{s.title}</span>
                    <span className="csm-priority-label">{PRIORITY_LABELS[s.priority]}</span>
                  </div>
                  <div className="csm-card-desc">{s.description}</div>
                  <div className="csm-card-actions">
                    <button
                      className={`csm-btn csm-btn--approve ${states[i] === "approved" ? "csm-btn--active" : ""}`}
                      onClick={() => setOne(i, states[i] === "approved" ? "pending" : "approved")}
                    >
                      {states[i] === "approved" ? "✓ APPROVED" : "APPROVE"}
                    </button>
                    <button
                      className={`csm-btn csm-btn--reject ${states[i] === "rejected" ? "csm-btn--active-reject" : ""}`}
                      onClick={() => setOne(i, states[i] === "rejected" ? "pending" : "rejected")}
                    >
                      {states[i] === "rejected" ? "✕ REJECTED" : "REJECT"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="csm-footer">
              {pendingCount > 0 && (
                <span className="csm-footer-note">{pendingCount} unreviewed</span>
              )}
              <button
                className="csm-btn csm-btn--confirm"
                onClick={handleConfirm}
                disabled={saving || approvedCount === 0}
              >
                {saving ? "LOGGING..." : `LOG ${approvedCount} LEAD${approvedCount !== 1 ? "S" : ""} TO DEAD DROP`}
              </button>
              <button className="csm-btn csm-btn--cancel" onClick={onClose}>CANCEL</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
