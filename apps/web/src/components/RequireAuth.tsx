import { Navigate, useLocation } from "react-router-dom"

export function getToken(): string | null {
  return localStorage.getItem("auth_token")
}

export function clearToken() {
  localStorage.removeItem("auth_token")
}

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
