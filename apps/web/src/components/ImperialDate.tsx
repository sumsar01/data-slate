import { toImperialDate } from "../utils/imperialDate"
import "./ImperialDate.css"

interface ImperialDateProps {
  date: string // YYYY-MM-DD
  showReal?: boolean
  className?: string
}

export function ImperialDate({ date, showReal = true, className }: ImperialDateProps) {
  const imperial = toImperialDate(date)

  return (
    <span
      className={`imperial-date ${className ?? ""}`}
      title={showReal ? `Standarddato: ${date}` : undefined}
    >
      {imperial}
    </span>
  )
}
