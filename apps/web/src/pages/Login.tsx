import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import "../App.css"
import "./Login.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

export default function Login() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as any)?.from?.pathname ?? "/"

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? "Invalid password")
        return
      }
      const { token } = await res.json()
      localStorage.setItem("auth_token", token)
      navigate(from, { replace: true })
    } catch {
      setError("CONNECTION FAILURE — CHECK MACHINE SPIRIT")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-shell">
      <div className="scanlines" aria-hidden />
      <div className="login-panel">
        <div className="login-title">DATA-SLATE</div>
        <div className="login-sub">ADEPTUS MECHANICUS // AUTHENTICATION REQUIRED</div>
        <form className="login-form" onSubmit={handleSubmit}>
          <input
            className="login-input"
            type="password"
            placeholder="ACCESS CODE"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            disabled={loading}
          />
          <button className="login-btn" type="submit" disabled={loading || !password}>
            {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
          </button>
          {error && <div className="login-error">{error}</div>}
        </form>
      </div>
    </div>
  )
}
