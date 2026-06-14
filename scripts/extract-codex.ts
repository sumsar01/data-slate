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

          items.push({ id, name, category, weight, cost, availability: avail })
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
  // Talent table spans talentsStart through talentsStart+2 (≈3 pages).
  const talentsStart = sections.talents + 1
  const talentsOpEnd = talentsStart + 2
  console.log(`\nRe-extracting talent pages ${talentsStart + 1}–${talentsOpEnd + 1} via op-list...`)
  for (let p = talentsStart; p <= talentsOpEnd; p++) {
    pages[p] = await extractPageOp(doc, p + 1)  // pdfjs is 1-indexed
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
  writeFileSync(join(OUTPUT_DIR, "skills.json"), JSON.stringify(skills, null, 2))

  // ── Talents ─────────────────────────────────────────────────────────────────
  // Quick-ref table starts ONE page after the Chapter IV intro heading.
  // Scan up to +3 pages from the table start to be safe.
  console.log("\nParsing talents (pages", talentsStart + 1, "–", talentsStart + 2, ")...")
  const talents = parseTalents(pages, talentsStart, talentsStart + 2)
  console.log(`  → ${talents.length} talents`)
  writeFileSync(join(OUTPUT_DIR, "talents.json"), JSON.stringify(talents, null, 2))

  // ── Weapons ─────────────────────────────────────────────────────────────────
  console.log("\nParsing weapons (pages", sections.weapons + 1, "–", sections.weapons + 25, ")...")
  const weapons = parseWeapons(pages, sections.weapons, sections.weapons + 25)
  console.log(`  → ${weapons.length} weapons`)
  writeFileSync(join(OUTPUT_DIR, "weapons.json"), JSON.stringify(weapons, null, 2))

  // ── Psychic Powers ───────────────────────────────────────────────────────────
  // Powers chapter spans ~35 pages (pages 165–200 approx)
  console.log("\nParsing psychic powers (pages", sections.powers + 1, "–", sections.powers + 35, ")...")
  const powers = parsePowers(pages, sections.powers, sections.powers + 35)
  console.log(`  → ${powers.length} powers`)
  writeFileSync(join(OUTPUT_DIR, "powers.json"), JSON.stringify(powers, null, 2))

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
  writeFileSync(join(OUTPUT_DIR, "gear.json"), JSON.stringify(gear, null, 2))

  console.log(`\nDone → ${OUTPUT_DIR}`)

  // Quick quality summary
  console.log("\nQuality check:")
  console.log(`  Skills without descriptions: ${skills.filter((s) => !s.description).length}/${skills.length}`)
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
