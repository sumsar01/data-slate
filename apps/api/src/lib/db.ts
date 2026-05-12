import { createClient, type Client } from "@libsql/client/web"

let _db: Client | null = null

export function getDb(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_URL!,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  }
  return _db
}

// Convenience alias used throughout routes
export const db = new Proxy({} as Client, {
  get(_target, prop) {
    return (getDb() as any)[prop]
  },
})
