import { Hono } from "hono"
import { cors } from "hono/cors"
import { notesRouter } from "./routes/notes"
import { datesRouter } from "./routes/dates"
import { sessionsRouter } from "./routes/sessions"
import { sharesRouter } from "./routes/shares"
import { wikiRouter } from "./routes/wiki"

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

app.get("/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }))

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
