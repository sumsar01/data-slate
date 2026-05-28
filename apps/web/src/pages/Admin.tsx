import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import type { DateGroup, Tag } from '@data-slate/shared'
import { ALL_TAGS } from '@data-slate/shared'
import { exportGroupsToMarkdown, exportSessionToMarkdown, downloadMarkdown } from "../data/export"
import { createTextNote, authFetch } from "../data/api"
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

type WikiEntity = {
  id: string
  name: string
  type: string
  canonical_id: string | null
  description: string | null
  summary: string | null
  image_url: string | null
  status: string | null
}

const ENTITY_TYPES = ["NPC", "Location", "Faction", "Item", "Other"]
const ENTITY_STATUSES = ["", "VIVENDE", "MORTIS", "IGNOTUS", "HOSTILIS", "FOEDERATUS", "INQUISITUS"]

export default function Admin() {
  const [groups, setGroups] = useState<DateGroup[]>([])
  const [shares, setShares] = useState<ShareRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingShareFor, setCreatingShareFor] = useState<string | null>(null)
  const [newShareUrl, setNewShareUrl] = useState<string | null>(null)
  const [retryingNoteId, setRetryingNoteId] = useState<string | null>(null)
  const [flavouring, setFlavouring] = useState(false)
  const [flavourResult, setFlavourResult] = useState<{ processed: number; failed: number; total: number } | null>(null)

  // Wiki state
  const [wikiEntities, setWikiEntities] = useState<WikiEntity[]>([])
  const [wikiFilter, setWikiFilter] = useState("")
  const [wikiTypeFilter, setWikiTypeFilter] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<{ inserted: number } | null>(null)
  const [duplicates, setDuplicates] = useState<Array<{ a: { id: string; name: string }; b: { id: string; name: string }; similarity: string }>>([])
  const [dismissedDupes, setDismissedDupes] = useState<Set<string>>(new Set())
  const [generatingSummaryFor, setGeneratingSummaryFor] = useState<string | null>(null)
  const [patchingId, setPatchingId] = useState<string | null>(null)
  const [mergeMode, setMergeMode] = useState<string | null>(null)
  const [mergeTargetId, setMergeTargetId] = useState<string>("")
  const [uploadingImageFor, setUploadingImageFor] = useState<string | null>(null)
  const [removingImageFor, setRemovingImageFor] = useState<string | null>(null)

  // Reference log state
  const [refDate, setRefDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [refTitle, setRefTitle] = useState("")
  const [refContent, setRefContent] = useState("")
  const [refTags, setRefTags] = useState<Tag[]>([])
  const [refReference, setRefReference] = useState(true)
  const [refSubmitting, setRefSubmitting] = useState(false)
  const [refResult, setRefResult] = useState<"ok" | "err" | null>(null)

  useEffect(() => {
    Promise.all([
      authFetch(`${API_URL}/dates`).then((r) => r.json()),
      authFetch(`${API_URL}/shares`).then((r) => r.json()),
      authFetch(`${API_URL}/wiki`).then((r) => r.json()).catch(() => []),
    ]).then(([g, s, w]) => {
      setGroups(g)
      setShares(s)
      setWikiEntities(w)
    }).finally(() => setLoading(false))
  }, [])

  async function createShare(sessionId: string) {
    setCreatingShareFor(sessionId)
    setNewShareUrl(null)
    try {
      const res = await authFetch(`${API_URL}/shares`, {
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
    await authFetch(`${API_URL}/shares/${shareId}`, { method: "DELETE" })
    setShares((prev) => prev.filter((s) => s.id !== shareId))
  }

  async function retryEntities(noteId: string, transcript: string) {
    setRetryingNoteId(noteId)
    try {
      await authFetch(`${API_URL}/notes/${noteId}/entities`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript }) })
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
      const res = await authFetch(`${API_URL}/notes/flavour-all`, { method: "POST" })
      const data = await res.json()
      setFlavourResult(data)
      // Reload groups to reflect updated transcripts/titles
      const g = await authFetch(`${API_URL}/dates`).then((r) => r.json())
      setGroups(g)
    } catch (e) {
      console.error(e)
    } finally {
      setFlavouring(false)
    }
  }

  async function syncWiki() {
    setSyncing(true)
    setSyncResult(null)
    setDuplicates([])
    setDismissedDupes(new Set())
    try {
      const res = await authFetch(`${API_URL}/wiki/sync`, { method: "POST" })
      const data = await res.json()
      setSyncResult(data)
      if (data.potential_duplicates) setDuplicates(data.potential_duplicates)
      const w = await authFetch(`${API_URL}/wiki`).then((r) => r.json())
      setWikiEntities(w)
    } catch (e) {
      console.error(e)
    } finally {
      setSyncing(false)
    }
  }

  async function generateSummary(entityId: string) {
    setGeneratingSummaryFor(entityId)
    try {
      const res = await authFetch(`${API_URL}/wiki/${entityId}/summary`, { method: "POST" })
      if (res.ok) {
        const { summary } = await res.json()
        setWikiEntities((prev) => prev.map((e) => e.id === entityId ? { ...e, summary } : e))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setGeneratingSummaryFor(null)
    }
  }

  async function patchEntity(entityId: string, patch: Partial<WikiEntity>) {
    setPatchingId(entityId)
    try {
      const res = await authFetch(`${API_URL}/wiki/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setWikiEntities((prev) => prev.map((e) => e.id === entityId ? updated : e))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setPatchingId(null)
    }
  }

  async function mergeEntities(dropId: string, keepId: string) {
    try {
      await authFetch(`${API_URL}/wiki/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keep_id: keepId, drop_id: dropId }),
      })
      // Remove the dropped entity from the list
      setWikiEntities((prev) => prev.filter((e) => e.id !== dropId))
    } catch (e) {
      console.error(e)
    } finally {
      setMergeMode(null)
      setMergeTargetId("")
    }
  }

  async function uploadImage(entityId: string, file: File) {
    setUploadingImageFor(entityId)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await authFetch(`${API_URL}/wiki/${entityId}/image`, { method: "POST", body: fd })
      if (res.ok) {
        const { image_url } = await res.json()
        setWikiEntities((prev) => prev.map((e) => e.id === entityId ? { ...e, image_url } : e))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setUploadingImageFor(null)
    }
  }

  async function removeImage(entityId: string) {
    setRemovingImageFor(entityId)
    try {
      await authFetch(`${API_URL}/wiki/${entityId}/image`, { method: "DELETE" })
      setWikiEntities((prev) => prev.map((e) => e.id === entityId ? { ...e, image_url: null } : e))
    } catch (e) {
      console.error(e)
    } finally {
      setRemovingImageFor(null)
    }
  }

  async function submitRefNote() {
    if (!refDate || !refTitle.trim() || !refContent.trim()) return
    setRefSubmitting(true)
    setRefResult(null)
    try {
      await createTextNote(refDate, refTitle.trim(), refContent.trim(), refTags, refReference)
      setRefTitle("")
      setRefContent("")
      setRefTags([])
      setRefResult("ok")
    } catch (e) {
      console.error(e)
      setRefResult("err")
    } finally {
      setRefSubmitting(false)
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
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link to="/admin-mechanicus/notes" className="admin-back-link">✎ LOG ENTRIES</Link>
          <Link to="/" className="admin-back-link">◄ LOG</Link>
        </div>
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

        {/* ── Entity Wiki ─────────────────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-title">[ ENTITY WIKI ]</div>
          <div className="admin-row">
            <span className="admin-label admin-label--dim">
              Scan all transcripts and populate entity index. Safe to run repeatedly.
            </span>
          </div>
          {syncResult && (
            <div className="admin-row">
              <span className="admin-value">{syncResult.inserted} NEW ENTITIES INDEXED</span>
            </div>
          )}
          {duplicates.filter((d) => !dismissedDupes.has(`${d.a.id}:${d.b.id}`)).length > 0 && (
            <div className="admin-dupe-box">
              <div className="admin-dupe-title">⚠ POTENTIELLE DUBLETTER DETEKTERET</div>
              {duplicates
                .filter((d) => !dismissedDupes.has(`${d.a.id}:${d.b.id}`))
                .map((d) => (
                  <div key={`${d.a.id}:${d.b.id}`} className="admin-dupe-row">
                    <span className="admin-dupe-names">
                      <span className="admin-dupe-name">{d.a.name}</span>
                      <span className="admin-dupe-sep"> ↔ </span>
                      <span className="admin-dupe-name">{d.b.name}</span>
                    </span>
                    <span className={`admin-dupe-sim admin-dupe-sim--${d.similarity.toLowerCase()}`}>{d.similarity}</span>
                    <button
                      className="admin-btn admin-btn--sm admin-btn--danger"
                      onClick={() => mergeEntities(d.b.id, d.a.id)}
                    >
                      FLET →
                    </button>
                    <button
                      className="admin-btn admin-btn--sm"
                      onClick={() => setDismissedDupes((prev) => new Set([...prev, `${d.a.id}:${d.b.id}`]))}
                    >
                      AFVIS
                    </button>
                  </div>
                ))}
            </div>
          )}
          <div className="admin-row">
            <button className="admin-btn" onClick={syncWiki} disabled={syncing}>
              {syncing ? "SCANNING..." : "⚙ SYNC ENTITIES"}
            </button>
            <Link to="/wiki" className="admin-btn" style={{ textDecoration: "none", textAlign: "center" }}>
              ↗ VIEW WIKI
            </Link>
          </div>

          {wikiEntities.length > 0 && (
            <>
              <div className="admin-divider" />
              {/* Filter controls */}
              <div className="admin-row" style={{ flexWrap: "wrap", gap: "0.4rem", alignItems: "center" }}>
                <input
                  className="admin-input"
                  placeholder="FILTRER ENTITETER..."
                  value={wikiFilter}
                  onChange={(e) => setWikiFilter(e.target.value)}
                  style={{ flex: "1", minWidth: "10rem" }}
                />
                {ENTITY_TYPES.map((t) => (
                  <button
                    key={t}
                    className={`admin-btn admin-btn--sm ${wikiTypeFilter === t ? "admin-btn--active" : ""}`}
                    onClick={() => setWikiTypeFilter((prev) => prev === t ? null : t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {(() => {
                const filtered = wikiEntities.filter((e) => {
                  const nameMatch = !wikiFilter || e.name.toLowerCase().includes(wikiFilter.toLowerCase())
                  const typeMatch = !wikiTypeFilter || e.type === wikiTypeFilter
                  return nameMatch && typeMatch
                })
                return (
                  <>
                    <div className="admin-section-subtitle">
                      ENTITETER: {filtered.length}{filtered.length !== wikiEntities.length ? ` AF ${wikiEntities.length}` : ""}
                    </div>
                    {filtered.map((entity) => (
                <div key={entity.id} className="admin-row" style={{ flexWrap: "wrap", gap: "0.4rem", alignItems: "flex-start" }}>
                  <span className="admin-label" style={{ minWidth: "8rem" }}>{entity.name}</span>

                  {/* Type selector */}
                  <select
                    className="admin-select"
                    value={entity.type}
                    disabled={patchingId === entity.id}
                    onChange={(e) => patchEntity(entity.id, { type: e.target.value })}
                  >
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>

                  {/* Status selector */}
                  <select
                    className="admin-select"
                    value={entity.status ?? ""}
                    disabled={patchingId === entity.id}
                    onChange={(e) => patchEntity(entity.id, { status: e.target.value || null })}
                  >
                    {ENTITY_STATUSES.map((s) => <option key={s} value={s}>{s || "— STATUS —"}</option>)}
                  </select>

                  {/* Description inline input */}
                  <input
                    className="admin-input"
                    placeholder="Add description..."
                    defaultValue={entity.description ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value.trim()
                      if (val !== (entity.description ?? "")) {
                        patchEntity(entity.id, { description: val || null as unknown as string })
                      }
                    }}
                  />

                  {/* Image upload */}
                  {entity.image_url ? (
                    <button
                      className="admin-btn admin-btn--sm admin-btn--danger"
                      onClick={() => removeImage(entity.id)}
                      disabled={removingImageFor === entity.id}
                      title="Remove image"
                    >
                      {removingImageFor === entity.id ? "..." : "✕ IMG"}
                    </button>
                  ) : (
                    <label className="admin-btn admin-btn--sm" style={{ cursor: "pointer" }} title="Upload image">
                      {uploadingImageFor === entity.id ? "..." : "+ IMG"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={uploadingImageFor === entity.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file) uploadImage(entity.id, file)
                          e.target.value = ""
                        }}
                      />
                    </label>
                  )}

                  {/* Generate summary */}
                  <button
                    className="admin-btn admin-btn--sm"
                    onClick={() => generateSummary(entity.id)}
                    disabled={generatingSummaryFor === entity.id}
                    title={entity.summary ? "Regenerate Groq dossier" : "Generate Groq dossier"}
                  >
                    {generatingSummaryFor === entity.id ? "..." : entity.summary ? "↺ DOSSIER" : "+ DOSSIER"}
                  </button>

                  {/* Merge */}
                  {mergeMode === entity.id ? (
                    <>
                      <select
                        className="admin-select"
                        value={mergeTargetId}
                        onChange={(e) => setMergeTargetId(e.target.value)}
                      >
                        <option value="">→ merge into...</option>
                        {wikiEntities.filter((e) => e.id !== entity.id).map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                      <button
                        className="admin-btn admin-btn--sm admin-btn--danger"
                        disabled={!mergeTargetId}
                        onClick={() => mergeEntities(entity.id, mergeTargetId)}
                      >
                        CONFIRM
                      </button>
                      <button
                        className="admin-btn admin-btn--sm"
                        onClick={() => { setMergeMode(null); setMergeTargetId("") }}
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      className="admin-btn admin-btn--sm"
                      onClick={() => { setMergeMode(entity.id); setMergeTargetId("") }}
                      title="Merge this entity into another (marks as duplicate)"
                    >
                        ⇒ MERGE
                      </button>
                    )}
                  </div>
                ))}
                  </>
                )
              })()}
            </>
          )}
        </section>

        {/* ── Reference Log ───────────────────────────────────── */}
        <section className="admin-section">
          <div className="admin-section-title">[ REFERENCE LOG ]</div>
          <div className="admin-row">
            <span className="admin-label admin-label--dim">
              Log wiki entries, NPCs, or lore that are excluded from session summaries by default.
            </span>
          </div>
          <div className="admin-row">
            <label className="admin-label">DATE</label>
            <input
              className="admin-input"
              type="date"
              value={refDate}
              onChange={(e) => setRefDate(e.target.value)}
            />
          </div>
          <div className="admin-row">
            <label className="admin-label">TITLE</label>
            <input
              className="admin-input"
              style={{ flex: 1 }}
              placeholder="e.g. Inquisitor Krell"
              value={refTitle}
              onChange={(e) => setRefTitle(e.target.value)}
            />
          </div>
          <div className="admin-row" style={{ alignItems: "flex-start" }}>
            <label className="admin-label" style={{ paddingTop: "0.2rem" }}>CONTENT</label>
            <textarea
              className="admin-input"
              style={{ flex: 1, minHeight: "6rem", resize: "vertical" }}
              placeholder="Notes about this entity or lore entry..."
              value={refContent}
              onChange={(e) => setRefContent(e.target.value)}
            />
          </div>
          <div className="admin-row" style={{ flexWrap: "wrap", gap: "0.4rem" }}>
            <span className="admin-label">TAGS</span>
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                className={`admin-btn admin-btn--sm ${refTags.includes(tag) ? "admin-btn--active" : ""}`}
                onClick={() => setRefTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])}
              >
                {tag}
              </button>
            ))}
          </div>
          <div className="admin-row">
            <label className="admin-label" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={refReference}
                onChange={(e) => setRefReference(e.target.checked)}
              />
              REFERENCE (exclude from summaries)
            </label>
          </div>
          {refResult && (
            <div className="admin-row">
              <span className={`admin-value ${refResult === "err" ? "admin-value--warn" : ""}`}>
                {refResult === "ok" ? "ENTRY LOGGED // SUCCESS" : "ERROR — ENTRY FAILED"}
              </span>
            </div>
          )}
          <div className="admin-row">
            <button
              className="admin-btn"
              onClick={submitRefNote}
              disabled={refSubmitting || !refDate || !refTitle.trim() || !refContent.trim()}
            >
              {refSubmitting ? "LOGGING..." : "+ LOG ENTRY"}
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
