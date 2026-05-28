import { useEffect } from "react"

/**
 * Adds "page--scrollable" to document.body while the component is mounted,
 * overriding the global overflow:hidden set on html/body/#root in App.css.
 * Cleans up on unmount, restoring the locked-scroll behaviour for the main app.
 */
export function useScrollablePage() {
  useEffect(() => {
    document.body.classList.add("page--scrollable")
    return () => document.body.classList.remove("page--scrollable")
  }, [])
}
