import { useState, useRef, useEffect, useCallback } from "react"
import { Link } from "react-router-dom"
import { ALL_TAGS, type Tag } from "../shared"
import { authFetch } from "../data/api"
import "./Record.css"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001"

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0")
  const s = (seconds % 60).toString().padStart(2, "0")
  return `${m}:${s}`
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

type Status = { type: "idle" | "sending" | "ok" | "err"; msg: string }

export default function Record() {
  const [tags, setTags] = useState<Tag[]>([])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [level, setLevel] = useState(0)
  const [status, setStatus] = useState<Status>({ type: "idle", msg: "" })
  const [warnNoTags, setWarnNoTags] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function toggleTag(tag: Tag) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
    setWarnNoTags(false)
  }

  const pollLevel = useCallback(() => {
    if (!analyserRef.current) return
    const data = new Uint8Array(analyserRef.current.fftSize)
    analyserRef.current.getByteTimeDomainData(data)
    let sum = 0
    for (const v of data) sum += Math.abs(v - 128)
    setLevel(Math.min(100, (sum / data.length) * 4))
    animFrameRef.current = requestAnimationFrame(pollLevel)
  }, [])

  async function startRecording() {
    // Tag reminder — first tap warns, second tap proceeds
    if (tags.length === 0 && !warnNoTags) {
      setWarnNoTags(true)
      return
    }
    setWarnNoTags(false)
    setAudioBlob(null)
    setStatus({ type: "idle", msg: "" })
    setElapsed(0)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      animFrameRef.current = requestAnimationFrame(pollLevel)

      // Prefer webm, fall back to mp4 for Safari/iOS
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4"
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        setLevel(0)
      }
      mr.start(250)

      setRecording(true)
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
    } catch {
      setStatus({ type: "err", msg: "MICROPHONE ACCESS DENIED" })
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop()
    if (timerRef.current) clearInterval(timerRef.current)
    setRecording(false)
  }

  function discard() {
    setAudioBlob(null)
    setElapsed(0)
    setStatus({ type: "idle", msg: "" })
    setWarnNoTags(false)
  }

  async function submit() {
    if (!audioBlob) return
    setStatus({ type: "sending", msg: "TRANSMITTING..." })

    const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm"
    const form = new FormData()
    form.append("audio", audioBlob, `recording.${ext}`)
    form.append("date", todayISO())
    form.append("duration_s", String(elapsed))
    for (const t of tags) form.append("tags", t)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 3 * 60 * 1000) // 3 min timeout
      try {
        const res = await authFetch(`${API_URL}/notes`, { method: "POST", body: form, signal: controller.signal })
        clearTimeout(timeout)
        if (!res.ok) throw new Error(await res.text())
      } finally {
        clearTimeout(timeout)
      }
      setStatus({ type: "ok", msg: "RECORD COMMITTED // OMNISSIAH APPROVES" })
      setAudioBlob(null)
      setElapsed(0)
      setTags([])
    } catch (err: any) {
      const msg = err.name === "AbortError" ? "TRANSMISSION TIMEOUT — COGITATOR OVERLOADED" : `TRANSMISSION FAILED: ${err.message}`
      setStatus({ type: "err", msg })
    }
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const canSubmit = !!audioBlob && status.type !== "sending"

  return (
    <div className="rec-app">
      <div className="scanlines" aria-hidden />

      <header className="rec-header">
        <div>
          <div className="rec-header-title">DATA-SLATE // AUSPEX REC</div>
          <div className="rec-header-sub">ADEPTUS MECHANICUS FIELD UNIT</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className={`rec-dot ${recording ? "rec-dot--red" : audioBlob ? "rec-dot--amber" : "rec-dot--green"}`} />
          <Link to="/" className="rec-back-link">◄ LOG</Link>
        </div>
      </header>

      <main className="rec-main">
        <div>
          <div className="rec-section-label">[ SELECT CLASSIFICATIONS ]</div>
          {warnNoTags && (
            <div className="rec-warn-banner">
              ⚠ NO CLASSIFICATION SELECTED — TAP REC AGAIN TO PROCEED UNCLASSIFIED
            </div>
          )}
          <div className="rec-tag-grid">
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                className={`rec-tag-btn ${tags.includes(tag) ? "rec-tag-btn--active" : ""}`}
                onClick={() => toggleTag(tag)}
              >
                {tag.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="rec-section-label">[ VOXCASTER ]</div>
          <div className="rec-record-area">
            <div className="rec-level-meter">
              <div
                className={`rec-level-bar ${recording ? "rec-level-bar--recording" : ""}`}
                style={{ width: `${level}%` }}
              />
            </div>

            <button
              className={`rec-record-btn ${recording ? "rec-record-btn--recording" : ""}`}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              <div className={`rec-record-btn-inner ${recording ? "rec-record-btn-inner--recording" : ""}`} />
            </button>

            <div className={`rec-timer ${recording ? "rec-timer--recording" : ""}`}>
              {formatTime(elapsed)}
            </div>
          </div>
        </div>

        <div>
          <div className="rec-section-label">[ TRANSMIT ]</div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="rec-submit-btn" onClick={submit} disabled={!canSubmit} style={{ flex: 1 }}>
              ▶ COMMIT TO COGITATOR
            </button>
            {audioBlob && status.type !== "sending" && (
              <button className="rec-discard-btn" onClick={discard} aria-label="Discard recording">
                ✕ DISCARD
              </button>
            )}
          </div>
          <div style={{ marginTop: "0.5rem" }}>
            <div className={`rec-status-msg rec-status-msg--${status.type}`}>
              {status.msg || (audioBlob ? "RECORDING READY FOR TRANSMISSION" : recording ? "VOXCASTER ACTIVE..." : "AWAITING RECORDING")}
            </div>
          </div>
        </div>
      </main>

      <footer className="rec-footer">
        OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL
      </footer>
    </div>
  )
}
