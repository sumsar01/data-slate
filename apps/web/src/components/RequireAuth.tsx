import { Navigate, useLocation } from "react-router-dom"
import { getToken } from "../lib/auth"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const token = getToken()

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
