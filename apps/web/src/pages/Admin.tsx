import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { DateGroup } from "../shared"
import { exportGroupsToMarkdown, exportSessionToMarkdown, downloadMarkdown } from "../data/export"
import "./Admin.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

type ShareRecord = {
  id: string
  token: string
  session_id: string
  session_name: string | null
  created_at: string
  expires_at: string | null
}

export default function Admin() {
  const [groups, setGroups] = useState<DateGroup[]>([])
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingShareFor, setCreatingShareFor] = useState<string | null>(null)
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null)
  const [retryingNoteId, setRetryingNoteId] = useState<string | null>(null)
  const [flavouring, setFlavouring] = useState(false)
  const [flavourResult, setFlavourResult] = useState<{ processed: number; failed: number; total: number } | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/dates`).then((r) => r.json()),
      fetch(`${API_URL}/shares`).then((r) => r.json()),
    ]).then(([g, s]) => {
      setGroups(g)
      setShares(s)
    }).finally(() => setLoading(false))
  }, [])

  async function createShare(sessionId: string) {
    setCreatingShareFor(sessionId)
    setNewShareUrl(null)
    try {
      const res = await fetch(`${API_URL}/shares`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId }),
      })
      const data = await res.json()
      const url = `${window.location.origin}/share/${data.token}`
      setNewShareUrl(url)
      setShares((prev) => [{ ...data, session_name: null }, ...prev])
    } catch (e) {
      console.error(e)
    } finally {
      setCreatingShareFor(null)
    }
  }

  async function revokeShare(shareId: string) {
    await fetch(`${API_URL}/shares/${shareId}`, { method: "DELETE" })
    setShares((prev) => prev.filter((s) => s.id !== shareId))
  }

  async function retryEntities(noteId: string, transcript: string) {
    setRetryingNoteId(noteId)
    try {
      await fetch(`${API_URL}/notes/${noteId}/entities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }) })
    } catch {
      // silently ignore
    } finally {
      setRetryingNoteId(null)
    }
  }

  async function flavourAll() {
    setFlavouring(true)
    setFlavourResult(null)
    try {
      const res = await fetch(`${API_URL}/notes/flavour-all`, { method: "POST" })
      const data = await res.json()
      setFlavourResult(data)
      // Reload groups to reflect updated transcripts/titles
      const g = await fetch(`${API_URL}/dates`).then((r) => r.json())
      setGroups(g)
    } catch (e) {
      console.error(e)
    } finally {
      setFlavouring(false)
    }
  }

  const webOrigin = window.location.origin

  if (loading) {
    return (
      <div className="admin-shell">
        <div className="scanlines" aria-hidden />
        <div className="admin-loading">INITIALISING COGITATOR SYSTEMS...</div>
      </div>
    )
  }

  const allNotes = groups.flatMap((g) => g.notes)
  const missingEntities = allNotes.filter((n) => !n.entities || n.entities.length === 0)

  return (
    <div className="admin-shell">
      <div className="scanlines" aria-hidden />

      <header className="admin-header">
        <div>
          <div className="admin-header-title">DATA-SLATE MK.IV // ADMIN COGITATOR</div>
          <div className="admin-header-sub">ADEPTUS MECHANICUS RESTRICTED ACCESS</div>
        </div>
        <Link to="/" className="admin-back-link">◄ LOG</Link>
      </header>

      <main className="admin-main">

        {/* ── Export ─────────────────────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-title">[ DATA EXPORT ]</div>
          <div className="admin-row">
            <button
              className="admin-btn"
              onClick={() => downloadMarkdown(exportGroupsToMarkdown(groups), `data-slate-all-${new Date().toISOString().slice(0,10)}.md`)}
            >
              ↓ ALL SESSIONS
            </button>
          </div>
          <div className="admin-divider" />
          {groups.map((group) => (
            <div key={group.date} className="admin-row">
              <span className="admin-label">{group.session_name ?? group.date}</span>
              <button
                className="admin-btn admin-btn--sm"
                onClick={() => downloadMarkdown(exportSessionToMarkdown(group), `data-slate-${group.date}.md`)}
              >
                ↓ EXPORT
              </button>
            </div>
          ))}
        </section>

        {/* ── Share links ────────────────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-title">[ SHARE LINKS ]</div>
          {newShareUrl && (
            <div className="admin-share-url">
              <span className="admin-share-url-label">NEW LINK:</span>
              <input className="admin-share-url-input" value={newShareUrl} readOnly onClick={(e) => (e.target as HTMLInputElement).select()} />
            </div>
          )}
          {groups.filter((g) => g.session_id).map((group) => (
            <div key={group.date} className="admin-row">
              <span className="admin-label">{group.session_name ?? group.date}</span>
              <button
                className="admin-btn admin-btn--sm"
                onClick={() => createShare(group.session_id!)}
                disabled={creatingShareFor === group.session_id}
              >
                {creatingShareFor === group.session_id ? "CREATING..." : "+ SHARE"}
              </button>
            </div>
          ))}
          {shares.length > 0 && (
            <>
              <div className="admin-divider" />
              <div className="admin-section-subtitle">ACTIVE LINKS</div>
              {shares.map((share) => (
                <div key={share.id} className="admin-row admin-row--share">
                  <a
                    href={`${webOrigin}/share/${share.token}`}
                    target="_blank"
                    rel="noreferrer"
                    className="admin-share-link"
                  >
                    {share.session_name ?? share.session_id} ↗
                  </a>
                  <button className="admin-btn admin-btn--danger admin-btn--sm" onClick={() => revokeShare(share.id)}>
                    REVOKE
                  </button>
                </div>
              ))}
            </>
          )}
        </section>

        {/* ── Entity extraction status ────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-title">[ ENTITY INDEX STATUS ]</div>
          <div className="admin-row">
            <span className="admin-label">TOTAL NOTES</span>
            <span className="admin-value">{allNotes.length}</span>
          </div>
          <div className="admin-row">
            <span className="admin-label">WITH ENTITIES</span>
            <span className="admin-value">{allNotes.length - missingEntities.length}</span>
          </div>
          <div className="admin-row">
            <span className="admin-label">MISSING ENTITIES</span>
            <span className={`admin-value ${missingEntities.length > 0 ? "admin-value--warn" : ""}`}>
              {missingEntities.length}
            </span>
          </div>
          {missingEntities.length > 0 && (
            <>
              <div className="admin-divider" />
              <div className="admin-section-subtitle">AWAITING EXTRACTION</div>
              {missingEntities.map((note) => (
                <div key={note.id} className="admin-row">
                  <span className="admin-label admin-label--dim">{note.title}</span>
                  <button
                    className="admin-btn admin-btn--sm"
                    onClick={() => retryEntities(note.id, note.transcript)}
                    disabled={retryingNoteId === note.id}
                  >
                    {retryingNoteId === note.id ? "..." : "↺ RETRY"}
                  </button>
                </div>
              ))}
            </>
          )}
        </section>

        {/* ── Transcript flavouring ───────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-title">[ TRANSCRIPT FLAVOURING ]</div>
          <div className="admin-row">
            <span className="admin-label admin-label--dim">
              Rewrite all transcripts with 40K in-world terminology. Re-extracts entities after processing.
            </span>
          </div>
          {flavourResult && (
            <div className="admin-row">
              <span className={`admin-value ${flavourResult.failed > 0 ? "admin-value--warn" : ""}`}>
                {flavourResult.processed}/{flavourResult.total} PROCESSED
                {flavourResult.failed > 0 ? ` // ${flavourResult.failed} FAILED` : " // SUCCESS"}
              </span>
            </div>
          )}
          <div className="admin-row">
            <button
              className="admin-btn"
              onClick={flavourAll}
              disabled={flavouring}
            >
              {flavouring ? "COGITATOR PROCESSING... (this may take several minutes)" : "⚙ FLAVOUR ALL TRANSCRIPTS"}
            </button>
          </div>
        </section>

      </main>

      <footer className="admin-footer">
        OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL
      </footer>
    </div>
  )
}
