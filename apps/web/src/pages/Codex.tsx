import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import "./Admin.css"
import "./Codex.css"
import type { Skill, Talent, Weapon, PsychicPower, ArmourItem, GearItem, CodexSection } from "@data-slate/shared"

const API_URL = import.meta.env.VITE_API_URL ?? ""

const SECTIONS: { key: CodexSection; label: string }[] = [
  { key: "skills",  label: "SKILLS" },
  { key: "talents", label: "TALENTS" },
  { key: "weapons", label: "WEAPONS" },
  { key: "armour",  label: "ARMOUR" },
  { key: "gear",    label: "GEAR" },
  { key: "powers",  label: "PSYCHIC POWERS" },
]

// ── Section renderers ─────────────────────────────────────────────────────────

function SkillsTable({ items }: { items: Skill[] }) {
  return (
    <table className="codex-table">
      <thead>
        <tr>
          <th>NAME</th>
          <th>TYPE</th>
          <th>CHARACTERISTIC</th>
          <th>DESCRIPTOR</th>
        </tr>
      </thead>
      <tbody>
        {items.map((s) => (
          <tr key={s.id}>
            <td className="codex-name">{s.name}</td>
            <td className={`codex-badge codex-badge--${s.type.toLowerCase()}`}>{s.type.toUpperCase()}</td>
            <td>{s.characteristic}</td>
            <td className="codex-muted">{s.descriptor ?? "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TalentsTable({ items }: { items: Talent[] }) {
  return (
    <table className="codex-table">
      <thead>
        <tr>
          <th>NAME</th>
          <th>PREREQUISITES</th>
          <th>DESCRIPTION</th>
        </tr>
      </thead>
      <tbody>
        {items.map((t) => (
          <tr key={t.id}>
            <td className="codex-name">{t.name}</td>
            <td className="codex-muted codex-prereq">{t.prerequisites ?? "—"}</td>
            <td className="codex-desc">{t.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function WeaponsTable({ items }: { items: Weapon[] }) {
  // Group by category
  const groups = new Map<string, Weapon[]>()
  for (const w of items) {
    if (!groups.has(w.category)) groups.set(w.category, [])
    groups.get(w.category)!.push(w)
  }

  return (
    <>
      {[...groups.entries()].map(([cat, weapons]) => (
        <section key={cat} className="codex-weapon-group">
          <div className="codex-group-header">[ {cat.toUpperCase()} ]</div>
          <table className="codex-table codex-table--weapons">
            <thead>
              <tr>
                <th>NAME</th>
                <th>CLASS</th>
                <th>RANGE</th>
                <th>ROF</th>
                <th>DAMAGE</th>
                <th>PEN</th>
                <th>CLIP</th>
                <th>RELOAD</th>
                <th>SPECIAL</th>
              </tr>
            </thead>
            <tbody>
              {weapons.map((w) => (
                <tr key={w.id}>
                  <td className="codex-name">{w.name}</td>
                  <td className="codex-muted">{w.class}</td>
                  <td>{w.range}</td>
                  <td>{w.rof}</td>
                  <td className="codex-highlight">{w.damage}</td>
                  <td>{w.penetration}</td>
                  <td>{w.clip}</td>
                  <td>{w.reload}</td>
                  <td className="codex-muted codex-special">{w.special}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}

function ArmourTable({ items }: { items: ArmourItem[] }) {
  const groups = new Map<string, ArmourItem[]>()
  for (const a of items) {
    if (!groups.has(a.category)) groups.set(a.category, [])
    groups.get(a.category)!.push(a)
  }

  return (
    <>
      {[...groups.entries()].map(([cat, armours]) => (
        <section key={cat} className="codex-weapon-group">
          <div className="codex-group-header">[ {cat.toUpperCase()} ]</div>
          <table className="codex-table codex-table--armour">
            <thead>
              <tr>
                <th>NAME</th>
                <th>LOCATIONS</th>
                <th>AP</th>
                <th>WT</th>
                <th>COST</th>
                <th>AVAILABILITY</th>
              </tr>
            </thead>
            <tbody>
              {armours.map((a) => (
                <tr key={a.id}>
                  <td className="codex-name">{a.name}</td>
                  <td className="codex-muted">{a.locations}</td>
                  <td className="codex-highlight codex-threshold">{a.ap}</td>
                  <td>{a.weight}</td>
                  <td>{a.cost}</td>
                  <td className="codex-muted">{a.availability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}

const GEAR_CATEGORY_ORDER = [
  "Ammo",
  "Clothing & Personal Items",
  "Drugs & Consumables",
  "Tools",
  "Cybernetics",
]

function GearTable({ items }: { items: GearItem[] }) {
  const groups = new Map<string, GearItem[]>()
  for (const g of items) {
    if (!groups.has(g.category)) groups.set(g.category, [])
    groups.get(g.category)!.push(g)
  }

  const orderedGroups = [
    ...GEAR_CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => [c, groups.get(c)!] as [string, GearItem[]]),
    ...[...groups.entries()].filter(([c]) => !GEAR_CATEGORY_ORDER.includes(c)),
  ]

  return (
    <>
      {orderedGroups.map(([cat, gears]) => (
        <section key={cat} className="codex-weapon-group">
          <div className="codex-group-header">[ {cat.toUpperCase()} ]</div>
          <table className="codex-table codex-table--gear">
            <thead>
              <tr>
                <th>NAME</th>
                <th>WT</th>
                <th>COST</th>
                <th>AVAILABILITY</th>
              </tr>
            </thead>
            <tbody>
              {gears.map((g) => (
                <tr key={g.id}>
                  <td className="codex-name">{g.name}</td>
                  <td>{g.weight}</td>
                  <td>{g.cost}</td>
                  <td className="codex-muted">{g.availability}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}

const DISCIPLINE_ORDER = ["Minor", "Biomancy", "Divination", "Pyromancy", "Telekinetics", "Telepathy"]

function PowersTable({ items }: { items: PsychicPower[] }) {
  const groups = new Map<string, PsychicPower[]>()
  for (const p of items) {
    if (!groups.has(p.discipline)) groups.set(p.discipline, [])
    groups.get(p.discipline)!.push(p)
  }

  const orderedGroups = [
    ...DISCIPLINE_ORDER.filter((d) => groups.has(d)).map((d) => [d, groups.get(d)!] as [string, PsychicPower[]]),
    ...[...groups.entries()].filter(([d]) => !DISCIPLINE_ORDER.includes(d)),
  ]

  return (
    <>
      {orderedGroups.map(([disc, powers]) => (
        <section key={disc} className="codex-power-group">
          <div className="codex-group-header">[ {disc.toUpperCase()} ]</div>
          <table className="codex-table codex-table--powers">
            <thead>
              <tr>
                <th>NAME</th>
                <th>THRESHOLD</th>
                <th>FOCUS TIME</th>
                <th>SUSTAINED</th>
              </tr>
            </thead>
            <tbody>
              {powers.map((p) => (
                <tr key={p.id}>
                  <td className="codex-name">{p.name}</td>
                  <td className="codex-highlight codex-threshold">{p.threshold}</td>
                  <td className="codex-muted">{p.focus_time}</td>
                  <td className={p.sustained ? "codex-yes" : "codex-no"}>
                    {p.sustained ? "YES" : "NO"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

type AnyItem = Skill | Talent | Weapon | PsychicPower | ArmourItem | GearItem

export default function Codex() {
  const [activeSection, setActiveSection] = useState<CodexSection>("skills")
  const [query, setQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [items, setItems] = useState<AnyItem[]>([])
  const [loading, setLoading] = useState(true)    // true on first mount
  const [count, setCount] = useState(0)

  // Debounce query by 200ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200)
    return () => clearTimeout(t)
  }, [query])

  // Fetch section data when section or debounced query changes
  useEffect(() => {
    let cancelled = false
    const url = `${API_URL}/codex?section=${activeSection}${debouncedQuery ? `&q=${encodeURIComponent(debouncedQuery)}` : ""}`
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setItems(data.items ?? [])
          setCount(data.count ?? 0)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([])
          setCount(0)
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [activeSection, debouncedQuery])

  // Reset query when switching sections
  const handleSection = (s: CodexSection) => {
    setLoading(true)   // safe: called from event handler, not effect
    setActiveSection(s)
    setQuery("")
  }

  return (
    <div className="admin-shell">
      <div className="scanlines" aria-hidden />

      <header className="admin-header">
        <div>
          <div className="admin-header-title">DATA-SLATE MK.IV // CODEX IMPERIALIS</div>
          <div className="admin-header-sub">
            ADEPTUS MECHANICUS // RULES &amp; REFERENCE // DARK HERESY 1ST ED
          </div>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link to="/wiki" className="admin-back-link">◄ WIKI</Link>
          <Link to="/" className="admin-back-link">◄ LOG</Link>
        </div>
      </header>

      {/* Section tab nav */}
      <nav className="codex-tabs">
        {SECTIONS.map(({ key, label }) => (
          <button
            key={key}
            className={`codex-tab${activeSection === key ? " codex-tab--active" : ""}`}
            onClick={() => handleSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Search bar */}
      <div className="codex-search-bar">
        <span className="codex-search-icon">⌕</span>
        <input
          className="codex-search-input"
          type="text"
          placeholder="SEARCH CODEX..."
          value={query}
          onChange={(e) => { setLoading(true); setQuery(e.target.value) }}
          spellCheck={false}
          autoCorrect="off"
          autoCapitalize="off"
        />
        {query && (
          <button className="codex-search-clear" onClick={() => setQuery("")}>✕</button>
        )}
        <span className="codex-result-count">
          {loading ? "..." : `${count} ENTRIES`}
        </span>
      </div>

      <main className="codex-main">
        {loading ? (
          <div className="admin-loading">ACCESSING CODEX DATA...</div>
        ) : items.length === 0 ? (
          <div className="codex-empty">
            <div className="codex-empty-text">NO ENTRIES FOUND</div>
            {query && (
              <div className="codex-empty-sub">
                No results for &quot;{query}&quot;
              </div>
            )}
          </div>
        ) : (
          <>
            {activeSection === "skills"  && <SkillsTable  items={items as Skill[]}        />}
            {activeSection === "talents" && <TalentsTable items={items as Talent[]}       />}
            {activeSection === "weapons" && <WeaponsTable items={items as Weapon[]}       />}
            {activeSection === "armour"  && <ArmourTable  items={items as ArmourItem[]}   />}
            {activeSection === "gear"    && <GearTable    items={items as GearItem[]}     />}
            {activeSection === "powers"  && <PowersTable  items={items as PsychicPower[]} />}
          </>
        )}
      </main>

      <footer className="admin-footer">
        OMNISSIAH PROTECTS // CODEX IMPERIALIS // DARK HERESY 1ST ED // {count} ENTRIES
      </footer>
    </div>
  )
}

