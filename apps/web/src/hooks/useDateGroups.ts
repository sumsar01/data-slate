import { useState, useEffect } from "react"
import type { DateGroup } from "../shared"
import { MOCK_DATA } from "../data/mockData"

const API_URL = import.meta.env.VITE_API_URL ?? ""

export function useDateGroups() {
  const [groups, setGroups] = useState<DateGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    if (!API_URL) {
      // No API configured — use mock data
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

  useEffect(() => { load() }, [])

  return { groups, loading, error, reload: load }
}
