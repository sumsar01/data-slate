import { useState, useEffect, useRef } from "react"
import { soundTypewriterKey } from "../audio/sounds"

export function useTypewriter(text: string, active: boolean, speed = 20) {
  const [displayed, setDisplayed] = useState("")
  const [done, setDone] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(0)

  useEffect(() => {
    setDisplayed("")
    setDone(false)
    indexRef.current = 0
    if (timerRef.current) clearTimeout(timerRef.current)

    if (!active || !text) return

    function next() {
      indexRef.current += 1
      const idx = indexRef.current
      setDisplayed(text.slice(0, idx))
      if (idx % 12 === 0) soundTypewriterKey()
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

  return { displayed, done }
}
