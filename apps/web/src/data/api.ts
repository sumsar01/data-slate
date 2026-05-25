import type { Tag, Arc } from "../shared"

const API_URL = import.meta.env.VITE_API_URL ?? ""

export function getAuthHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = localStorage.getItem("auth_token")
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  }
}

export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: {
      ...getAuthHeaders(),
      ...(init.headers as Record<string, string> | undefined),
    },
  })
}

export async function upsertSession(date: string, name: string, existingId?: string): Promise<void> {
  if (!API_URL) return // mock mode — no-op

  if (existingId) {
    await authFetch(`${API_URL}/sessions/${existingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dates: [date] }),
    })
  } else {
    await authFetch(`${API_URL}/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, dates: [date] }),
    })
  }
}

export async function deleteNote(id: string): Promise<void> {
  if (!API_URL) return
  const res = await authFetch(`${API_URL}/notes/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error(`Delete failed: HTTP ${res.status}`)
}

export async function patchNote(id: string, patch: { reference?: boolean }): Promise<void> {
  if (!API_URL) return
  const res = await authFetch(`${API_URL}/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Patch failed: HTTP ${res.status}`)
}

export async function generateSummary(sessionId: string): Promise<string> {
  if (!API_URL) throw new Error("No API configured")
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/summary`, { method: "POST" })
  if (!res.ok) throw new Error(`Summary failed: HTTP ${res.status}`)
  const data = await res.json()
  return data.summary as string
}

export async function autoAnalyseSession(dates: string[]): Promise<{ id: string; name: string; summary: string }> {
  if (!API_URL) throw new Error("No API configured")
  const res = await authFetch(`${API_URL}/sessions/auto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dates }),
  })
  if (!res.ok) throw new Error(`Auto-analyse failed: HTTP ${res.status}`)
  return res.json()
}

export async function createTextNote(
  date: string,
  title: string,
  content: string,
  tags: Tag[],
  reference = true,
): Promise<void> {
  if (!API_URL) throw new Error("No API configured")
  const res = await authFetch(`${API_URL}/notes/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, title, content, tags, reference }),
  })
  if (!res.ok) throw new Error(`Create text note failed: HTTP ${res.status}`)
}

// ── Session cover image ───────────────────────────────────────────────────

export async function uploadSessionCover(sessionId: string, file: File): Promise<string> {
  if (!API_URL) throw new Error("No API configured")
  const form = new FormData()
  form.append("file", file)
  const res = await authFetch(`${API_URL}/sessions/${sessionId}/cover`, { method: "POST", body: form })
  if (!res.ok) throw new Error(`Cover upload failed: HTTP ${res.status}`)
  const data = await res.json()
  return data.cover_image_url as string
}

export async function removeSessionCover(sessionId: string): Promise<void> {
  if (!API_URL) return
  await authFetch(`${API_URL}/sessions/${sessionId}/cover`, { method: "DELETE" })
}

// ── Arcs ──────────────────────────────────────────────────────────────────

export async function fetchArcs(): Promise<Arc[]> {
  const url = `${API_URL}/sessions/arcs`
  const res = await fetch(url)
  if (!res.ok) return []
  return res.json()
}

export async function createArc(name: string, color: string, session_ids: string[]): Promise<Arc> {
  if (!API_URL) throw new Error("No API configured")
  const res = await authFetch(`${API_URL}/sessions/arcs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, color, session_ids }),
  })
  if (!res.ok) throw new Error(`Create arc failed: HTTP ${res.status}`)
  return res.json()
}

export async function updateArc(arcId: string, patch: Partial<Pick<Arc, "name" | "color" | "session_ids">>): Promise<Arc> {
  if (!API_URL) throw new Error("No API configured")
  const res = await authFetch(`${API_URL}/sessions/arcs/${arcId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`Update arc failed: HTTP ${res.status}`)
  return res.json()
}

export async function deleteArc(arcId: string): Promise<void> {
  if (!API_URL) return
  await authFetch(`${API_URL}/sessions/arcs/${arcId}`, { method: "DELETE" })
}
