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
