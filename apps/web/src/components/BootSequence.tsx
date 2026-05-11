import { useEffect, useRef, useState } from "react"
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

export function BootSequence({ onComplete }: Props) {
  const [lines, setLines] = useState<string[]>([])
  const [done, setDone] = useState(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    let i = 0
    const interval = setInterval(() => {
      if (i < BOOT_LINES.length) {
        setLines((prev) => [...prev, BOOT_LINES[i]])
        i++
      } else {
        clearInterval(interval)
        setTimeout(() => {
          setDone(true)
          setTimeout(() => onCompleteRef.current(), 600)
        }, 400)
      }
    }, 90)
    return () => {
      clearInterval(interval)
    }
  }, [])

  return (
    <div className={`boot-sequence ${done ? "boot-fade-out" : ""}`}>
      <div className="boot-content">
        {lines.map((line, idx) => (
          <div key={idx} className={`boot-line ${line && line.startsWith("WARNING") ? "boot-warning" : ""}`}>
            {line || "\u00A0"}
          </div>
        ))}
        {!done && <span className="boot-cursor">█</span>}
      </div>
    </div>
  )
}
