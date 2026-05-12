import { Hono } from "hono"
import { cors } from "hono/cors"
import { notesRouter } from "./routes/notes"
import { datesRouter } from "./routes/dates"
import { sessionsRouter } from "./routes/sessions"

const app = new Hono()

app.use("*", cors({
  origin: process.env.CORS_ORIGIN ?? "*",
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

export default {
  port: parseInt(process.env.PORT ?? "3001"),
  fetch: app.fetch,
}
