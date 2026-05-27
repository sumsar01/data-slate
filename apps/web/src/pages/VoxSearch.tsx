import { useState } from "react"
import { Link } from "react-router-dom"
import type { SearchResult, Tag } from "../shared"
import { ALL_TAGS } from "../shared"
import { toImperialDate } from "../utils/imperialDate"
import "./VoxSearch.css"

const API_URL = import.meta.env.VITE_API_URL ?? ""

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi"))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="vox-highlight">{part}</mark>
      : part
  )
}

export default function VoxSearch() {
  const [query, setQuery] = useState("")
  const [activeTags, setActiveTags] = useState<Tag[]>([])
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault()
    if (!query.trim() && activeTags.length === 0) return
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query.trim()) params.set("q", query.trim())
      if (activeTags.length) params.set("tags", activeTags.join(","))
      const res = await fetch(`${API_URL}/search?${params}`)
      const data = await res.json()
      setResults(data.results ?? [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  // Auto-search when tags change if we've already searched
  function handleTagToggle(tag: Tag) {
    const next = activeTags.includes(tag)
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag]
    setActiveTags(next)
    if (searched) {
      setTimeout(() => handleSearch(), 0)
    }
  }

  return (
    <div className="vox-page">
      <div className="scanlines" aria-hidden />
      <header className="app-header">
        <div className="app-header-left">
          <span className="app-header-title">
            <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
            VOX-LOG SØGNING
          </span>
        </div>
        <div className="app-header-right">
          <Link to="/" className="app-export-btn">◄ LOG</Link>
          <span className="app-header-status">
            <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
            <span className="app-header-status-text">{loading ? "SØGER..." : "COGITATOR ONLINE"}</span>
          </span>
        </div>
      </header>

      <main className="vox-main">
        <div className="panel-label">[ AUSPEX-SØGNING // VOX-LOG GENNEMGANG ]</div>

        <form className="vox-search-form" onSubmit={handleSearch}>
          <div className="vox-search-row">
            <span className="vox-prompt">FORESPØRGSEL &gt;</span>
            <input
              className="vox-search-input"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="INDTAST SØGEORD..."
              autoFocus
            />
            <button className="vox-search-btn" type="submit" disabled={loading}>
              {loading ? "SØGER_" : "EXECUTE"}
            </button>
          </div>

          <div className="vox-tag-row">
            {ALL_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className={`vox-tag-btn ${activeTags.includes(tag) ? "vox-tag-btn--active" : ""}`}
                onClick={() => handleTagToggle(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        </form>

        {!searched && (
          <div className="vox-idle">
            <div className="vox-idle-text">AUSPEX-SCANNER STAND-BY</div>
            <div className="vox-idle-sub">Søg i alle vox-optagelser og transskripter</div>
          </div>
        )}

        {searched && results !== null && (
          <div className="vox-results">
            <div className="vox-results-header">
              {results.length === 0
                ? "INGEN RESULTATER FUNDET"
                : `${results.length} OPTEGNELSE${results.length !== 1 ? "R" : ""} FUNDET`}
            </div>
            {results.map((r) => (
              <Link key={r.id} to={`/?note=${r.id}`} className="vox-result-card">
                <div className="vox-result-header">
                  <span className="vox-result-title">{highlight(r.title, query)}</span>
                  <span className="vox-result-meta">
                    {toImperialDate(r.date)}
                    {r.session_name && <> · {r.session_name}</>}
                  </span>
                </div>
                {r.tags.length > 0 && (
                  <div className="vox-result-tags">
                    {r.tags.map((t) => <span key={t} className="vox-result-tag">{t}</span>)}
                  </div>
                )}
                <div className="vox-result-excerpt">{highlight(r.excerpt, query)}</div>
              </Link>
            ))}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
        {results !== null && <span>RESULTATER: {results.length}</span>}
      </footer>
    </div>
  )
}
