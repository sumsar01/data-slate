import { useState, useRef, useEffect, useCallback } from "react"
import { ALL_TAGS, type Tag } from "./shared"
import "./index.css"

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

export default function App() {
  const [tags, setTags] = useState<Tag[]>([])
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [level, setLevel] = useState(0)
  const [status, setStatus] = useState<Status>({ type: "idle", msg: "" })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  function toggleTag(tag: Tag) {
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag])
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
    setAudioBlob(null)
    setStatus({ type: "idle", msg: "" })
    setElapsed(0)
    chunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Level meter
      const ctx = new AudioContext()
      const source = ctx.createMediaStreamSource(stream)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser
      animFrameRef.current = requestAnimationFrame(pollLevel)

      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" })
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

  async function submit() {
    if (!audioBlob) return
    setStatus({ type: "sending", msg: "TRANSMITTING..." })

    const form = new FormData()
    form.append("audio", audioBlob, "recording.webm")
    form.append("date", todayISO())
    form.append("duration_s", String(elapsed))
    for (const t of tags) form.append("tags", t)

    try {
      const res = await fetch(`${API_URL}/notes`, { method: "POST", body: form })
      if (!res.ok) throw new Error(await res.text())
      setStatus({ type: "ok", msg: "RECORD COMMITTED // OMNISSIAH APPROVES" })
      setAudioBlob(null)
      setElapsed(0)
      setTags([])
    } catch (err: any) {
      setStatus({ type: "err", msg: `TRANSMISSION FAILED: ${err.message}` })
    }
  }

  // Cleanup on unmount
  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
  }, [])

  const canSubmit = !!audioBlob && status.type !== "sending"

  return (
    <div className="app">
      <div className="scanlines" aria-hidden />

      <header className="header">
        <div>
          <div className="header-title">DATA-SLATE // AUSPEX REC</div>
          <div className="header-sub">ADEPTUS MECHANICUS FIELD UNIT</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className={`dot ${recording ? "dot--red" : audioBlob ? "dot--amber" : "dot--green"}`} />
          <span style={{ fontSize: "0.55rem", letterSpacing: "0.08em", color: recording ? "#ff2200" : "#7a5500" }}>
            {recording ? "REC" : audioBlob ? "READY" : "STANDBY"}
          </span>
        </div>
      </header>

      <main className="main">
        {/* Tag selection */}
        <div>
          <div className="section-label">[ SELECT CLASSIFICATIONS ]</div>
          <div className="tag-grid">
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                className={`tag-btn ${tags.includes(tag) ? "tag-btn--active" : ""}`}
                onClick={() => toggleTag(tag)}
              >
                {tag.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Record controls */}
        <div>
          <div className="section-label">[ VOXCASTER ]</div>
          <div className="record-area">
            <div className="level-meter">
              <div
                className={`level-bar ${recording ? "level-bar--recording" : ""}`}
                style={{ width: `${level}%` }}
              />
            </div>

            <button
              className={`record-btn ${recording ? "record-btn--recording" : ""}`}
              onClick={recording ? stopRecording : startRecording}
              aria-label={recording ? "Stop recording" : "Start recording"}
            >
              <div className={`record-btn-inner ${recording ? "record-btn-inner--recording" : ""}`} />
            </button>

            <div className={`timer ${recording ? "timer--recording" : ""}`}>
              {formatTime(elapsed)}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div>
          <div className="section-label">[ TRANSMIT ]</div>
          <button className="submit-btn" onClick={submit} disabled={!canSubmit}>
            ▶ COMMIT TO COGITATOR
          </button>
          <div style={{ marginTop: "0.5rem" }}>
            <div className={`status-msg status-msg--${status.type}`}>
              {status.msg || (audioBlob ? "RECORDING READY FOR TRANSMISSION" : recording ? "VOXCASTER ACTIVE..." : "AWAITING RECORDING")}
            </div>
          </div>
        </div>
      </main>

      <footer className="footer">
        OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL
      </footer>
    </div>
  )
}
