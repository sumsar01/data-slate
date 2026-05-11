import { useState, useEffect, useRef } from "react"
import { soundTypewriterKey } from "../audio/sounds"

export function useTypewriter(text: string, active: boolean, speed = 16) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const rafRef = useRef<number | null>(null)
  const indexRef = useRef(0)
  const lastRef = useRef(0)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    lastRef.current = 0

    if (!active || !text) return

    function tick(now: number) {
      if (now - lastRef.current >= speed) {
        indexRef.current += 1
        setDisplayed(text.slice(0, indexRef.current))
        // Play a key sound every ~3 characters to avoid being overwhelming
        if (indexRef.current % 20 === 0) soundTypewriterKey()
        lastRef.current = now
        if (indexRef.current >= text.length) {
          setDone(true)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [text, active, speed])

  return { displayed, done }
}
