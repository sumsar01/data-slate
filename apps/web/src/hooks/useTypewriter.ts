import { useState, useEffect, useRef, useCallback } from "react"
import { soundTerminalBlip } from "../audio/sounds"

const BLIP_EVERY = 4 // play sound every N characters

export function useTypewriter(text: string, active: boolean, speed = 12) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(0)
  const skipRef = useRef(false)

  // Call this to instantly complete the reveal
  const skip = useCallback(() => {
    skipRef.current = true
  }, [])

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    skipRef.current = false
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!active || !text) return

    function next() {
      // Skip requested — show everything immediately
      if (skipRef.current) {
        setDisplayed(text)
        setDone(true)
        return
      }

      indexRef.current += 1
      const idx = indexRef.current
      const char = text[idx - 1]

      // Sound every BLIP_EVERY chars, skip whitespace-only positions
      if (idx % BLIP_EVERY === 0 && char && char.trim()) {
        soundTerminalBlip()
      }

      setDisplayed(text.slice(0, idx))

      if (idx < text.length) {
        timerRef.current = setTimeout(next, speed)
      } else {
        setDone(true)
      }
    }

    timerRef.current = setTimeout(next, speed)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [text, active, speed])

  return { displayed, done, skip }
}
