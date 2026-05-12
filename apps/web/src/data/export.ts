import type { DateGroup } from "../shared"

function formatDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export function exportGroupsToMarkdown(groups: DateGroup[]): string {
  const lines: string[] = []
  lines.push("# DATA-SLATE MK.IV — SESSION LOG")
  lines.push(`_Exported: ${new Date().toLocaleString("en-GB")}_`)
  lines.push("")

  for (const group of groups) {
    const sessionLabel = group.session_name ? ` — ${group.session_name}` : ""
    lines.push(`## ${formatDate(group.date)}${sessionLabel}`)
    lines.push("")

    for (const note of group.notes) {
      lines.push(`### ${note.title}`)
      const time = new Date(note.created_at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      const tags = note.tags.length > 0 ? note.tags.join(", ") : "unclassified"
      lines.push(`_${time} · ${formatDuration(note.duration_s)} · ${tags}_`)
      lines.push("")
      if (note.transcript) {
        lines.push(note.transcript)
        lines.push("")
      }
      lines.push(`[Audio](${note.audio_url})`)
      lines.push("")
      lines.push("---")
      lines.push("")
    }
  }

  return lines.join("\n")
}

export function exportSessionToMarkdown(group: DateGroup): string {
  return exportGroupsToMarkdown([group])
}

export function downloadMarkdown(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
