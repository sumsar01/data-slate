import { useState, useRef, useEffect } from "react"
import { Link } from "react-router-dom"
import type { Note, Tag } from '@data-slate/shared'
import { useDateGroups } from "./hooks/useDateGroups"
import { BootSequence } from "./components/BootSequence"
import { TagFilter } from "./components/TagFilter"
import { NoteList } from "./components/NoteList"
import { NoteReader } from "./components/NoteReader"
import { soundClick } from "./audio/sounds"
import "./App.css"

function CogIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="18" stroke="#ffb000" strokeWidth="6" />
      <circle cx="50" cy="50" r="7" fill="#ffb000" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x1 = 50 + 25 * Math.cos(rad)
        const y1 = 50 + 25 * Math.sin(rad)
        const x2 = 50 + 44 * Math.cos(rad)
        const y2 = 50 + 44 * Math.sin(rad)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffb000" strokeWidth="7" strokeLinecap="square" />
      })}
    </svg>
  )
}

function SkullIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="50" cy="44" rx="30" ry="28" fill="#ffb000" />
      <rect x="34" y="65" width="12" height="16" rx="2" fill="#ffb000" />
      <rect x="54" y="65" width="12" height="16" rx="2" fill="#ffb000" />
      <ellipse cx="38" cy="42" rx="9" ry="10" fill="#0a0a0a" />
      <ellipse cx="62" cy="42" rx="9" ry="10" fill="#0a0a0a" />
      <rect x="40" y="68" width="20" height="3" rx="1" fill="#0a0a0a" />
    </svg>
  )
}

let hasBooted = false

export default function App() {
  const [booted, setBooted] = useState(hasBooted)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [activeFilters, setActiveFilters] = useState<Tag[]>([])
  const [mobilePanel, setMobilePanel] = useState<"list" | "reader">("list")
  const [searchQuery, setSearchQuery] = useState("")

  const [navOpen, setNavOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const { groups, loading, reload } = useDateGroups(!!selectedNote)

  const totalNotes = groups.reduce((a, g) => a + g.notes.length, 0)

  function handleSelectNote(note: Note) {
    setSelectedNote(note)
    setMobilePanel("reader")
  }

  function handleBack() {
    soundClick()
    setMobilePanel("list")
  }

  function handleDeleted(noteId: string) {
    if (selectedNote?.id === noteId) setSelectedNote(null)
    reload()
  }

  return (
    <>
      {!booted && <BootSequence onComplete={() => { hasBooted = true; setBooted(true) }} />}
      <div className={`app ${booted ? "app--visible" : ""}`}>
        <div className="scanlines" aria-hidden />

        <header className="app-header">
          <div className="app-header-left">
            {mobilePanel === "reader" && (
              <button className="app-back-btn" onClick={handleBack} aria-label="Back to list">
                ◄ LOG
              </button>
            )}
            <CogIcon />
            <SkullIcon />
            <span className="app-header-title">
              <span className="app-header-title-long">ADEPTUS MECHANICUS <span className="app-header-divider">//</span> </span>
              DATA-SLATE MK.IV
            </span>
          </div>
          <div className="app-header-right">
            {/* Inline links — visible above 900px */}
            <div className="app-nav-inline">
              <Link to="/admin-mechanicus" className="app-export-btn" title="Admin panel">⚙</Link>
              <Link to="/timeline" className="app-export-btn" title="Campaign timeline">◈ TIMELINE</Link>
              <Link to="/wiki" className="app-export-btn" title="Entity wiki">◈ WIKI</Link>
              <Link to="/threat-matrix" className="app-export-btn" title="Threat assessment">◈ THREATS</Link>
              <Link to="/dead-drop" className="app-export-btn" title="Dead Drop — lead tracker">◈ DEAD DROP</Link>
              <Link to="/briefing" className="app-export-btn" title="Mission briefing">◈ BRIEFING</Link>
              <Link to="/vox-search" className="app-export-btn" title="Search vox-log">⌕ SEARCH</Link>
            </div>
            {/* Dropdown — visible below 900px */}
            <div className="app-nav-wrapper" ref={navRef}>
              <button
                className={`app-nav-toggle${navOpen ? " open" : ""}`}
                onClick={() => setNavOpen(o => !o)}
                aria-haspopup="true"
                aria-expanded={navOpen}
              >
                ◈ NAV ▾
              </button>
              {navOpen && (
                <div className="app-nav-dropdown" role="menu">
                  <Link to="/admin-mechanicus" role="menuitem" onClick={() => setNavOpen(false)}>⚙ ADMIN</Link>
                  <hr className="app-nav-separator" />
                  <Link to="/timeline" role="menuitem" onClick={() => setNavOpen(false)}>◈ TIMELINE</Link>
                  <Link to="/wiki" role="menuitem" onClick={() => setNavOpen(false)}>◈ WIKI</Link>
                  <Link to="/threat-matrix" role="menuitem" onClick={() => setNavOpen(false)}>◈ THREATS</Link>
                  <Link to="/dead-drop" role="menuitem" onClick={() => setNavOpen(false)}>◈ DEAD DROP</Link>
                  <Link to="/briefing" role="menuitem" onClick={() => setNavOpen(false)}>◈ BRIEFING</Link>
                  <Link to="/vox-search" role="menuitem" onClick={() => setNavOpen(false)}>⌕ SEARCH</Link>
                </div>
              )}
            </div>
            <Link to="/record" className="app-rec-link">
              <span className="status-dot status-dot--red" />
              <span className="app-header-status-text">REC</span>
            </Link>
            <span className="app-header-status">
              <span className={`status-dot ${loading ? "status-dot--amber" : ""}`} />
              <span className="app-header-status-text">{loading ? "RETRIEVING..." : "COGITATOR ONLINE"}</span>
            </span>
          </div>
        </header>

        <main className="app-main">
          <aside className={`panel panel-left ${mobilePanel === "reader" ? "panel--mobile-hidden" : ""}`}>
            <div className="panel-label">[ AUSPEX LOG v2.3.1 ]</div>
            <div className="app-search-row">
              <input
                className="app-search-input"
                type="search"
                placeholder="SEARCH RECORDS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search notes"
              />
              {searchQuery && (
                <button className="app-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">✕</button>
              )}
            </div>
            <TagFilter active={activeFilters} onChange={setActiveFilters} />
            <NoteList
              groups={groups}
              selectedId={selectedNote?.id ?? null}
              activeTagFilters={activeFilters}
              searchQuery={searchQuery}
              onSelect={handleSelectNote}
              onReload={reload}
              onDeleted={handleDeleted}
            />
          </aside>

          <div className="panel-divider" aria-hidden />

          <section className={`panel panel-right ${mobilePanel === "list" ? "panel--mobile-hidden" : ""}`}>
            <div className="panel-label">[ COGITATOR RECORD ]</div>
            <NoteReader note={selectedNote} />
          </section>
        </main>

        <footer className="app-footer">
          <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
          <span>RECORDS: {totalNotes} // SESSIONS: {groups.length}</span>
        </footer>

        <Link to="/record" className="app-rec-fab" aria-label="Record">
          <span className="status-dot status-dot--red app-rec-fab__dot" />
          <span className="app-rec-fab__label">REC</span>
        </Link>
      </div>
    </>
  )
}
