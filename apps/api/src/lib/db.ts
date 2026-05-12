// Turso HTTP API client — avoids @libsql/client Bun compatibility issues

const TURSO_URL = process.env.TURSO_URL!
  .replace("libsql://", "https://")
  .replace("ws://", "http://")
  .replace("wss://", "https://")
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN!

export interface Row {
  [key: string]: string | number | null
}

type Arg = string | number | null
type StmtInput = string | { sql: string; args: Arg[] }

async function execute(stmt: StmtInput): Promise<{ rows: Row[] }> {
  const sql = typeof stmt === "string" ? stmt : stmt.sql
  const args: Arg[] = typeof stmt === "string" ? [] : (stmt.args ?? [])

  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map((v) =>
              v === null
                ? { type: "null" }
                : typeof v === "number"
                ? Number.isInteger(v) ? { type: "integer", value: String(v) } : { type: "float", value: v }
                : { type: "text", value: String(v) }
            ),
          },
        },
        { type: "close" },
      ],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Turso HTTP error ${res.status}: ${text}`)
  }

  const data = await res.json() as any
  const result = data.results?.[0]

  if (result?.type === "error") {
    throw new Error(`Turso query error: ${result.error?.message}`)
  }

  const cols: string[] = result?.response?.result?.cols?.map((c: any) => c.name) ?? []
  const rawRows: any[][] = result?.response?.result?.rows ?? []

  const rows: Row[] = rawRows.map((row) => {
    const obj: Row = {}
    cols.forEach((col, i) => {
      const cell = row[i]
      obj[col] = cell?.type === "null" ? null
        : cell?.type === "integer" ? parseInt(cell.value)
        : cell?.type === "float" ? parseFloat(cell.value)
        : cell?.value ?? null
    })
    return obj
  })

  return { rows }
}

async function executeMultiple(sql: string): Promise<void> {
  const stmts = sql.split(";").map(s => s.trim()).filter(Boolean)
  const requests: any[] = stmts.map(s => ({ type: "execute", stmt: { sql: s, args: [] } }))
  requests.push({ type: "close" })

  const res = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TURSO_AUTH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ requests }),
  })

  if (!res.ok) throw new Error(`Turso HTTP error ${res.status}`)
}

export const db = { execute, executeMultiple }
