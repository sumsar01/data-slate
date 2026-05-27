/**
 * Imperial Date conversion for Warhammer 40,000
 *
 * Format: CHECK_NUMBER DAY_FRACTION.YEAR_SHORT.M41
 *
 * Check number (0-9): 0 = highly accurate, 9 = estimated/unreliable
 * Day fraction (000-999): day of year as a 3-digit fraction of 365
 * Year short: last 3 digits of the year
 * Millennium: M41 (hardcoded for 40K setting)
 *
 * Example: 2026-05-27 → 0 147 026.M41
 */
export function toImperialDate(dateStr: string): string {
  const date = new Date(dateStr + "T12:00:00Z") // noon UTC to avoid timezone edge cases
  if (isNaN(date.getTime())) return dateStr

  const year = date.getUTCFullYear()
  const startOfYear = new Date(Date.UTC(year, 0, 1))
  const dayOfYear = Math.floor((date.getTime() - startOfYear.getTime()) / 86_400_000) + 1
  const dayFraction = Math.floor((dayOfYear / 365) * 1000)
    .toString()
    .padStart(3, "0")

  const yearShort = (year % 1000).toString().padStart(3, "0")

  return `0 ${dayFraction} ${yearShort}.M41`
}

/**
 * Format an Imperial date for display: full format with label
 */
export function imperialDateLabel(dateStr: string): string {
  return `A.D. ${toImperialDate(dateStr)}`
}
