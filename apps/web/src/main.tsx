import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import App from "./App.tsx"
import Record from "./pages/Record.tsx"
import ShareView from "./pages/ShareView.tsx"
import Admin from "./pages/Admin.tsx"
import Wiki from "./pages/Wiki.tsx"
import WikiPage from "./pages/WikiPage.tsx"
import Timeline from "./pages/Timeline.tsx"
import AdminNotes from "./pages/AdminNotes.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/record" element={<Record />} />
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/admin-mechanicus" element={<Admin />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/wiki/name/:name" element={<WikiPage byName />} />
        <Route path="/wiki/:id" element={<WikiPage />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/admin-mechanicus/notes" element={<AdminNotes />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
