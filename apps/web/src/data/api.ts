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

