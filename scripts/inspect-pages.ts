// Quick inspection script - run with: bun scripts/inspect-pages.ts
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"

const workerPath = fileURLToPath(
  new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url)
)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath

const data = new Uint8Array(readFileSync("./docs/Dark_Heresy_Core_Rulebook.pdf"))
const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise

const pages = process.argv.slice(2).map(Number).filter(Boolean)
if (pages.length === 0) { console.log("Usage: bun scripts/inspect-pages.ts 130 131 132"); process.exit(1) }

for (const pageNum of pages) {
  console.log("\n=== PAGE " + pageNum + " ===")
  const page = await doc.getPage(pageNum)
  const content = await page.getTextContent()

  const rows = new Map<number, Array<{ x: number; str: string }>>()
  for (const item of content.items as any[]) {
    if (!item.str?.trim()) continue
    const y = Math.round(item.transform[5])
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y)!.push({ x: Math.round(item.transform[4]), str: item.str })
  }

  const sortedRows = [...rows.entries()].sort((a, b) => b[0] - a[0])
  for (const [, items] of sortedRows) {
    items.sort((a, b) => a.x - b.x)
    const line = items.map((i) => i.str).join(" ")
    if (line.trim()) console.log(line)
  }
}
