import { useEffect, useRef, useState } from "react"
import { preloadSounds, soundLineTick, soundLineOK, soundWarning, soundBootHum } from "../audio/sounds"
import "./BootSequence.css"

const BOOT_LINES = [
  "ADEPTUS MECHANICUS // PORTABLE COGITATOR UNIT MK.IV",
  "OMNISSIAH BLESS THIS MACHINE-SPIRIT",
  "",
  "INITIALIZING PRIMARY COGITATOR ARRAY..........[ OK ]",
  "LOADING MNEMONIC ENGRAMS........................[ OK ]",
  "AUSPEX SUBSYSTEM ONLINE.........................[ OK ]",
  "VERIFYING MACHINE SPIRIT INTEGRITY..............[ OK ]",
  "CHECKING DATA-COIL INTEGRITY....................[ OK ]",
  "MOUNTING LEXMECHANIC PROTOCOLS..................[ OK ]",
  "ESTABLISHING NOOSPHERIC LINK....................[ OK ]",
  "SERVO-SKULL UPLINK..............................[ OK ]",
  "",
  "WARNING: 3 UNPROCESSED AUSPEX RECORDS DETECTED",
  "WARNING: MEMORY ENGRAM LAST PURGED 28 CYCLES AGO",
  "",
  "ALL SYSTEMS NOMINAL",
  "PRAISE THE OMNISSIAH",
  "",
  "LOADING DATA-SLATE INTERFACE...",
]

interface Props {
  onComplete: () => void
}

function playLineSound(line: string) {
  if (!line) return
  if (line.startsWith("WARNING")) {
    soundWarning()
  } else if (line.includes("[ OK ]")) {
    soundLineOK()
  } else {
    soundLineTick()
  }
}

export function BootSequence({ onComplete }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const [started, setStarted] = useState(false)
  const onCompleteRef = useRef(onComplete)
  const skipRef = useRef(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  function finish() {
    setDone(true)
    setTimeout(() => onCompleteRef.current(), 600)
  }

  function handleStart() {
    if (started) return
    setStarted(true)
    preloadSounds()
    soundBootHum()
  }

  function handleSkip() {
    if (!started) {
      handleStart()
      return
    }
    if (done) return
    // Skip: show all lines immediately
    skipRef.current = true
    if (intervalRef.current) clearInterval(intervalRef.current)
    setLines([...BOOT_LINES])
    finish()
  }

  useEffect(() => {
    if (!started) return

    let i = 0
    intervalRef.current = setInterval(() => {
      if (skipRef.current) return
      if (i < BOOT_LINES.length) {
        const line = BOOT_LINES[i]
        setLines((prev) => [...prev, line])
        playLineSound(line)
        i++
      } else {
        if (intervalRef.current) clearInterval(intervalRef.current)
        setTimeout(() => {
          if (!skipRef.current) finish()
        }, 400)
      }
    }, 90)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [started])

  return (
    <div
      className={`boot-sequence ${done ? "boot-fade-out" : ""}`}
      onClick={handleSkip}
      onTouchStart={handleSkip}
    >
      <div className="boot-content">
        {!started && (
          <div className="boot-prompt">[ TAP TO INITIALIZE ]</div>
        )}
        {lines.map((line, idx) => (
          <div key={idx} className={`boot-line ${line && line.startsWith("WARNING") ? "boot-warning" : ""}`}>
            {line || "\u00A0"}
          </div>
        ))}
        {started && !done && <span className="boot-cursor">█</span>}
        {started && !done && (
          <div className="boot-skip-hint">[ TAP TO SKIP ]</div>
        )}
      </div>
    </div>
  )
}
