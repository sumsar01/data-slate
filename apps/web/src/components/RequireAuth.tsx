import { Navigate, useLocation } from "react-router-dom"
import { isTokenValid, clearToken } from "../lib/auth"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  if (!isTokenValid()) {
    clearToken()
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
