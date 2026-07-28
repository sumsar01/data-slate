import { describe, expect, test } from "bun:test"
import { authRouter } from "./auth"

const login = (body: unknown) =>
  authRouter.request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /auth/login", () => {
  test("rejects a missing password", async () => {
    const res = await login({})
    expect(res.status).toBe(400)
  })

  test("rejects an incorrect password", async () => {
    const res = await login({ password: "wrong-password" })
    expect(res.status).toBe(401)
  })

  test("issues a JWT for the correct password", async () => {
    // ADMIN_PASSWORD/JWT_SECRET are set via the "test" script's env so auth.ts's
    // module-level constants (evaluated at import time) pick them up.
    const res = await login({ password: process.env.ADMIN_PASSWORD })
    expect(res.status).toBe(200)
    const { token } = await res.json()
    expect(typeof token).toBe("string")
    expect(token.split(".")).toHaveLength(3)
  })
})
