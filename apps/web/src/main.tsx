import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter, Routes, Route } from "react-router-dom"
import App from "./App.tsx"
import Record from "./pages/Record.tsx"
import ShareView from "./pages/ShareView.tsx"
import Admin from "./pages/Admin.tsx"
import "./index.css"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/record" element={<Record />} />
        <Route path="/share/:token" element={<ShareView />} />
        <Route path="/admin-mechanicus" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
