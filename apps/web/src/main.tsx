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
import Login from "./pages/Login.tsx"
import RequireAuth from "./components/RequireAuth.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<Login />} />
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/wiki" element={<Wiki />} />
        <Route path="/wiki/name/:name" element={<WikiPage byName />} />
        <Route path="/wiki/:id" element={<WikiPage />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/record" element={<RequireAuth><Record /></RequireAuth>} />
        <Route path="/admin-mechanicus" element={<RequireAuth><Admin /></RequireAuth>} />
        <Route path="/admin-mechanicus/notes" element={<RequireAuth><AdminNotes /></RequireAuth>} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
