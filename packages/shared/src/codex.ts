// ── Codex: Dark Heresy 1st Edition rules reference types ─────────────────────

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

export type GearItem = {
  id: string
  name: string
  category: string
  weight: string
  cost: string
  availability: string
}

export type CodexSection = "skills" | "talents" | "weapons" | "powers" | "armour" | "gear"
