import { useState } from "react"
import type { Note, Tag } from "@data-slate/shared"
import { MOCK_DATA } from "./data/mockData"
import { BootSequence } from "./components/BootSequence"
import { TagFilter } from "./components/TagFilter"
import { NoteList } from "./components/NoteList"
import { NoteReader } from "./components/NoteReader"
import { soundClick } from "./audio/sounds"
import "./App.css"

// Mechanicus cog SVG
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

// Skull SVG
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

export default function App() {
  const [booted, setBooted] = useState(false)
  const [selectedNote, setSelectedNote] = useState<Note | null>(null)
  const [activeFilters, setActiveFilters] = useState<Tag[]>([])
  // Mobile: "list" | "reader"
  const [mobilePanel, setMobilePanel] = useState<"list" | "reader">("list")

  function handleSelectNote(note: Note) {
    setSelectedNote(note)
    setMobilePanel("reader")
  }

  function handleBack() {
    soundClick()
    setMobilePanel("list")
  }

  const totalNotes = MOCK_DATA.reduce((a, g) => a + g.notes.length, 0)

  return (
    <>
      {!booted && <BootSequence onComplete={() => setBooted(true)} />}
      <div className={`app ${booted ? "app--visible" : ""}`}>
        {/* Scanline overlay */}
        <div className="scanlines" aria-hidden />

        {/* Header */}
        <header className="app-header">
          <div className="app-header-left">
            {/* Mobile back button — only visible when in reader on small screens */}
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
            <span className="app-header-status">
              <span className="status-dot" />
              <span className="app-header-status-text">COGITATOR ONLINE</span>
            </span>
            <span className="app-header-rec">
              <span className="status-dot status-dot--red" />
              <span className="app-header-status-text">AUSPEX ACTIVE</span>
            </span>
          </div>
        </header>

        {/* Main layout */}
        <main className="app-main">
          {/* Left panel */}
          <aside className={`panel panel-left ${mobilePanel === "reader" ? "panel--mobile-hidden" : ""}`}>
            <div className="panel-label">[ AUSPEX LOG v2.3.1 ]</div>
            <TagFilter active={activeFilters} onChange={setActiveFilters} />
            <NoteList
              groups={MOCK_DATA}
              selectedId={selectedNote?.id ?? null}
              activeTagFilters={activeFilters}
              onSelect={handleSelectNote}
            />
          </aside>

          {/* Divider — hidden on mobile */}
          <div className="panel-divider" aria-hidden />

          {/* Right panel */}
          <section className={`panel panel-right ${mobilePanel === "list" ? "panel--mobile-hidden" : ""}`}>
            <div className="panel-label">[ COGITATOR RECORD ]</div>
            <NoteReader note={selectedNote} />
          </section>
        </main>

        {/* Footer — hidden on mobile */}
        <footer className="app-footer">
          <span>OMNISSIAH PROTECTS // MACHINE-SPIRIT INTEGRITY: NOMINAL</span>
          <span>RECORDS: {totalNotes} // SESSIONS: {MOCK_DATA.length}</span>
        </footer>
      </div>
    </>
  )
}
