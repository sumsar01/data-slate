import { useState, useRef, useEffect } from "react"
import "./AudioPlayer.css"

interface Props {
  src: string
  duration_s: number
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function AudioPlayer({ src, duration_s }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(duration_s)
  const [dragging] = useState(false)
  const barRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => { if (!dragging) setCurrent(audio.currentTime) }
    const onDuration = () => { if (isFinite(audio.duration)) setDuration(audio.duration) }
    const onEnded = () => setPlaying(false)
    audio.addEventListener("timeupdate", onTime)
    audio.addEventListener("loadedmetadata", onDuration)
    audio.addEventListener("ended", onEnded)
    return () => {
      audio.removeEventListener("timeupdate", onTime)
      audio.removeEventListener("loadedmetadata", onDuration)
      audio.removeEventListener("ended", onEnded)
    }
  }, [dragging])

  function togglePlay() {
    const audio = audioRef.current
    if (!audio) return
    if (playing) { audio.pause(); setPlaying(false) }
    else { audio.play(); setPlaying(true) }
  }

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const bar = barRef.current
    const audio = audioRef.current
    if (!bar || !audio) return
    const rect = bar.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * duration
    setCurrent(audio.currentTime)
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={src} preload="metadata" />

      <button className="audio-player-btn" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
        {playing ? "⏸" : "▶"}
      </button>

      <span className="audio-player-time">{fmt(current)}</span>

      <div className="audio-player-bar" ref={barRef} onClick={seek}>
        <div className="audio-player-bar-fill" style={{ width: `${progress}%` }} />
        <div className="audio-player-bar-head" style={{ left: `${progress}%` }} />
      </div>

      <span className="audio-player-time">{fmt(duration)}</span>
    </div>
  )
}
