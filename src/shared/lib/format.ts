import { addDays, type LocalDate } from "@/shared/domain/dates"

export function formatTime(instant: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(instant))
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

/** "10 Mar 2025" — formatted from the date parts, so it never shifts with the viewer's timezone. */
export function formatDate(date: LocalDate, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number)
  const dow = DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  const base = `${d} ${MONTHS[m - 1]}${opts.year === false ? "" : ` ${y}`}`
  return opts.weekday ? `${dow}, ${base}` : base
}

export function dayLabel(date: LocalDate, today: LocalDate): string {
  if (date === today) return "Today"
  if (date === addDays(today, -1)) return "Yesterday"
  return formatDate(date, { weekday: true })
}

export function formatPercent(n: number | null): string {
  return n === null ? "—" : `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}%`
}
