import { useState, useEffect, useRef } from "react"
import type { DateGroup } from "../shared"
import { MOCK_DATA } from "../data/mockData"

const API_URL = import.meta.env.VITE_API_URL ?? ""
const POLL_INTERVAL_MS = 30_000

export function useDateGroups(paused = false) {
  const [groups, setGroups] = useState<DateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pausedRef = useRef(paused)

  useEffect(() => { pausedRef.current = paused }, [paused])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    setError(null)
    if (!API_URL) {
      setGroups(MOCK_DATA)
      setLoading(false)
      return
    }
    try {
      const res = await fetch(`${API_URL}/dates`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: DateGroup[] = await res.json()
      setGroups(data)
    } catch (e: any) {
      console.warn("API unavailable, falling back to mock data:", e.message)
      setGroups(MOCK_DATA)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(() => {
      if (!pausedRef.current) load(true)
    }, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])

  return { groups, loading, error, reload: () => load() }
}
