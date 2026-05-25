import { Hono } from "hono"
import { sign } from "hono/jwt"

export const authRouter = new Hono()

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-me"
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? ""

// POST /auth/login — exchange password for JWT
authRouter.post("/login", async (c) => {
  const body = await c.req.json<{ password: string }>().catch(() => null)
  if (!body?.password) return c.json({ error: "Missing password" }, 400)

  if (!ADMIN_PASSWORD) {
    console.error("[AUTH] ADMIN_PASSWORD env var is not set")
    return c.json({ error: "Server misconfiguration" }, 500)
  }

  if (body.password !== ADMIN_PASSWORD) {
    return c.json({ error: "Invalid password" }, 401)
  }

  const exp = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days
  const token = await sign({ exp }, JWT_SECRET)

  return c.json({ token })
})
