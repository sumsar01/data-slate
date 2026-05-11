import { useState, useEffect, useRef } from "react"
import { soundTypewriterKey } from "../audio/sounds"

export function useTypewriter(text: string, active: boolean, speed = 20) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const soundIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const indexRef = useRef(0)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    if (timerRef.current) clearTimeout(timerRef.current)
    if (soundIntervalRef.current) clearInterval(soundIntervalRef.current)

    if (!active || !text) return

    // Sound fires every 900ms, completely independent of character speed
    soundIntervalRef.current = setInterval(() => {
      soundTypewriterKey()
    }, 900)

    function next() {
      indexRef.current += 1
      const idx = indexRef.current
      setDisplayed(text.slice(0, idx))
      if (idx < text.length) {
        timerRef.current = setTimeout(next, speed)
      } else {
        setDone(true)
        if (soundIntervalRef.current) clearInterval(soundIntervalRef.current)
      }
    }

    timerRef.current = setTimeout(next, speed)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (soundIntervalRef.current) clearInterval(soundIntervalRef.current)
    }
  }, [text, active, speed])

  return { displayed, done }
}
