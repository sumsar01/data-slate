// Auth token helpers — kept in a separate file from RequireAuth to satisfy
// React Fast Refresh (only-export-components rule).

export function getToken(): string | null {
  return localStorage.getItem("auth_token")
}

export function clearToken() {
  localStorage.removeItem("auth_token")
}
