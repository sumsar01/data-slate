const API_URL = import.meta.env.VITE_API_URL ?? ""

export async function upsertSession(date: string, name: string, existingId?: string): Promise<void> {
  if (!API_URL) return // mock mode — no-op

  if (existingId) {
    await fetch(`${API_URL}/sessions/${existingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dates: [date] }),
    })
  } else {
    await fetch(`${API_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dates: [date] }),
    })
  }
}

export async function deleteNote(id: string): Promise<void> {
  if (!API_URL) return
  const res = await fetch(`${API_URL}/notes/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
}

export async function generateSummary(sessionId: string): Promise<string> {
  if (!API_URL) throw new Error("No API configured")
  const res = await fetch(`${API_URL}/sessions/${sessionId}/summary`, { method: "POST" })
  if (!res.ok) throw new Error(`Summary failed: HTTP ${res.status}`)
  const data = await res.json()
  return data.summary as string
}

export async function autoAnalyseSession(dates: string[]): Promise<{ id: string; name: string; summary: string }> {
  if (!API_URL) throw new Error("No API configured")
  const res = await fetch(`${API_URL}/sessions/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  })
  if (!res.ok) throw new Error(`Auto-analyse failed: HTTP ${res.status}`)
  return res.json()
}
