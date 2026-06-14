import { Hono } from "hono"
import { readFileSync } from "fs"
import { join } from "path"
import { fileURLToPath } from "url"
import type { Skill, Talent, Weapon, PsychicPower, ArmourItem, GearItem, CodexSection } from "@data-slate/shared"

const DATA_DIR = fileURLToPath(new URL("../data/codex", import.meta.url))

type AnyItem = Skill | Talent | Weapon | PsychicPower | ArmourItem | GearItem

const VALID_SECTIONS: CodexSection[] = ["skills", "talents", "weapons", "powers", "armour", "gear"]

// Load JSON once, cache in memory
const cache: Partial<Record<CodexSection, AnyItem[]>> = {}

function load(section: CodexSection): AnyItem[] {
  if (cache[section]) return cache[section]!
  const raw = readFileSync(join(DATA_DIR, `${section}.json`), "utf-8")
  const data = JSON.parse(raw) as AnyItem[]
  cache[section] = data
  return data
}

function matchesQuery(item: AnyItem, section: CodexSection, q: string): boolean {
  const name = (item as any).name?.toLowerCase() ?? ""
  if (name.includes(q)) return true

  switch (section) {
    case "skills": {
      const s = item as Skill
      return (s.characteristic?.toLowerCase().includes(q)) ||
             (s.descriptor?.toLowerCase().includes(q) ?? false)
    }
    case "talents": {
      const t = item as Talent
      return (t.prerequisites?.toLowerCase().includes(q) ?? false) ||
             t.description.toLowerCase().includes(q)
    }
    case "weapons": {
      const w = item as Weapon
      return w.category.toLowerCase().includes(q) ||
             w.class.toLowerCase().includes(q) ||
             w.special.toLowerCase().includes(q)
    }
    case "powers": {
      const p = item as PsychicPower
      return p.discipline.toLowerCase().includes(q) ||
             p.focus_time.toLowerCase().includes(q)
    }
    case "armour": {
      const a = item as ArmourItem
      return a.category.toLowerCase().includes(q) ||
             a.locations.toLowerCase().includes(q)
    }
    case "gear": {
      const g = item as GearItem
      return g.category.toLowerCase().includes(q)
    }
    default:
      return false
  }
}

export const codexRouter = new Hono()

// GET /codex?section=skills|talents|weapons|powers|armour|gear[&q=search]
codexRouter.get("/", (c) => {
  const sectionParam = c.req.query("section") as CodexSection | undefined
  if (!sectionParam || !VALID_SECTIONS.includes(sectionParam)) {
    return c.json({ error: "section required", valid: VALID_SECTIONS }, 400)
  }

  const q = c.req.query("q")?.trim().toLowerCase()
  let items = load(sectionParam)

  if (q) {
    items = items.filter((item) => matchesQuery(item, sectionParam, q))
  }

  return c.json({ section: sectionParam, items, count: items.length })
})
