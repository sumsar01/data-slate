// Auth token helpers — kept in a separate file from RequireAuth to satisfy
// React Fast Refresh (only-export-components rule).

export function getToken(): string | null {
  return localStorage.getItem("auth_token")
}

export function clearToken() {
  localStorage.removeItem("auth_token")
}

export function isTokenValid(): boolean {
  const token = getToken()
  if (!token) return false
  try {
    const payload = JSON.parse(atob(token.split(".")[1]))
    return typeof payload.exp === "number" && payload.exp > Date.now() / 1000
  } catch {
    return false
  }
}
