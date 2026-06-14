// Debug script to inspect item widths on a known table page
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"

const workerPath = fileURLToPath(
  new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url)
)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath

const data = new Uint8Array(readFileSync("./docs/Dark_Heresy_Core_Rulebook.pdf"))
const doc = await pdfjsLib.getDocument({ data, disableWorker: true }).promise

// Page 131 has the main weapon table
const page = await doc.getPage(131)
const content = await page.getTextContent()

// Print first 60 items with full position data
const items = (content.items as any[]).filter((i) => i.str?.trim())
console.log("Sample items (first 80):")
for (const item of items.slice(0, 80)) {
  const x = Math.round(item.transform[4])
  const y = Math.round(item.transform[5])
  const w = Math.round(item.width ?? 0)
  console.log(`  y=${y} x=${x} w=${w}  "${item.str}"`)
}

// Find the weapon table rows by looking for the "Las pist ol" row
// (y=some value, x starts around 50)
console.log("\n--- Searching for weapon table rows ---")
const byY = new Map<number, any[]>()
for (const item of content.items as any[]) {
  if (!item.str?.trim()) continue
  const y = Math.round(item.transform[5])
  if (!byY.has(y)) byY.set(y, [])
  byY.get(y)!.push(item)
}

for (const [y, rowItems] of [...byY.entries()].sort((a, b) => b[0] - a[0])) {
  rowItems.sort((a: any, b: any) => a.transform[4] - b.transform[4])
  const text = rowItems.map((i: any) => i.str).join(" ")
  if (text.includes("Las") || text.includes("pist") || text.includes("1 d") || text.includes("F ull")) {
    console.log(`\n[y=${y}] "${text}"`)
    for (const item of rowItems) {
      const x = Math.round(item.transform[4])
      const w = Math.round(item.width ?? 0)
      console.log(`    x=${x} w=${w} "${item.str}"`)
    }
  }
}
