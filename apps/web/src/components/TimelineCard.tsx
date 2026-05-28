import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import type { Entity, TimelineSession } from "@data-slate/shared"
import { generateSummary, uploadSessionCover, removeSessionCover, authFetch } from "../data/api"
import { toImperialDate } from "../utils/imperialDate"
import { CluesSuggestModal, type ClueSuggestion } from "./CluesSuggestModal"

interface TimelineCardProps {
  session: TimelineSession
  isLast: boolean
}

function formatDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return "—"
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.floor(totalSeconds % 60)
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return "—"
  const sorted = [...dates].sort()
  const fmt = (d: string) => {
    const [, m, day] = d.split("-")
    return `${day} ${["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"][parseInt(m) - 1]}`
  }
  if (sorted.length === 1) return fmt(sorted[0])
  return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`
}

function toRoman(n: number): string {
  const vals = [1000,900,500,400,100,90,50,40,10,9,5,4,1]
  const syms = ["M","CM","D","CD","C","XC","L","XL","X","IX","V","IV","I"]
  let out = ""
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { out += syms[i]; n -= vals[i] }
  }
  return out
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  NPC: "NPC",
  Location: "LOC",
  Faction: "FACTION",
  Item: "ITEM",
  Other: "OTHER",
}

function EntityStrip({ entities }: { entities: Entity[] }) {
  // Deduplicate by name+type
  const seen = new Set<string>()
  const unique = entities.filter(e => {
    const key = `${e.type}::${e.name}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
  if (unique.length === 0) return null
  return (
    <div className="tl-card-section tl-card-section--entities">
      <div className="tl-card-section-label">
        ENTITIES ENCOUNTERED
        <span className="tl-card-section-meta">{unique.length} LOGGED</span>
      </div>
      <div className="tl-entity-strip">
        {unique.map((e, i) => (
          <span key={i} className={`tl-entity-tag tl-entity-tag--${e.type}`}>
            {e.name}
            <span className="tl-entity-tag-type">{ENTITY_TYPE_LABELS[e.type] ?? e.type}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function TimelineCard({ session, isLast }: TimelineCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [summary, setSummary] = useState<string | null>(session.session_summary)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null | undefined>(session.session_cover_image_url)
  const [coverLoading, setCoverLoading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [suggestions, setSuggestions] = useState<ClueSuggestion[] | null>(null)
  const [transcriptCount, setTranscriptCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const totalDuration = session.notes.reduce((sum, n) => sum + (n.duration_s ?? 0), 0)
  const recordingCount = session.notes.length
  const dateRange = formatDateRange(session.dates)
  const label = session.session_name ?? `Session · ${dateRange}`
  const earliestDate = [...session.dates].sort()[0] ?? ""
  const opusNum = session.opusIndex != null ? toRoman(session.opusIndex + 1) : null
  const imperialDate = earliestDate ? toImperialDate(earliestDate) : null

  // Collect all entities across notes, deduplicated
  const allEntities: Entity[] = session.notes.flatMap(n => n.entities ?? [])

  function handleGoToLog() {
    navigate(`/?date=${earliestDate}`)
  }

  async function handleRegenerate() {
    if (!session.session_id) return
    setSummaryLoading(true)
    try {
      const newSummary = await generateSummary(session.session_id)
      setSummary(newSummary)
    } catch (e) {
      console.error("Summary regeneration failed", e)
    } finally {
      setSummaryLoading(false)
    }
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !session.session_id) return
    setCoverLoading(true)
    try {
      const url = await uploadSessionCover(session.session_id, file)
      setCoverUrl(url)
    } catch (err) {
      console.error("Cover upload failed", err)
    } finally {
      setCoverLoading(false)
    }
  }

  async function handleCoverRemove() {
    if (!session.session_id) return
    await removeSessionCover(session.session_id)
    setCoverUrl(null)
  }

  async function handleScanLeads() {
    if (!session.session_id) return
    setScanning(true)
    try {
      const API_URL = import.meta.env.VITE_API_URL ?? ""
      const res = await authFetch(`${API_URL}/clues/suggest/${session.session_id}`, { method: "POST" })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setSuggestions(data.suggestions ?? [])
      setTranscriptCount(data.transcript_count ?? 0)
    } catch {
      setSuggestions([])
    } finally {
      setScanning(false)
    }
  }

  const hasCover = !!coverUrl

  return (
    <div className="tl-entry">
      {/* spine — feature 5: chrono-seal */}
      <div className={`tl-spine ${opusNum ? "tl-spine--seal" : ""}`}>
        {opusNum ? (
          <div className="tl-seal">
            <div className="tl-seal-hex">
              <span className="tl-seal-num">{opusNum}</span>
            </div>
            <span className="tl-seal-opus">OPUS</span>
          </div>
        ) : (
          <div className="tl-node" />
        )}
        {!isLast && <div className="tl-line" />}
      </div>

      {/* card */}
      <div className="tl-card-wrap">
        {/* feature 7: cover tile (only when expanded or cover exists) */}
        {hasCover ? (
          <div
            className="tl-card-cover"
            onClick={() => setExpanded(v => !v)}
            role="button"
            aria-expanded={expanded}
          >
            <img src={coverUrl!} alt="" className="tl-card-cover-img" />
            <div className="tl-card-cover-overlay" />
            <div className="tl-card-cover-label">
              <span>{label}</span>
              <span className="tl-card-cover-sublabel">
                {dateRange} · {recordingCount} REC · {formatDuration(totalDuration)}
                {imperialDate && <> · {imperialDate}</>}
              </span>
            </div>
            {session.session_id && (
              <button
                className="tl-card-cover-remove"
                onClick={e => { e.stopPropagation(); handleCoverRemove() }}
                title="Fjern billede"
              >✕</button>
            )}
          </div>
        ) : (
          <button
            className={`tl-card-header ${expanded ? "tl-card-header--expanded" : ""}`}
            onClick={() => setExpanded(v => !v)}
            aria-expanded={expanded}
          >
            <span className="tl-card-name">{label}</span>
            <span className="tl-card-meta">
              {recordingCount} REC · {formatDuration(totalDuration)}
              {imperialDate && <span className="tl-card-imperial"> · {imperialDate}</span>}
            </span>
            <span className="tl-card-chevron">{expanded ? "▲" : "▼"}</span>
          </button>
        )}

        {expanded && (
          <div className="tl-card-body">
            {session.session_id && (
              <div className="tl-card-section tl-card-section--summary">
                <div className="tl-card-section-label">
                  BATTLE REPORT
                  {summary && (
                    <button
                      className="tl-card-regen-btn"
                      onClick={handleRegenerate}
                      disabled={summaryLoading}
                    >
                      {summaryLoading ? "PROCESSING..." : "↺ REGENERATE"}
                    </button>
                  )}
                </div>
                {summary
                  ? <div className="tl-card-summary"><ReactMarkdown>{summary}</ReactMarkdown></div>
                  : <button
                      className="tl-card-goto"
                      onClick={handleRegenerate}
                      disabled={summaryLoading}
                    >
                      {summaryLoading ? "COGITATOR PROCESSING..." : "▶ GENERATE BATTLE REPORT"}
                    </button>
                }
              </div>
            )}

            {/* feature 2: entity strip */}
            {allEntities.length > 0 && <EntityStrip entities={allEntities} />}

            <div className="tl-card-section tl-card-section--recordings">
              <div className="tl-card-section-label">
                RECORDINGS <span className="tl-card-section-meta">[{recordingCount}] · {formatDuration(totalDuration)}</span>
              </div>
              <div className="tl-card-recordings">
                {session.notes.map(n => (
                  <div key={n.id} className="tl-card-rec-row">
                    <span className="tl-card-rec-title">{n.title || "Untitled"}</span>
                    <span className="tl-card-rec-dur">{formatDuration(n.duration_s)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="tl-card-section tl-card-section--actions">
              <button className="tl-card-goto" onClick={handleGoToLog}>
                GO TO LOG →
              </button>
              {session.session_id && (
                <button
                  className="tl-card-goto tl-card-goto--dim"
                  onClick={() => navigate(`/briefing/${session.session_id}`)}
                >
                  MISSION BRIEFING →
                </button>
              )}
              {session.session_id && (
                <button
                  className="tl-card-goto tl-card-goto--dim"
                  onClick={handleScanLeads}
                  disabled={scanning}
                >
                  {scanning ? "SCANNING VOX-LOGS..." : "⊕ SCAN FOR LEADS"}
                </button>
              )}
              {/* feature 7: attach cover button */}
              {session.session_id && !hasCover && (
                <>
                  <button
                    className="tl-card-goto tl-card-goto--dim"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={coverLoading}
                  >
                    {coverLoading ? "UPLOADING..." : "⊕ ATTACH PICT"}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={handleCoverUpload}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {suggestions !== null && (
        <CluesSuggestModal
          sessionId={session.session_id!}
          sessionName={session.session_name ?? null}
          suggestions={suggestions}
          transcriptCount={transcriptCount}
          onClose={() => setSuggestions(null)}
          onSaved={() => setSuggestions(null)}
        />
      )}
    </div>
  )
}

