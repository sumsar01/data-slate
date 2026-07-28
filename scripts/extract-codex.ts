#!/usr/bin/env bun
/**
 * scripts/extract-codex.ts
 * One-time extraction of Dark Heresy 1st Ed rules from the Core Rulebook PDF.
 *
 * Usage:
 *   bun scripts/extract-codex.ts           # full extraction
 *   bun scripts/extract-codex.ts --raw     # dump position-aware normalized text per page
 */

// @ts-ignore
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { fileURLToPath } from "url"

const workerPath = fileURLToPath(
  new URL("../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url)
)
pdfjsLib.GlobalWorkerOptions.workerSrc = workerPath

const ROOT = fileURLToPath(new URL("..", import.meta.url))
const PDF_PATH = join(ROOT, "docs", "Dark_Heresy_Core_Rulebook.pdf")
const OUTPUT_DIR = join(ROOT, "apps", "api", "src", "data", "codex")
const TEMP = "C:\\Users\\skriv\\AppData\\Local\\Temp\\opencode"

const RAW_ONLY = process.argv.includes("--raw")

// ─── Types ────────────────────────────────────────────────────────────────────

type Item = { x: number; y: number; w: number; str: string }
type PageData = { items: Item[]; rows: Map<number, Item[]> }

export type Skill = {
  id: string
  name: string
  characteristic: string
  type: "Basic" | "Advanced"
  descriptor: string | null
  description: string
}

export type Talent = {
  id: string
  name: string
  prerequisites: string | null
  description: string
  longDescription: string | null
}

export type Weapon = {
  id: string
  name: string
  category: string
  class: string
  range: string
  rof: string
  damage: string
  penetration: string
  clip: string
  reload: string
  special: string
  weight: string
  cost: string
  availability: string
}

export type PsychicPower = {
  id: string
  name: string
  discipline: string
  threshold: string
  focus_time: string
  range: string
  sustained: boolean
  description: string
}

export type WeaponQuality = {
  id: string
  name: string
  description: string
}

// ─── PDF extraction ───────────────────────────────────────────────────────────

async function loadDoc(path: string): Promise<any> {
  const data = new Uint8Array(readFileSync(path))
  return pdfjsLib.getDocument({ data, disableWorker: true }).promise
}

async function extractPages(doc: any): Promise<PageData[]> {
  const total = doc.numPages
  const pages: PageData[] = []

  for (let i = 1; i <= total; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()

    const items: Item[] = []
    const rows = new Map<number, Item[]>()

    for (const raw of content.items as any[]) {
      if (!raw.str?.trim()) continue
      const x = Math.round(raw.transform[4])
      const y = Math.round(raw.transform[5])
      const w = Math.round(raw.width ?? 0)
      const item: Item = { x, y, w, str: raw.str }
      items.push(item)
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push(item)
    }

    for (const rowItems of rows.values()) rowItems.sort((a, b) => a.x - b.x)
    pages.push({ items, rows })

    if (i % 50 === 0) process.stdout.write(`  ...${i}/${total}\r`)
  }
  process.stdout.write(`  ${total} pages extracted.          \n`)
  return pages
}

/**
 * Extract a single page using the operator list, which gives the correct
 * unicode text directly (bypassing pdfjs font-tracking garbling).
 *
 * The PDF exclusively uses setTextMatrix (Tm) for absolute positioning —
 * no moveText/nextLine ops — so we only need to track setTextMatrix.
 *
 * pageNum is 1-indexed (pdfjs convention).
 */
async function extractPageOp(doc: any, pageNum: number): Promise<PageData> {
  const page = await doc.getPage(pageNum)
  const ops = await page.getOperatorList()
  const OPS = pdfjsLib.OPS

  const items: Item[] = []
  const rows = new Map<number, Item[]>()

  let currentX = 0
  let currentY = 0

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i]
    if (fn === OPS.setTextMatrix) {
      const m = ops.argsArray[i][0]
      currentX = m[4]
      currentY = m[5]
    } else if (fn === OPS.showText) {
      const glyphArr = ops.argsArray[i][0] as any[]
      let text = ""
      for (const g of glyphArr) {
        if (typeof g !== "number" && g?.unicode) text += g.unicode
      }
      text = text.replace(/\s+/g, " ").trim()
      if (!text) continue

      const x = Math.round(currentX)
      const y = Math.round(currentY)
      const item: Item = { x, y, w: 0, str: text }
      items.push(item)
      if (!rows.has(y)) rows.set(y, [])
      rows.get(y)!.push(item)
    }
  }

  for (const rowItems of rows.values()) rowItems.sort((a, b) => a.x - b.x)
  return { items, rows }
}

/** Get rows sorted top-to-bottom (highest Y first) */
function getRows(page: PageData): Array<{ y: number; items: Item[] }> {
  return [...page.rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([y, items]) => ({ y, items }))
}

// ─── Text normalization ───────────────────────────────────────────────────────

/**
 * Normalize letter-tracked PDF text for a single PDF text item.
 *
 * The DH rulebook uses heavily tracked fonts. Each glyph cluster becomes a
 * separate token in the text string. Strategy:
 *   1. If ALL tokens ≤ 6 chars → collapse all spaces, then re-insert word
 *      boundaries at lowercase→uppercase transitions.
 *   2. Otherwise apply targeted numeric/unit fixes only.
 */
function normItem(s: string): string {
  const tokens = s.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return ""

  // Letter-tracking detection:
  //   allShort  = every token is ≤ 6 chars (handles "C o m b at", "Bas ic", etc.)
  //   singleCharRatio = ≥50% tokens ≤ 2 chars with ≥2 total (handles "M ast er")
  const allShort = tokens.every((t) => t.length <= 6)
  const singleCharRatio = tokens.filter((t) => t.length <= 2).length / tokens.length
  const likelyTracked = allShort || (tokens.length >= 2 && singleCharRatio >= 0.5)

  if (likelyTracked) {
    const collapsed = tokens.join("")
    // Re-insert word spaces at lowercase→uppercase boundaries (interior)
    return collapsed.replace(/([a-z\d])([A-Z])/g, "$1 $2").trim()
  }

  // Mixed: targeted fixes for numbers, units, dice, RoF
  let r = s.trim()
  r = r.replace(/(\d)\s+(\d)/g, "$1$2")
  r = r.replace(/(\d)\s*\.\s*(\d)/g, "$1.$2")
  r = r.replace(/(\d)\s+m\b/g, "$1m")
  r = r.replace(/(\d)\s+k\s*g\b/gi, "$1kg")
  r = r.replace(/(\d)\s+d\s+(\d)/gi, "$1d$2")
  r = r.replace(/([S–—-])\s*\/\s*([–—\d-])\s*\/\s*([–—\d-])/g, "$1/$2/$3")
  return r
}

/** Join row items into a string using gap-based spacing */
function normRow(items: Item[]): string {
  return items.map((i) => normItem(i.str)).join(" ").replace(/\s{3,}/g, "  ").trim()
}

/**
 * Normalize a single text item from the operator-list extraction.
 * Op-list items already have correct unicode (no letter-tracking garble),
 * so we only collapse excess whitespace without any tracking-collapse logic.
 */
function normOpItem(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

// ─── Section finder ───────────────────────────────────────────────────────────

type SectionMap = {
  skillsTable: number
  talents: number
  weapons: number
  powers: number
}

function findSections(pages: PageData[]): SectionMap {
  const result: Partial<SectionMap> = {}

  for (let p = 0; p < pages.length; p++) {
    const rows = getRows(pages[p])
    const pageText = rows.map((r) => normRow(r.items)).join(" ")

    // minPage guards prevent matching against TOC / intro content
    if (!result.skillsTable && p >= 90 && /Table\s*3\s*[-–]\s*1\s*:\s*Skills?/i.test(pageText)) {
      result.skillsTable = p
      console.log(`  [skills table] page ${p + 1}`)
    }
    if (!result.talents && p >= 108 && /Gaining\s+Talents|Chapter\s+IV.*Talents/i.test(pageText)) {
      result.talents = p
      console.log(`  [talents] page ${p + 1}`)
    }
    if (!result.weapons && p >= 125 && /Table\s*5\s*[-–]\s*7.*Ranged/i.test(pageText)) {
      result.weapons = p
      console.log(`  [weapons] page ${p + 1}`)
    }
    if (!result.powers && p >= 160 && /Table\s*6\s*[-–]\s*4.*Minor\s*Psych/i.test(pageText)) {
      result.powers = p
      console.log(`  [powers] page ${p + 1}`)
    }
    if (result.skillsTable !== undefined && result.talents !== undefined &&
        result.weapons !== undefined && result.powers !== undefined) break
  }

  return {
    skillsTable: result.skillsTable ?? 97,    // PDF page 98
    talents:     result.talents     ?? 111,   // PDF page 112 (quick-ref table start)
    weapons:     result.weapons     ?? 130,   // PDF page 131
    powers:      result.powers      ?? 165,   // PDF page 166 (Table 6-4)
  }
}

// ─── Skills parser ────────────────────────────────────────────────────────────

/**
 * Parse Table 3-1: Skills.
 *
 * Columns: Skill Name | Type | Characteristic | Descriptor
 *
 * Each row in the table has "Basic" or "Advanced" as the Type cell.
 * We use this as the column anchor: everything to its left = name,
 * next cell = characteristic, remaining = descriptor.
 *
 * The page uses a two-column layout; we skip items whose X positions
 * are clearly in the left narrative column (< ~300).
 */
function parseSkillsTable(page: PageData): Skill[] {
  const skills: Skill[] = []
  const rows = getRows(page)
  let inTable = false

  // tableStartX = 0: the skills table starts at x=54 (same left margin as prose text).
  // We don't need to filter by column — prose rows appear at higher Y values than
  // table rows, so they're processed before inTable=true and skipped via `continue`.
  let tableStartX = 0

  for (const { items } of rows) {
    // Only consider the right-column portion (X > tableStartX)
    const rightItems = items.filter((i) => i.x > tableStartX)
    if (rightItems.length === 0) continue

    const cells = rightItems.map((i) => normItem(i.str).trim()).filter(Boolean)
    if (cells.length === 0) continue

    const rowText = cells.join(" ")

    // Detect table start marker
    if (!inTable) {
      if (/Table.*3.*1.*Skill/i.test(rowText)) {
        inTable = true
        // Calibrate: the table title tells us the minimum X of right column
        tableStartX = Math.min(...rightItems.map((i) => i.x)) - 5
      }
      continue
    }

    // Skip column header row
    if (/^Skill.*Name|^Name.*Type/i.test(rowText)) continue

    // Skip footnote markers (†) and short decorative lines — but do NOT reset inTable
    if (/^[†\d\s]+$/.test(rowText.trim())) continue
    if (/--- PAGE BREAK ---/.test(rowText)) continue

    // Stop at section endings
    if (/^(Gaining|Mastery|Group|Chapter|†\s*De\s*n)/i.test(rowText) && rowText.length < 80) {
      inTable = false; continue
    }

    // Each row has Type as "Basic" or "Advanced"
    const typeIdx = cells.findIndex((c) => /^(Basic|Advanced)$/i.test(c))
    if (typeIdx < 0) continue

    const name = clean(cells.slice(0, typeIdx).join(" "))
    const typeStr = cells[typeIdx]
    // Characteristic is the next cell (might be multi-word: "Weapon Skill")
    // The descriptor is whatever comes after
    const rest = cells.slice(typeIdx + 1)
    let charStr = ""
    let descriptorStr = ""

    // Known characteristics (some are multi-word)
    const CHARS = [
      "Agility", "Intelligence", "Perception", "Fellowship",
      "Strength", "Toughness", "Willpower", "Weapon Skill", "Ballistic Skill",
    ]
    // Try to match multi-word characteristic first
    const charMatch = CHARS.find((c) => {
      const cWords = c.split(" ")
      return cWords.every((w, i) => rest[i]?.toLowerCase() === w.toLowerCase())
    })
    if (charMatch) {
      charStr = charMatch
      descriptorStr = rest.slice(charMatch.split(" ").length).join(" ")
    } else {
      charStr = rest[0] ?? "—"
      descriptorStr = rest.slice(1).join(" ")
    }

    if (!name || name.length < 2) continue
    if (/^(The|A |An |This|For|See|Note|†)/i.test(name)) continue

    skills.push({
      id: slug(name),
      name,
      characteristic: charStr,
      type: /Advanced/i.test(typeStr) ? "Advanced" : "Basic",
      descriptor: descriptorStr.replace(/^—$/, "").trim() || null,
      description: "",
    })
  }

  return skills
}

// ─── Talents parser ───────────────────────────────────────────────────────────

/**
 * Parse the Talents quick-reference table (pages 112–113 of the book).
 *
 * The table has three implicit columns based on X position:
 *   Name:        x < NAME_END   (~155)
 *   Prereqs:     x ∈ [NAME_END, DESC_START)  (~155 – 284)
 *   Description: x ≥ DESC_START (~285)
 *
 * Each talent is one row; some rows have multi-item name or long descriptions.
 * Rows with NO name items are description continuations from the previous talent.
 *
 * Skip rows that are headers, footnote markers (†), or page numbers.
 */
const TALENT_NAME_END  = 155   // items with x < this are part of the talent name
const TALENT_DESC_START = 285  // items with x ≥ this are part of the description

function parseTalents(pages: PageData[], startPage: number, endPage: number): Talent[] {
  const talents: Talent[] = []
  let current: Talent | null = null
  // The first parsed page also contains the chapter intro prose and the
  // "Talent Groups" sidebar, both of which precede the actual Table 4-1.
  // Don't accept entries until we've passed the table's own header row.
  let inTable = false

  const flushCurrent = () => {
    if (current && current.name.length > 1 && !talents.find((t) => t.id === current!.id)) {
      talents.push(current)
    }
    current = null
  }

  for (let p = startPage; p <= endPage && p < pages.length; p++) {
    // Stop at chapter V (Armoury) heading — the table ends before that
    const pageText = getRows(pages[p]).map(r => normRow(r.items)).join(" ")
    if (/Chapter\s+V.*Armoury|THE\s+ARMOURY|Money.*Availability/i.test(pageText)) break
    // Stop when detailed prose descriptions start: "Prerequisites:" appears as a label
    if (/Prerequisites\s*:\s*Fellowship|Prerequisites\s*:\s*Agility|Prerequisites\s*:\s*Weapon/i.test(pageText)) break

    for (const { items } of getRows(pages[p])) {
      // Split items by column
      const nameItems  = items.filter(i => i.x < TALENT_NAME_END)
      const prereqItems = items.filter(i => i.x >= TALENT_NAME_END && i.x < TALENT_DESC_START)
      const descItems  = items.filter(i => i.x >= TALENT_DESC_START)

      const nameText  = nameItems.map(i => normOpItem(i.str)).filter(Boolean).join(" ").trim()
      const prereqText = prereqItems.map(i => normOpItem(i.str)).filter(Boolean).join(" ").trim()
      const descText  = descItems.map(i => normOpItem(i.str)).filter(Boolean).join(" ").trim()

      // Skip decorative / empty rows
      if (!nameText && !prereqText && !descText) continue
      // Skip footnote-only rows (†) and page numbers
      if (/^[†\d\s]+$/.test(nameText + prereqText + descText)) continue

      // Table 4-1's own column header ("Talent Name | Prerequisite | Benefit")
      // marks where the real table begins — everything before it on this page
      // (chapter intro prose, "Talent Groups" sidebar) must be ignored.
      if (!inTable) {
        if (/Talent\s*Name|Table\s*4\s*[-–]\s*1/i.test(nameText + prereqText + descText)) inTable = true
        continue
      }

      // Skip column header rows
      if (/Talent.*Name|Name.*Type|Prerequisite.*Characteristic/i.test(nameText + descText)) continue
      // Skip chapter-heading rows
      if (/^(Chapter|Gaining Talents|Talent Descriptions|Talent Groups?)/i.test(nameText)) continue

      if (nameText.length > 1 && descText.length > 3) {
        // New talent entry
        flushCurrent()
        const prereq = prereqText && !/^[—–-]$/.test(prereqText) ? prereqText.replace(/\.$/, "").trim() : null
        current = {
          id: slug(nameText),
          name: clean(nameText),
          prerequisites: prereq,
          description: clean(descText),
          longDescription: null,
        }
      } else if (current && descText) {
        // Continuation line (name column empty, description wraps)
        current.description = clean(current.description + " " + descText)
      }
    }
  }

  flushCurrent()
  return talents
}

// ─── Talent Descriptions (long-form prose) parser ────────────────────────────

function fingerprint(s: string): string {
  return s
    .replace(/ﬂ/g, "fl")
    .replace(/ﬁ/g, "fi")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/**
 * Remove label items (e.g. "Threshold:") together with the very next item
 * on their same row (their value, e.g. "8") from a page's item list, BEFORE
 * column-splitting runs.
 *
 * Some sections lay out a "label ... value" mini-table within each column
 * (e.g. Psychic Powers' Threshold/Focus Time/Sustained/Range block), where
 * the label-to-value gap (~140pt) is wider than the actual gap between
 * columns (~20-25pt). splitColumns()'s largest-gap heuristic then picks
 * that intra-column gap as a column boundary instead of the real one,
 * interleaving unrelated entries' paragraphs. Since all 3 columns share the
 * same row (y) — one column's label can sit anywhere in that shared row,
 * not necessarily leftmost — this strips the specific label+value ITEM PAIR
 * only, leaving any other columns' body prose sharing that same y intact.
 */
function stripLabelValuePairs(items: Item[], labelRegex: RegExp): Item[] {
  const rows = new Map<number, Item[]>()
  for (const it of items) {
    if (!rows.has(it.y)) rows.set(it.y, [])
    rows.get(it.y)!.push(it)
  }
  const keep: Item[] = []
  for (const rowItems of rows.values()) {
    rowItems.sort((a, b) => a.x - b.x)
    for (let i = 0; i < rowItems.length; i++) {
      if (labelRegex.test(rowItems[i].str.trim())) {
        i++ // also skip the value immediately following the label
        continue
      }
      keep.push(rowItems[i])
    }
  }
  return keep
}

/**
 * Remove rows matching `shouldStrip` (e.g. a psychic power summary-table
 * row) from a page's item list entirely, BEFORE column-splitting runs.
 */
function stripRows(items: Item[], shouldStrip: (rowItems: Item[]) => boolean): Item[] {
  const rows = new Map<number, Item[]>()
  for (const it of items) {
    if (!rows.has(it.y)) rows.set(it.y, [])
    rows.get(it.y)!.push(it)
  }
  const keep: Item[] = []
  for (const rowItems of rows.values()) {
    rowItems.sort((a, b) => a.x - b.x)
    if (shouldStrip(rowItems)) continue
    keep.push(...rowItems)
  }
  return keep
}

/**
 * Split a page's items into up to 3 left-to-right column bands.
 *
 * Column x-positions shift slightly from page to page in this section (odd
 * vs even page margins), so fixed pixel thresholds misclassify some pages —
 * e.g. one page's column 2 starts at x=245 while another's starts at x=211,
 * which is inside a fixed column-1 band sized for the first page. Instead,
 * self-calibrate per page: find the 2 largest gaps between consecutive
 * distinct x-values and cut there. A stray outlier (e.g. a page number far
 * to the right) just becomes noise inside whichever band it falls into —
 * harmless, since those rows get filtered out elsewhere as digit-only.
 */
function splitColumns(items: Item[]): Item[][] {
  // Ignore sparse x-positions (e.g. a lone page number off to the side) when
  // locating cuts — a stray outlier's isolated gap would otherwise outrank
  // the true, narrower column boundary for one of the top-2 gap slots.
  const counts = new Map<number, number>()
  for (const it of items) counts.set(it.x, (counts.get(it.x) ?? 0) + 1)
  const xs = [...counts.keys()].filter((x) => counts.get(x)! >= 2).sort((a, b) => a - b)
  if (xs.length < 3) return [items]

  const gaps = xs.slice(1).map((x, i) => ({ at: x, size: x - xs[i] }))
  const cuts = gaps
    .filter((g) => g.size > 25)
    .sort((a, b) => b.size - a.size)
    .slice(0, 2)
    .map((g) => g.at)
    .sort((a, b) => a - b)

  if (cuts.length === 0) return [items]

  const bands: Item[][] = []
  let prev = -Infinity
  for (const cut of [...cuts, Infinity]) {
    const band = items.filter((i) => i.x >= prev && i.x < cut)
    if (band.length > 0) bands.push(band)
    prev = cut
  }
  return bands
}

/**
 * Parse the 3-column "Talent Descriptions" prose section that follows the
 * quick-ref table (pages 114+), producing slug(name) -> full paragraph text.
 *
 * Header rows use a tracked/small-caps font where op-list extraction still
 * splits each name into several fragments with unpredictable casing (e.g.
 * "Concealed Cavity" comes through as "c", "o N c e a l e d", "c a V I t Y").
 * Reconstructing proper spacing/casing from styling alone is unreliable, so
 * instead each row's raw fingerprint (lowercase letters only, punctuation and
 * whitespace stripped) is matched against known talent names already parsed
 * from the quick-ref table — an exact match marks the start of that talent's
 * description block. This sidesteps the casing problem entirely.
 */
/**
 * Parse a 3-column prose/reference section (Talent Descriptions, Skill
 * Descriptions, ...) that follows a quick-ref table, producing
 * slug(name) -> full paragraph text for each known entry.
 *
 * Header rows use a tracked/small-caps font where op-list extraction still
 * splits each name into several fragments with unpredictable casing (e.g.
 * "Concealed Cavity" comes through as "c", "o N c e a l e d", "c a V I t Y").
 * Reconstructing proper spacing/casing from styling alone is unreliable, so
 * instead each row's raw fingerprint (lowercase letters only, punctuation and
 * whitespace stripped) is matched against known entry names — an exact match
 * marks the start of that entry's description block. This sidesteps the
 * casing problem entirely.
 */
function parseProseDescriptions(
  pages: PageData[],
  startPage: number,
  endPage: number,
  knownEntries: Array<{ id: string; name: string }>,
  opts: { stopRegex: RegExp; labelRegex?: RegExp; skipLineRegex?: RegExp },
): Record<string, string> {
  const byFingerprint = new Map<string, string>()
  for (const t of knownEntries) byFingerprint.set(fingerprint(t.name), t.id)

  const result: Record<string, string> = {}
  let currentId: string | null = null
  // A labelled line (e.g. "Prerequisites:", "Talent Groups:") sometimes wraps
  // onto a second row (e.g. "Prerequisites: Tech-Priest (Respirator" /
  // "Unit)."). Once a label line is seen, keep skipping until a row
  // completes the sentence (ends in a period) so the wrapped tail doesn't
  // leak into the description.
  let skippingLabel = false
  // Each entry gets exactly one definition in this kind of reference section.
  // A name's fingerprint reappearing later (e.g. a running-header/guide-word
  // artifact repeating an earlier entry's name) is never a second real
  // listing — once an entry's block has ended, refuse to reopen it, so a
  // stray repeat can't re-attach a totally unrelated page's text to it.
  const closedIds = new Set<string>()
  const closeCurrent = () => {
    if (currentId) closedIds.add(currentId)
    currentId = null
  }

  for (let p = startPage; p <= endPage && p < pages.length; p++) {
    const pageText = getRows(pages[p]).map((r) => normRow(r.items)).join(" ")
    if (opts.stopRegex.test(pageText)) break

    // Reset at each page boundary. If a page's headers fail to match for
    // any reason (extraction quirk specific to that page), the entry last
    // matched on the PREVIOUS page must not keep absorbing this page's
    // unrelated body text — that silently corrupts one entry with garbage
    // instead of just leaving a few entries on the bad page unmatched,
    // which is the far safer failure mode.
    closeCurrent()
    skippingLabel = false

    const columns = splitColumns(pages[p].items)

    for (const colItems of columns) {
      // Same reasoning as the page-boundary reset above, one level finer:
      // a column can hold an unrelated sidebar/callout box (e.g. example
      // vehicle stat blurbs next to the "Evaluate" skill) with no matching
      // entry name — without this, leftover state from the previous column
      // would absorb it into whatever was last matched there.
      closeCurrent()
      skippingLabel = false

      // Cluster by y with a small tolerance rather than exact equality — two
      // fragments of the SAME word can land 1-2pt apart due to sub-pixel
      // rounding, and an exact-match grouping would treat them as separate
      // rows, inserting a spurious space mid-word (e.g. "Administratum"
      // coming out as "Admin istratum").
      const sortedItems = [...colItems].sort((a, b) => b.y - a.y)
      const rows: Item[][] = []
      let anchorY: number | null = null
      for (const it of sortedItems) {
        if (anchorY === null || anchorY - it.y > 3) {
          rows.push([])
          anchorY = it.y
        }
        rows[rows.length - 1].push(it)
      }

      for (const rowItems of rows) {
        rowItems.sort((a, b) => a.x - b.x)
        const rawJoined = rowItems.map((i) => i.str).join("")

        // Skip footnote/page-number-only rows
        if (/^[\d†\s]*$/.test(rawJoined.trim())) continue

        // A row made of several very short fragments (each ≤6 chars) is the
        // signature of the tracked small-caps header font (see normItem
        // above) — used below both to match headers and to recognize (and
        // discard) unmatched ones instead of treating them as body prose.
        const tokens = rowItems.map((i) => i.str.trim()).filter(Boolean)
        // Threshold is 8, not 6, because a tracked-font fragment can itself
        // contain embedded spaces (e.g. "I N I N" is 7 chars) — using the
        // stricter 6 here would let a genuine header fragment slip through
        // and get treated as body prose instead of being recognized/skipped.
        const looksLikeHeader = tokens.length >= 2 && tokens.every((t) => t.length <= 8)

        const openEntry = (id: string) => {
          if (closedIds.has(id)) return false
          if (currentId && currentId !== id) closedIds.add(currentId)
          currentId = id
          skippingLabel = false
          return true
        }

        const fp = fingerprint(rawJoined)
        if (fp.length >= 3) {
          if (byFingerprint.has(fp)) {
            openEntry(byFingerprint.get(fp)!)
            continue
          }
          // Some headers share their row with a same-line suffix (e.g. a
          // skill's "Barter(Basic)" tag), so the exact match above misses.
          // Try a longest-prefix match instead — gated to header-shaped rows
          // only, since on ordinary prose rows a name like "Search" could
          // coincidentally prefix-match the start of an unrelated sentence
          // ("Search the area..." -> "searchthearea").
          if (looksLikeHeader) {
            let bestLen = 0
            let bestId: string | null = null
            for (const [knownFp, id] of byFingerprint) {
              if (fp.startsWith(knownFp) && knownFp.length > bestLen) {
                bestLen = knownFp.length
                bestId = id
              }
            }
            if (bestId) {
              openEntry(bestId)
              continue
            }
          }
        }

        // Header-shaped but unmatched (extraction quirk on that specific
        // header) — still clearly not body prose, so it must not be
        // appended to whatever entry is currently active or it corrupts
        // that entry's description with unrelated garbled fragments.
        //
        // Tempting but WRONG: also closing `currentId` here (since an
        // unmatched header still marks *some* real boundary) sounds safer
        // but isn't — a header can legitimately wrap onto a continuation
        // row that still looks header-shaped (many short fragments), and
        // closing on that wrongly cuts off the entry that's still actively
        // accumulating. Measured: this dropped matched skills 39→20 and
        // talents 113→112, i.e. broke far more entries than the rare
        // cross-neighbor leak it was meant to prevent. Leaving the (rarer)
        // leak as a known limitation beats that trade.
        if (looksLikeHeader) continue

        const rowText = rowItems.map((i) => normOpItem(i.str)).filter(Boolean).join(" ").trim()
        if (!rowText) continue

        if (skippingLabel) {
          if (/[.:]\s*$/.test(rowText)) skippingLabel = false
          continue
        }
        // Self-contained one-line subtitle (e.g. a skill's "(Advanced,
        // Interaction)" tag or standalone characteristic name) — skip it
        // without triggering the multi-row wrap-continuation logic below,
        // since it never wraps and rarely ends in "." or ":".
        if (opts.skipLineRegex && opts.skipLineRegex.test(rowText)) continue
        // Skip labels already captured elsewhere — not part of the prose body
        if (opts.labelRegex && opts.labelRegex.test(rowText)) {
          if (!/\.\s*$/.test(rowText)) skippingLabel = true
          continue
        }

        if (currentId) {
          result[currentId] = result[currentId] ? clean(result[currentId] + " " + rowText) : clean(rowText)
        }
      }
    }
  }

  return result
}

// ─── Weapons parser ───────────────────────────────────────────────────────────

const WEAPON_CLASSES = ["Pistol", "Basic", "Heavy", "Melee", "Thrown", "Exotic"]
const AVAILABILITY_VALS = [
  "Ubiquitous", "Abundant", "Plentiful", "Common", "Average",
  "Scarce", "Rare", "Very Rare", "Extremely Rare", "Near Unique", "Unique",
]

const CATEGORY_HEADERS: Array<[RegExp, string]> = [
  [/^Las\s+Weapons?$/i, "Las"],
  [/^Solid\s+Projectile/i, "Solid Projectile"],
  [/^SP\s+Weapons?$/i, "SP"],
  [/^Bolt\s+Weapons?$/i, "Bolt"],
  [/^Melta\s+Weapons?$/i, "Melta"],
  [/^Plasma\s+Weapons?$/i, "Plasma"],
  [/^Flame\s+Weapons?$/i, "Flame"],
  [/^Primitive\s+Weapons?$/i, "Primitive"],
  [/^Launchers?$/i, "Launcher"],
  [/^M[eê]l[eé]e\s+Weapons?/i, "Melee"],
  [/^Chain\s+Weapons?$/i, "Chain"],
  [/^Power\s+Weapons?$/i, "Power"],
  [/^Force\s+Weapons?$/i, "Force"],
  [/^Exotic\s+Weapons?$/i, "Exotic"],
  [/^Thrown\s+Weapons?$/i, "Thrown"],
  [/^Low-Tech\s+Weapons?$/i, "Low-Tech"],
]

/**
 * Parse weapons tables from the Armoury chapter.
 * Each table row has a "Class" column value (Pistol/Basic/Heavy/etc.)
 * and a damage dice expression (1dX). Uses these as anchors.
 */
function parseWeapons(pages: PageData[], startPage: number, endPage: number): Weapon[] {
  const weapons: Weapon[] = []
  let currentCategory = "Unknown"

  for (let p = startPage; p <= endPage && p < pages.length; p++) {
    for (const { items } of getRows(pages[p])) {
      const cells = items.map((i) => normItem(i.str).trim()).filter(Boolean)
      const fullLine = cells.join(" ")
      if (!fullLine.trim()) continue

      // Detect category header
      for (const [rx, cat] of CATEGORY_HEADERS) {
        if (rx.test(fullLine.trim()) && fullLine.length < 50) {
          currentCategory = cat
          break
        }
      }

      // Weapon row: must have a known class keyword AND damage dice
      const classIdx = cells.findIndex((c) => WEAPON_CLASSES.includes(c))
      const hasDamage = cells.some((c) => /\d+d\d+/i.test(c))

      if (classIdx > 0 && hasDamage) {
        const name = cells.slice(0, classIdx).join(" ").trim()
        if (!name || name.length < 2) continue
        if (/^(Name|Class|Range|RoF|Dam|Pen|Clip|Rld)/i.test(name)) continue

        const wClass = cells[classIdx]
        const range = cells[classIdx + 1] ?? "—"
        const rof = cells[classIdx + 2] ?? "—"
        const damage = cells[classIdx + 3] ?? "—"
        const penetration = cells[classIdx + 4] ?? "0"
        const clip = cells[classIdx + 5] ?? "—"
        const reload = cells[classIdx + 6] ?? "—"
        const rest = cells.slice(classIdx + 7)

        let special = "—", weight = "—", cost = "—", availability = "—"
        for (let ri = rest.length - 1; ri >= 0; ri--) {
          const v = rest[ri]
          if (AVAILABILITY_VALS.some((av) => new RegExp(av, "i").test(v))) {
            availability = v
            cost = rest[ri - 1] ?? "—"
            weight = rest[ri - 2] ?? "—"
            special = rest.slice(0, ri - 2).join(", ").trim() || "—"
            break
          }
        }

        weapons.push({
          id: slug(name),
          name,
          category: currentCategory,
          class: wClass,
          range,
          rof,
          damage,
          penetration,
          clip,
          reload,
          special,
          weight,
          cost,
          availability,
        })
      }
    }
  }

  return weapons
}

// ─── Armour parser ────────────────────────────────────────────────────────────

export type ArmourItem = {
  id: string
  name: string
  category: string
  locations: string
  ap: string
  weight: string
  cost: string
  availability: string
}

/**
 * Parse Table 5-12: Armour (page 146).
 * Op-list items are correctly rendered.
 * Columns: Name(x54) | Locations(x181-220) | AP(x297-305) | Wt(x341-347) | Cost(x399-410) | Avail(x461-477)
 * Category headers are rows with ONLY a name item and nothing in other columns.
 */
function parseArmour(pages: PageData[], startPage: number, endPage: number): ArmourItem[] {
  const items: ArmourItem[] = []
  let category = "Unknown"
  const seenIds = new Set<string>()

  for (let p = startPage; p <= endPage && p < pages.length; p++) {
    for (const { items: rowItems } of getRows(pages[p])) {
      // Filter to armour table x range (54-500)
      const row = rowItems.filter(i => i.x >= 54 && i.x <= 500)
      if (row.length === 0) continue

      const rowText = row.map(i => i.str).join(" ")

      // Stop at next chapter
      if (/Table\s*5[-–]13|Clothing|Personal\s+Items/i.test(rowText)) break
      // Skip header row
      if (/^Armour\s+Type|^Name.*Location/i.test(rowText)) continue
      // Skip decorative/page-number rows
      if (/^[\d\s†]+$/.test(rowText.trim())) continue

      // Category header: only name items at x < 180, nothing else
      const nameItems = row.filter(i => i.x < 180)
      const statItems = row.filter(i => i.x >= 280)

      if (nameItems.length > 0 && statItems.length === 0 && row.length <= 2) {
        // Pure category header (sometimes has a location-column item too)
        const possibleHeader = nameItems.map(i => i.str).join(" ").trim()
        if (possibleHeader.length > 2 && !/^\d+$/.test(possibleHeader)) {
          category = possibleHeader
        }
        continue
      }

      // Item row: must have an AP value (~integer) and an availability value
      const apItem = row.find(i => i.x >= 280 && i.x <= 315 && /^\d+$/.test(i.str.trim()))
      const availItem = row.find(i => i.x >= 450 && AVAILABILITY_VALS.some(av => new RegExp(av, "i").test(i.str)))
      if (!apItem || !availItem) continue

      const name = nameItems.map(i => i.str).join(" ").trim()
      if (!name || name.length < 2) continue
      if (seenIds.has(slug(name))) continue

      const locItems = row.filter(i => i.x >= 180 && i.x < 280)
      const wtItem = row.find(i => i.x >= 320 && i.x < 390)
      const costItem = row.find(i => i.x >= 390 && i.x < 450)

      seenIds.add(slug(name))
      items.push({
        id: slug(name),
        name,
        category,
        locations: locItems.map(i => i.str).join(" ").trim() || "—",
        ap: apItem.str,
        weight: wtItem?.str ?? "—",
        cost: costItem?.str ?? "—",
        availability: availItem.str,
      })
    }
  }
  return items
}

// ─── Gear parser (Ammo, Clothing, Drugs, Tools, Cybernetics) ─────────────────

export type GearItem = {
  id: string
  name: string
  category: string
  weight: string
  cost: string
  availability: string
  description: string
}

const GEAR_TABLE_MARKERS: Array<[RegExp, string]> = [
  [/Table\s*5[-–]11.*Ammo/i,                      "Ammo"],
  [/Table\s*5[-–]13.*Clothing/i,                   "Clothing & Personal Items"],
  [/Table\s*5[-–]14.*Drugs/i,                      "Drugs & Consumables"],
  [/Table\s*5[-–]16.*Tools/i,                      "Tools"],
  [/Table\s*5[-–]1[89].*Cybernetics|Cybernetics/i, "Cybernetics"],
]

/**
 * Parse general gear tables: Ammo, Clothing, Drugs, Tools, Cybernetics.
 *
 * These tables have 3–4 columns: Name | [Weight] | Cost | Availability.
 * Op-list items are used (correct unicode, no tracking garble).
 * The table X range is determined from the marker row's leftmost item.
 *
 * Pages scanned: 140–162 (covers all armoury gear tables).
 */
function parseGear(pages: PageData[], startPage: number, endPage: number): GearItem[] {
  const items: GearItem[] = []
  const seenIds = new Set<string>()

  for (let p = startPage; p <= endPage && p < pages.length; p++) {
    const rows = getRows(pages[p])
    for (let r = 0; r < rows.length; r++) {
      const rowItems = rows[r].items

      // Check for a gear table marker
      for (const [marker, category] of GEAR_TABLE_MARKERS) {
        const markerRow = rowItems.map(i => i.str).join(" ")
        if (!marker.test(markerRow)) continue

        // Table column boundaries: determined by the marker header x position
        const tableMinX = Math.min(...rowItems.map(i => i.x)) - 5
        const tableMaxX = tableMinX + 300

        // Parse rows until next section break
        for (let rr = r + 1; rr < rows.length; rr++) {
          const tableItems = rows[rr].items.filter(i => i.x >= tableMinX && i.x <= tableMaxX)
          if (tableItems.length === 0) continue

          const rowStr = tableItems.map(i => i.str).join(" ").trim()

          // Stop on next table marker
          if (GEAR_TABLE_MARKERS.some(([m]) => m.test(rowStr))) break
          if (/Table\s*5[-–]\d/i.test(rowStr)) break

          // Skip column headers (Name / Wt / Cost / Availability)
          if (/^Name\b|^\s*Wt\s+Cost|^Cost.*Availability/i.test(rowStr)) continue
          // Skip footnote markers and page numbers
          if (/^[†\d\s]+$/.test(rowStr)) continue
          if (/^\s*$/.test(rowStr)) continue

          // Detect availability value as anchor (last matching item in the row)
          const availIdx = tableItems.findIndex(i =>
            AVAILABILITY_VALS.some(av => new RegExp("^" + av + "$", "i").test(i.str.trim()))
          )
          if (availIdx < 1) continue

          const avail = tableItems[availIdx].str.trim()
          const cost = tableItems[availIdx - 1]?.str.trim() ?? "—"

          let name = ""
          let weight = "—"

          if (availIdx === 2) {
            // 3-column: name | cost | availability
            name = tableItems[0].str.trim()
          } else if (availIdx >= 3) {
            // 4-column: name | weight | cost | availability
            name = tableItems.slice(0, availIdx - 2).map(i => i.str).join(" ").trim()
            weight = tableItems[availIdx - 2].str.trim()
          }

          if (!name || name.length < 2) continue
          // Skip header-like names
          if (/^(Name|Wt|Cost|Avail)/i.test(name)) continue

          const id = slug(name)
          if (seenIds.has(id)) continue
          seenIds.add(id)

          items.push({ id, name, category, weight, cost, availability: avail, description: "" })
        }
        break  // only one marker can match per row
      }
    }
  }

  return items
}

// ─── Psychic Powers parser ────────────────────────────────────────────────────

/**
 * Each discipline has a summary table: "Table 6-N: [Discipline] Powers"
 * with columns: Name | Threshold | Focus Time | Sustained
 *
 * These tables use a body-text font (not the garbled small-caps of the
 * detailed descriptions) so normRow produces clean, parseable output.
 * We scan for these table markers and extract powers from the table rows.
 *
 * Range and description are left blank — they require column-aware parsing
 * of the detailed sections which is a future improvement.
 */

const POWER_TABLE_MARKERS: Array<[RegExp, string]> = [
  [/Table\s*6[-–]\s*4.*Minor/i,    "Minor"],
  [/Table\s*6[-–]\s*5.*Bio/i,      "Biomancy"],
  [/Table\s*6[-–]\s*6.*Divin/i,    "Divination"],
  [/Table\s*6[-–]\s*7.*Pyro/i,     "Pyromancy"],
  [/Table\s*6[-–]\s*8.*Teleki/i,   "Telekinetics"],
  [/Table\s*6[-–]\s*9.*Telep/i,    "Telepathy"],
]

// Names that normItem can't fully reconstruct from letter-tracked small-caps
const POWER_NAME_FIXES: Record<string, string> = {
  "Déjàvu":          "Déjà Vu",
  "Touchof Madness": "Touch of Madness",
  "Wallof Fire":     "Wall of Fire",
}

/**
 * Matches a summary-table power row after normRow:
 *   "<name tokens>  <threshold_number>  <action_type>  <Yes|No>"
 *
 * Uses \b instead of $ so trailing description text (from an adjacent column
 * at the same Y) doesn't prevent the match.
 */
const POWER_ROW_RE =
  /^(.+?)\s+(\d+)\s+(Half Action|Full Action|Reaction|Free Action)\s+(Yes|No)\b/i

/**
 * Matches a stats-only row (when the power name is on a separate preceding row):
 *   "<threshold_number>  <action_type>  <Yes|No>"
 */
const STATS_ONLY_RE =
  /^(\d+)\s+(Half Action|Full Action|Reaction|Free Action)\s+(Yes|No)\b/i

function parsePowers(pages: PageData[], startPage: number, endPage: number): PsychicPower[] {
  const powers: PsychicPower[] = []
  const seenIds = new Set<string>()

  for (let p = startPage; p <= endPage && p < pages.length; p++) {
    const rows = getRows(pages[p])

    for (let r = 0; r < rows.length; r++) {
      const rowText = normRow(rows[r].items)

      // Check if this row is a discipline table marker
      for (const [marker, discipline] of POWER_TABLE_MARKERS) {
        if (!marker.test(rowText)) continue

        // Determine the X start of the table from the marker row's items.
        // Items in the left column (prose text) will be excluded.
        const tableMinX = Math.min(...rows[r].items.map((i) => i.x)) - 5

        let pendingName = ""          // first part of name seen before its stats row
        let lastPower: PsychicPower | null = null
        let expectContinuation = false // true right after a stats-only row

        const addPower = (rawName: string, threshold: string, focus_time: string, sustained: boolean) => {
          const name = POWER_NAME_FIXES[rawName] ?? rawName
          const id = slug(name)
          if (seenIds.has(id)) return null
          seenIds.add(id)
          const pw: PsychicPower = { id, name, discipline, threshold, focus_time, range: "—", sustained, description: "" }
          powers.push(pw)
          return pw
        }

        // Found a table – parse subsequent rows on this page as entries
        for (let rr = r + 1; rr < rows.length; rr++) {
          // Only include items within the table's X column (exclude left-col prose)
          const tableItems = rows[rr].items.filter((i) => i.x >= tableMinX)
          if (tableItems.length === 0) continue

          const tableRow = normRow(tableItems)

          // Stop at page numbers (book pages are 150-230 range → 3-digit numbers)
          if (/^1[5-9]\d$|^2[0-3]\d$/.test(tableRow.trim())) break
          // Stop at next table marker or chapter heading
          if (POWER_TABLE_MARKERS.some(([m]) => m.test(tableRow))) break
          if (/^(Chapter|CHAPTER)/i.test(tableRow)) break

          // 1. Try full pattern (name + threshold + action + sustained [+ trailing text])
          const fullM = tableRow.match(POWER_ROW_RE)
          if (fullM) {
            lastPower = addPower(fullM[1].trim(), fullM[2], fullM[3], /Yes/i.test(fullM[4]))
            pendingName = ""
            expectContinuation = false
            continue
          }

          // 2. Try stats-only pattern (when name was on a separate preceding row)
          const statsM = tableRow.match(STATS_ONLY_RE)
          if (statsM && pendingName) {
            lastPower = addPower(pendingName, statsM[1], statsM[2], /Yes/i.test(statsM[3]))
            pendingName = ""
            expectContinuation = true  // the row after stats is often the 2nd part of the name
            continue
          }

          // 3. Name-like row: either start of a new name or continuation of last name
          // Skip table headers ("Name Threshold Focus Time Sustain") and long description text
          const isNameLike = tableRow.length > 0
            && tableRow.length <= 35
            && !/Threshold|Focus Time|Sustain|Chapter/i.test(tableRow)
            && !/\d/.test(tableRow)   // names don't have digits

          if (isNameLike) {
            if (expectContinuation && lastPower) {
              // A valid name continuation must start with uppercase and be short.
              // Description text from adjacent columns is always mid-sentence lowercase
              // (e.g. "knowledgeofinwhichdirection") and will fail this check.
              const isContinuation = /^[A-Z]/.test(tableRow) && tableRow.length <= 12
              if (isContinuation) {
                // Append second part of split name (e.g. "Dodge", "Awareness", "Augury")
                const combined = (lastPower.name + " " + tableRow).trim()
                const newName = POWER_NAME_FIXES[combined] ?? combined
                // Update the id too (remove old, re-add with new id)
                seenIds.delete(lastPower.id)
                lastPower.id = slug(newName)
                lastPower.name = newName
                seenIds.add(lastPower.id)
                expectContinuation = false
              }
              // If not a valid continuation, leave expectContinuation=true so the
              // next row can still be checked (the real continuation may follow)
            } else {
              pendingName = tableRow
              expectContinuation = false
            }
          }
        }
        break // only one marker can match per row
      }
    }
  }

  return powers
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Reading PDF:", PDF_PATH)
  const doc = await loadDoc(PDF_PATH)
  const pages = await extractPages(doc)
  console.log(`${pages.length} pages ready.`)

  if (RAW_ONLY) {
    const out: string[] = []
    for (let p = 0; p < pages.length; p++) {
      out.push(`\n\n=== PAGE ${p + 1} ===`)
      for (const { items } of getRows(pages[p])) {
        const line = normRow(items)
        if (line.trim()) out.push(line)
      }
    }
    writeFileSync(join(TEMP, "dh_posaware.txt"), out.join("\n"))
    console.log(`Position-aware text → ${TEMP}\\dh_posaware.txt`)
    process.exit(0)
  }

  console.log("\nFinding section boundaries...")
  const sections = findSections(pages)

  // Re-extract talent pages with the operator-list approach, which gives correct
  // unicode directly (bypassing pdfjs font-tracking garbling in getTextContent).
  // The quick-ref Table 4-1 begins on the SAME page as the "Chapter IV: Gaining
  // Talents" heading (verified against the source PDF), not the page after it —
  // starting at sections.talents + 1 skips the A/B/early-C rows on that first page.
  // Table spans talentsStart through talentsStart+2 (3 pages).
  const talentsStart = sections.talents
  const talentsOpEnd = talentsStart + 2
  console.log(`\nRe-extracting talent pages ${talentsStart + 1}–${talentsOpEnd + 1} via op-list...`)
  for (let p = talentsStart; p <= talentsOpEnd; p++) {
    pages[p] = await extractPageOp(doc, p + 1)  // pdfjs is 1-indexed
  }

  // Re-extract the Talent Descriptions prose section (3-column layout) that
  // immediately follows the quick-ref table, through to the Armoury chapter.
  const TALENT_DESC_OP_START = talentsOpEnd + 1
  const TALENT_DESC_OP_END = talentsOpEnd + 12
  console.log(`Re-extracting talent description pages ${TALENT_DESC_OP_START + 1}–${TALENT_DESC_OP_END + 1} via op-list...`)
  for (let p = TALENT_DESC_OP_START; p <= TALENT_DESC_OP_END && p < pages.length; p++) {
    pages[p] = await extractPageOp(doc, p + 1)
  }

  // Re-extract the Skill Descriptions prose section (same 3-column layout),
  // which runs from right after the skills quick-ref table to the start of
  // Chapter IV (Talents).
  const SKILL_DESC_OP_START = sections.skillsTable + 1
  const SKILL_DESC_OP_END = talentsStart
  console.log(`Re-extracting skill description pages ${SKILL_DESC_OP_START + 1}–${SKILL_DESC_OP_END + 1} via op-list...`)
  for (let p = SKILL_DESC_OP_START; p <= SKILL_DESC_OP_END && p < pages.length; p++) {
    pages[p] = await extractPageOp(doc, p + 1)
  }

  // Re-extract armoury gear pages via op-list (pages 140–162, 0-indexed 139–161).
  // getTextContent garbles the tracked font on these pages.
  const GEAR_OP_START = 139   // PDF page 140 (0-indexed)
  const GEAR_OP_END   = 161   // PDF page 162 (0-indexed)
  console.log(`Re-extracting gear pages ${GEAR_OP_START + 1}–${GEAR_OP_END + 1} via op-list...`)
  for (let p = GEAR_OP_START; p <= GEAR_OP_END; p++) {
    pages[p] = await extractPageOp(doc, p + 1)
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })

  // ── Skills ──────────────────────────────────────────────────────────────────
  console.log("\nParsing skills table (page", sections.skillsTable + 1, ")...")
  const skills = parseSkillsTable(pages[sections.skillsTable])
  console.log(`  → ${skills.length} skills`)

  console.log("\nParsing skill descriptions (pages", SKILL_DESC_OP_START + 1, "–", SKILL_DESC_OP_END + 1, ")...")
  const skillDescs = parseProseDescriptions(pages, SKILL_DESC_OP_START, SKILL_DESC_OP_END, skills, {
    stopRegex: /Gaining\s+Talents|Chapter\s+IV/i,
    skipLineRegex: /^\(.*\)$|^(Agility|Perception|Fellowship|Strength|Toughness|Willpower|Intelligence|Weapon Skill|Ballistic Skill)$/i,
    labelRegex: /^Skill\s+Group\s*:/i,
  })
  const skillsMatched = skills.filter((s) => skillDescs[s.id]).length
  console.log(`  → ${skillsMatched}/${skills.length} skills matched a long description`)

  // Known-bad: these 3 skills sit next to an unusually wide vehicle-example
  // sidebar box (Chimera/Aquila Lander) whose text isn't cleanly separable
  // from the surrounding column by splitColumns() — confirmed contaminated
  // by manual inspection. Suppressing rather than shipping garbled text;
  // "no long description" is a better outcome than a visibly wrong one.
  const SKILL_DESC_BLACKLIST = new Set(["drive", "evaluate", "pilot"])

  const skillsWithLong: Skill[] = skills.map((s) => ({
    ...s,
    description: SKILL_DESC_BLACKLIST.has(s.id) ? "" : skillDescs[s.id] ?? "",
  }))
  writeFileSync(join(OUTPUT_DIR, "skills.json"), JSON.stringify(skillsWithLong, null, 2))

  // ── Talents ─────────────────────────────────────────────────────────────────
  // Quick-ref table starts on the SAME page as the Chapter IV intro heading.
  console.log("\nParsing talents (pages", talentsStart + 1, "–", talentsOpEnd + 1, ")...")
  const talents = parseTalents(pages, talentsStart, talentsOpEnd)
  console.log(`  → ${talents.length} talents`)

  console.log("\nParsing talent descriptions (pages", TALENT_DESC_OP_START + 1, "–", TALENT_DESC_OP_END + 1, ")...")
  const talentDescs = parseProseDescriptions(pages, TALENT_DESC_OP_START, TALENT_DESC_OP_END, talents, {
    stopRegex: /Table\s*5[-–]\s*1\b|Income\s+and\s+Social\s+Class|THE\s+ARMOURY/i,
    labelRegex: /^Prerequisites\s*:|^Talent\s+Groups?\s*:/i,
  })
  const matched = talents.filter((t) => talentDescs[t.id]).length
  console.log(`  → ${matched}/${talents.length} talents matched a long description`)

  // Known-bad: "Peer" sits right before a run of 3-4 talents (Pistol
  // Training, Power Well, Precise Blow, Prosanguine) on the same page whose
  // headers fail to be recognized even as "header-shaped" for this specific
  // page's rendering — their body text has nowhere else to go and ends up
  // appended to Peer. Confirmed by manual inspection. Suppressing rather
  // than shipping garbled text; those 4 talents were already unmatched
  // (null) regardless, so nothing else is lost by also nulling Peer's.
  const TALENT_DESC_BLACKLIST = new Set(["peer"])

  const talentsWithLong: Talent[] = talents.map((t) => ({
    ...t,
    longDescription: TALENT_DESC_BLACKLIST.has(t.id) ? null : talentDescs[t.id] ?? null,
  }))
  writeFileSync(join(OUTPUT_DIR, "talents.json"), JSON.stringify(talentsWithLong, null, 2))

  // ── Weapons ─────────────────────────────────────────────────────────────────
  console.log("\nParsing weapons (pages", sections.weapons + 1, "–", sections.weapons + 25, ")...")
  const weapons = parseWeapons(pages, sections.weapons, sections.weapons + 25)
  console.log(`  → ${weapons.length} weapons`)
  writeFileSync(join(OUTPUT_DIR, "weapons.json"), JSON.stringify(weapons, null, 2))

  // ── Weapon Special Qualities glossary ────────────────────────────────────────
  // A 2-column glossary right before the weapon tables (e.g. "Accurate",
  // "Blast (X)", "Reliable") that individual weapons' `special` field
  // references by name — same tracked-header layout as Talents/Skills.
  console.log("\nParsing weapon special qualities...")
  const WEAPON_QUALITY_NAMES = [
    "Accurate", "Balanced", "Blast", "Defensive", "Flame", "Flexible",
    "Inaccurate", "Overheats", "Power Field", "Primitive", "Reliable",
    "Scatter", "Shocking", "Smoke", "Snare", "Tearing", "Recharge", "Toxic",
    "Unbalanced", "Unreliable", "Unstable", "Unwieldy",
  ]
  const knownQualities = WEAPON_QUALITY_NAMES.map((name) => ({ id: slug(name), name }))
  const WQ_START = sections.weapons - 4
  // Include sections.weapons itself — a few qualities (Unbalanced,
  // Unreliable, Unstable, Unwieldy) sit at the top of that same page,
  // just before its weapon table begins further down.
  const WQ_END = sections.weapons
  const qualityPages: PageData[] = [...pages]
  for (let p = WQ_START; p <= WQ_END && p >= 0 && p < pages.length; p++) {
    const opPage = await extractPageOp(doc, p + 1)
    // The last quality (Unwieldy) sits right before the weapon tables begin
    // on the same page — strip table-shaped rows (an availability value, or
    // a weapon-class + damage-dice combo) the same way Gear/Powers do, so
    // that leftover table data can't tack onto the last entry's tail.
    const strippedItems = stripRows(opPage.items, (rowItems) => {
      const joined = rowItems.map((i) => i.str).join(" ")
      if (AVAILABILITY_VALS.some((av) => new RegExp(`\\b${av}\\b`, "i").test(joined))) return true
      const hasClass = WEAPON_CLASSES.some((c) => new RegExp(`\\b${c}\\b`).test(joined))
      if (hasClass && /\d+d\d+/i.test(joined)) return true
      // Category/column headers repeating across each weapon table
      // ("Bolt Weapons  Name", "Melta Weapons  Name", ...) — "Name" as a
      // standalone column header essentially never appears in this prose.
      return /\bWeapons?\s+Name\b/i.test(joined)
    })
    const rows = new Map<number, Item[]>()
    for (const it of strippedItems) {
      if (!rows.has(it.y)) rows.set(it.y, [])
      rows.get(it.y)!.push(it)
    }
    qualityPages[p] = { items: strippedItems, rows }
  }
  const qualityDescs = parseProseDescriptions(qualityPages, WQ_START, WQ_END, knownQualities, {
    stopRegex: /[^\s\S]/, // never matches — bounded instead by the fixed page range above
  })
  // "Unstable" is immediately followed by the weapon tables' repeating
  // category headers ("Bolt Weapons  Name  Melta Weapons  Name ..."), split
  // across rows in a way stripRows()'s single-row check doesn't catch —
  // truncate at the first repeat of this exact phrase rather than chasing
  // a fully general multi-row table-header detector for one entry's tail.
  const weaponQualities: WeaponQuality[] = knownQualities
    .filter((q) => qualityDescs[q.id])
    .map((q) => ({
      ...q,
      description: qualityDescs[q.id]
        .replace(/\s*(?:\w+\s+)?Weapons\s+Name\b.*$/i, "")
        // A full section/table TITLE ("Table 5–7: Ranged Weapons") trailing
        // at the very end is the weapons chapter starting — unlike a
        // legitimate inline citation ("consult Table 5-6: Weapon
        // Overheating"), a title is not followed by more sentence text.
        .replace(/\s*Table\s*5[-–]\s*\d+\s*:\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\s*$/i, "")
        // Decorative page-epigraph quotes (a curly “ ... ” with a garbled
        // tracked-font body) occasionally trail the last entry on a page.
        .replace(/\s*“[^”]*”\s*$/, ""),
    }))
  console.log(`  → ${weaponQualities.length}/${knownQualities.length} weapon qualities matched a description`)
  writeFileSync(join(OUTPUT_DIR, "weapon-qualities.json"), JSON.stringify(weaponQualities, null, 2))

  // ── Psychic Powers ───────────────────────────────────────────────────────────
  // Powers chapter spans ~35 pages (pages 165–200 approx)
  console.log("\nParsing psychic powers (pages", sections.powers + 1, "–", sections.powers + 35, ")...")
  const powers = parsePowers(pages, sections.powers, sections.powers + 35)
  console.log(`  → ${powers.length} powers`)

  // Each discipline's summary table is immediately followed by a 3-column
  // prose section, same tracked-header layout as Talents/Skills — but each
  // column also has a "label ... value" stat block (Threshold/Focus Time/
  // Sustained/Range) whose label-to-value gap (~140pt) is wider than the
  // real inter-column gap (~20-25pt), which used to break splitColumns()'s
  // largest-gap heuristic. Fix: strip those stat-block rows out of a
  // SEPARATE page-array copy before column-splitting, so only recurring
  // body-prose columns remain to calibrate from.
  const POWERS_OP_START = sections.powers
  const POWERS_OP_END = sections.powers + 35
  console.log(`Re-extracting power description pages ${POWERS_OP_START + 1}–${POWERS_OP_END + 1} via op-list...`)
  const powerPages: PageData[] = [...pages]
  for (let p = POWERS_OP_START; p <= POWERS_OP_END && p < pages.length; p++) {
    const opPage = await extractPageOp(doc, p + 1)
    // Strip Threshold:/Focus Time:/Sustained:/Range: label+value pairs
    // wherever they sit in a shared row (not necessarily the leftmost item).
    const withoutStatBlocks = stripLabelValuePairs(
      opPage.items,
      /^(Threshold|Focus\s*Time|Sustained|Range)\s*:$/i,
    )
    // Summary-table rows ("Call Item  5  Half Action  No") use a clean,
    // un-tracked font — unlike prose headers, their name text would pass
    // the exact-fingerprint match too, constantly resetting currentId
    // mid-table before any real prose is ever reached. Detect and drop
    // the whole row by its distinctive "<digit> <action-type> <yes/no>"
    // shape (a combination that essentially never appears in body prose).
    const strippedItems = stripRows(withoutStatBlocks, (rowItems) => {
      const joined = rowItems.map((i) => i.str).join(" ")
      return /\d+\s+(Half Action|Full Action|Reaction|Free Action)\s+(Yes|No)\b/i.test(joined)
    })
    const rows = new Map<number, Item[]>()
    for (const it of strippedItems) {
      if (!rows.has(it.y)) rows.set(it.y, [])
      rows.get(it.y)!.push(it)
    }
    powerPages[p] = { items: strippedItems, rows }
  }
  const powerDescs = parseProseDescriptions(powerPages, POWERS_OP_START, POWERS_OP_END, powers, {
    stopRegex: /[^\s\S]/, // never matches — bounded instead by the fixed page range above
  })
  const powersMatched = powers.filter((pw) => powerDescs[pw.id]).length
  console.log(`  → ${powersMatched}/${powers.length} powers matched a long description`)

  // Known-bad: "Fling"'s stat-block strip left a stray "Sustained : No"
  // fragment at the start (confirmed by manual inspection) — suppressing
  // rather than shipping the visibly-wrong prefix.
  const POWER_DESC_BLACKLIST = new Set(["fling"])

  const powersWithDesc: PsychicPower[] = powers.map((pw) => ({
    ...pw,
    description: POWER_DESC_BLACKLIST.has(pw.id) ? "" : powerDescs[pw.id] ?? "",
  }))
  writeFileSync(join(OUTPUT_DIR, "powers.json"), JSON.stringify(powersWithDesc, null, 2))

  // ── Armour ───────────────────────────────────────────────────────────────────
  // Table 5-12 is on page 146 (0-indexed 145); scan a couple of pages in case it continues.
  const armourStart = 145
  console.log("\nParsing armour (pages", armourStart + 1, "–", armourStart + 2, ")...")
  const armour = parseArmour(pages, armourStart, armourStart + 1)
  console.log(`  → ${armour.length} armour items`)
  writeFileSync(join(OUTPUT_DIR, "armour.json"), JSON.stringify(armour, null, 2))

  // ── Gear (Ammo, Clothing, Drugs, Tools, Cybernetics) ─────────────────────────
  // Tables scattered across pages 143–161; op-list re-extracted above.
  console.log("\nParsing gear (pages 143–162)...")
  const gear = parseGear(pages, GEAR_OP_START, GEAR_OP_END)
  console.log(`  → ${gear.length} gear items`)

  // Each gear category has its own prose write-up per item (e.g. "Chrono",
  // "Explosive Collar"), same 3-column tracked-header layout as Talents/
  // Skills, spread across the same already re-extracted page range. But
  // this range ALSO contains this category's own quick-ref TABLE, whose
  // item-name cells use a clean (non-tracked) font — those would otherwise
  // match a fingerprint just as validly as a real header, getting opened
  // and then immediately closed by the next page-boundary reset before the
  // REAL prose header is ever reached, permanently blocking it via
  // closedIds. Strip anything shaped like a table row (any row containing
  // a Table 5-N availability value) from a separate page-array copy first.
  const gearPages: PageData[] = [...pages]
  for (let p = GEAR_OP_START; p <= GEAR_OP_END && p < pages.length; p++) {
    const strippedItems = stripRows(pages[p].items, (rowItems) => {
      const joined = rowItems.map((i) => i.str).join(" ")
      return AVAILABILITY_VALS.some((av) => new RegExp(`\\b${av}\\b`, "i").test(joined))
    })
    const rows = new Map<number, Item[]>()
    for (const it of strippedItems) {
      if (!rows.has(it.y)) rows.set(it.y, [])
      rows.get(it.y)!.push(it)
    }
    gearPages[p] = { items: strippedItems, rows }
  }

  console.log(`Parsing gear descriptions (pages ${GEAR_OP_START + 1}–${GEAR_OP_END + 1})...`)
  const gearDescs = parseProseDescriptions(gearPages, GEAR_OP_START, GEAR_OP_END, gear, {
    // NOTE: "Chapter VI" alone is NOT safe here — a drug's description
    // cross-references "Chapter VI: Psychic Powers" mid-sentence, and that
    // string match is indistinguishable from a real heading in plain text.
    stopRegex: /TYPES\s+OF\s+PSYKER/i,
  })
  const gearMatched = gear.filter((g) => gearDescs[g.id]).length
  console.log(`  → ${gearMatched}/${gear.length} gear items matched a long description`)

  // Known-bad: confirmed by manual inspection to have absorbed a neighboring
  // item's prose. Root cause: several ammo variants have a same-line
  // parenthetical suffix ("Charge Pack (pistol)") that breaks the exact
  // fingerprint match the same way a skill's "(Basic)" tag once did, and
  // several Mechadendrite sub-types (Optical, Ballistic, Utility, ...)
  // were never captured as items at all by parseGear()'s table parser —
  // in both cases their header can never match, so their body text has
  // nowhere to go but the previous entry. Suppressing rather than shipping
  // garbled text; a real fix would need parseGear() to also parse those
  // missing item rows, which is a separate, pre-existing gap.
  const GEAR_DESC_BLACKLIST = new Set([
    "bionic-arm", "bionic-locomotion", "bionic-respiratory-system",
    "shells", "bolt-shells", "exotic", "charm", "chrono", "clothing",
    "injector", "sacred-machine-oil", "stimm", "auger-arrays",
    "cortex-implants", "cybernetic-senses", "mind-impulse-unit",
  ])

  const gearWithDesc: GearItem[] = gear.map((g) => ({
    ...g,
    description: GEAR_DESC_BLACKLIST.has(g.id) ? "" : gearDescs[g.id] ?? "",
  }))
  writeFileSync(join(OUTPUT_DIR, "gear.json"), JSON.stringify(gearWithDesc, null, 2))

  console.log(`\nDone → ${OUTPUT_DIR}`)

  // Quick quality summary
  console.log("\nQuality check:")
  console.log(`  Skills without descriptions: ${skillsWithLong.filter((s) => !s.description).length}/${skillsWithLong.length}`)
  console.log(`  Talents with prereqs: ${talents.filter((t) => t.prerequisites).length}/${talents.length}`)
  console.log(`  Weapons with availability: ${weapons.filter((w) => w.availability !== "—").length}/${weapons.length}`)
  console.log(`  Powers with threshold: ${powers.filter((p) => p.threshold !== "—").length}/${powers.length}`)
  console.log(`  Armour items by category:`, [...new Set(armour.map(a => a.category))].join(", "))
  console.log(`  Gear items by category:`, [...new Map(gear.map(g => [g.category, gear.filter(x => x.category === g.category).length])).entries()].map(([k,v])=>k+'('+v+')').join(', '))
  // Show first 5 talents for quick quality check
  console.log("\n  Sample talents:")
  talents.slice(0, 5).forEach(t => console.log(`    ${t.name} | ${t.prerequisites ?? "—"} | ${t.description}`))
}

main().catch((err) => {
  console.error("Extraction failed:", err)
  process.exit(1)
})
