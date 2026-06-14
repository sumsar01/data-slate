import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"
const ROOT = fileURLToPath(new URL("..", import.meta.url))
const workerPath = fileURLToPath(new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url))
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath
const data = new Uint8Array(readFileSync(ROOT + "/docs/Dark_Heresy_Core_Rulebook.pdf"))
const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise

function normItem(s) {
  const tokens = s.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return ""
  if (tokens.every(t => t.length <= 6)) {
    const collapsed = tokens.join("")
    return collapsed.replace(/([a-z\d])([A-Z])/g, "$1 $2").trim()
  }
  let r = s.trim()
  r = r.replace(/(\d)\s+(\d)/g, "$1$2")
  r = r.replace(/(\d)\s+m\b/g, "$1m")
  return r
}

const page = await doc.getPage(98)
const content = await page.getTextContent()

const byY = new Map()
for (const item of content.items) {
  if (!item.str?.trim()) continue
  const y = Math.round(item.transform[5])
  const x = Math.round(item.transform[4])
  if (!byY.has(y)) byY.set(y, [])
  byY.get(y).push({ x, str: item.str })
}

// Show items at y=597, y=583, y=572 (table header and first 2 skills)
for (const y of [597, 583, 572, 561]) {
  const items = byY.get(y)
  if (!items) { process.stdout.write("y=" + y + " NOT FOUND\n"); continue }
  items.sort((a,b) => a.x - b.x)
  for (const item of items) {
    process.stdout.write("y=" + y + " x=" + item.x + " norm=[" + normItem(item.str) + "] raw=[" + item.str + "]\n")
  }
}
