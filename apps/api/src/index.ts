import { Hono } from "hono"
import { cors } from "hono/cors"
import { jwt } from "hono/jwt"
import type { Context, Next } from "hono"
import { notesRouter } from "./routes/notes"
import { datesRouter } from "./routes/dates"
import { sessionsRouter } from "./routes/sessions"
import { sharesRouter, publicSharesRouter } from "./routes/shares"
import { wikiRouter } from "./routes/wiki"
import { authRouter } from "./routes/auth"

const app = new Hono()

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["*"]

app.use("*", cors({
  origin: allowedOrigins.length === 1 ? allowedOrigins[0] : allowedOrigins,
  allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}))

app.onError((err, c) => {
  console.error(`[ERROR] ${c.req.method} ${c.req.url}:`, err)
  return c.json({ error: err.message }, 500)
})

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me"
const jwtMiddleware = jwt({ secret: JWT_SECRET })

// Require auth on any non-GET request, or always (for fully-protected paths)
function requireAuth(c: Context, next: Next) {
  return jwtMiddleware(c, next)
}

function requireAuthForWrites(c: Context, next: Next) {
  if (c.req.method === "GET" || c.req.method === "OPTIONS") return next()
  return jwtMiddleware(c, next)
}

// ── Public routes ──────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }))
app.route("/auth", authRouter)

// Public share view — GET /shares/shared/:token only
app.route("/shares", publicSharesRouter)

// ── Route-level auth ───────────────────────────────────────────────────────

// /notes — always protected (admin + record use only)
app.use("/notes/*", requireAuth)
app.use("/notes", requireAuth)

// /shares — protected (publicSharesRouter already handles the public path above)
app.use("/shares/*", requireAuth)
app.use("/shares", requireAuth)

// /dates, /sessions, /wiki — GET is public (used by home/wiki/timeline pages),
// mutations require auth
app.use("/dates/*", requireAuthForWrites)
app.use("/dates", requireAuthForWrites)
app.use("/sessions/*", requireAuthForWrites)
app.use("/sessions", requireAuthForWrites)
app.use("/wiki/*", requireAuthForWrites)
app.use("/wiki", requireAuthForWrites)

// ── Routers ────────────────────────────────────────────────────────────────
app.route("/notes", notesRouter)
app.route("/dates", datesRouter)
app.route("/sessions", sessionsRouter)
app.route("/shares", sharesRouter)
app.route("/wiki", wikiRouter)

export default {
  port: parseInt(process.env.PORT ?? "3001"),
  fetch: app.fetch,
  maxRequestBodySize: 100 * 1024 * 1024, // 100MB — supports ~3h of audio
}
