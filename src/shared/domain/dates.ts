/**
 * Date-only concepts (a budget day) are `LocalDate` strings, kept distinct from timestamps
 * (ISO instants). A timestamp belongs to a LocalDate only relative to a timezone.
 */
export type LocalDate = string // YYYY-MM-DD
export type Instant = string // ISO-8601 with offset/Z

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function isValidLocalDate(value: string): value is LocalDate {
  const m = DATE_RE.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const dt = new Date(Date.UTC(y, mo - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

function parts(date: LocalDate): [number, number, number] {
  const m = DATE_RE.exec(date)
  if (!m) throw new Error(`Invalid LocalDate: ${date}`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

function fmt(y: number, m: number, d: number): LocalDate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()
function zonedFormatter(tz: string): Intl.DateTimeFormat {
  let f = formatterCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
    formatterCache.set(tz, f)
  }
  return f
}

function zonedFields(ts: number, tz: string) {
  const out: Record<string, number> = {}
  for (const p of zonedFormatter(tz).formatToParts(new Date(ts))) {
    if (p.type !== "literal") out[p.type] = Number(p.value)
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number }
}

/** Offset (ms) of `tz` from UTC at the given instant: local = utc + offset. */
function offsetMs(ts: number, tz: string): number {
  const f = zonedFields(ts, tz)
  const asUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second)
  return asUtc - Math.floor(ts / 1000) * 1000
}

/** The local calendar date an instant falls on in `tz`. */
export function localDateOf(instant: Date | string, tz: string): LocalDate {
  const ts = typeof instant === "string" ? Date.parse(instant) : instant.getTime()
  if (Number.isNaN(ts)) throw new Error(`Invalid instant: ${String(instant)}`)
  const f = zonedFields(ts, tz)
  return fmt(f.year, f.month, f.day)
}

export function todayIn(tz: string, now: Date = new Date()): LocalDate {
  return localDateOf(now, tz)
}

/** The UTC instant at which `date` begins in `tz` (handles DST transitions). */
export function startOfDayInstant(date: LocalDate, tz: string): Date {
  const [y, m, d] = parts(date)
  const guess = Date.UTC(y, m - 1, d)
  let result = guess - offsetMs(guess, tz)
  const corrected = guess - offsetMs(result, tz)
  if (corrected !== result) result = corrected
  return new Date(result)
}

/** Half-open UTC instant range [start, end) covering local dates from..to inclusive. */
export function instantRange(from: LocalDate, to: LocalDate, tz: string): { start: Date; end: Date } {
  return { start: startOfDayInstant(from, tz), end: startOfDayInstant(addDays(to, 1), tz) }
}

export function addDays(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = parts(date)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return fmt(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function diffDays(from: LocalDate, to: LocalDate): number {
  const [y1, m1, d1] = parts(from)
  const [y2, m2, d2] = parts(to)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const n = diffDays(from, to)
  if (n < 0) return []
  return Array.from({ length: n + 1 }, (_, i) => addDays(from, i))
}

export function startOfMonth(date: LocalDate): LocalDate {
  const [y, m] = parts(date)
  return fmt(y, m, 1)
}

export function endOfMonth(date: LocalDate): LocalDate {
  const [y, m] = parts(date)
  return fmt(y, m, new Date(Date.UTC(y, m, 0)).getUTCDate())
}

export function addMonths(date: LocalDate, n: number): LocalDate {
  const [y, m, d] = parts(date)
  const first = new Date(Date.UTC(y, m - 1 + n, 1))
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  return fmt(first.getUTCFullYear(), first.getUTCMonth() + 1, Math.min(d, lastDay))
}

/** Day of week, 0 = Sunday. */
export function dayOfWeek(date: LocalDate): number {
  const [y, m, d] = parts(date)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/** Start of the week containing `date` (default Monday). */
export function startOfWeek(date: LocalDate, weekStartsOn = 1): LocalDate {
  const diff = (dayOfWeek(date) - weekStartsOn + 7) % 7
  return addDays(date, -diff)
}

export type PeriodPreset = "today" | "week" | "month" | "last_month" | "last_30" | "custom"

export interface DateRange {
  from: LocalDate
  to: LocalDate
}

export function rangeForPreset(preset: Exclude<PeriodPreset, "custom">, today: LocalDate): DateRange {
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "week": {
      const from = startOfWeek(today)
      return { from, to: addDays(from, 6) }
    }
    case "month":
      return { from: startOfMonth(today), to: endOfMonth(today) }
    case "last_month": {
      const prev = addMonths(startOfMonth(today), -1)
      return { from: prev, to: endOfMonth(prev) }
    }
    case "last_30":
      return { from: addDays(today, -29), to: today }
  }
}

/** The range of equal length immediately preceding `range` (calendar-month aware for full months). */
export function previousRange(range: DateRange): DateRange {
  const isFullMonth = range.from === startOfMonth(range.from) && range.to === endOfMonth(range.from)
  if (isFullMonth) {
    const prev = addMonths(range.from, -1)
    return { from: prev, to: endOfMonth(prev) }
  }
  const len = diffDays(range.from, range.to) + 1
  return { from: addDays(range.from, -len), to: addDays(range.from, -1) }
}

const LOCAL_DT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Converts a "YYYY-MM-DDTHH:mm" wall-clock value in `tz` to the UTC instant it denotes. Null if invalid. */
export function zonedLocalToInstant(local: string, tz: string): Date | null {
  const m = LOCAL_DT_RE.exec(local)
  if (!m || !isValidLocalDate(`${m[1]}-${m[2]}-${m[3]}`)) return null
  const [h, min] = [Number(m[4]), Number(m[5])]
  if (h > 23 || min > 59) return null
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), h, min)
  let result = guess - offsetMs(guess, tz)
  const corrected = guess - offsetMs(result, tz)
  if (corrected !== result) result = corrected
  return new Date(result)
}

/** Formats an instant as a "YYYY-MM-DDTHH:mm" wall-clock value in `tz` (for datetime-local inputs). */
export function instantToZonedLocal(instant: Date | string, tz: string): string {
  const ts = typeof instant === "string" ? Date.parse(instant) : instant.getTime()
  const f = zonedFields(ts, tz)
  const p = (n: number) => String(n).padStart(2, "0")
  return `${fmt(f.year, f.month, f.day)}T${p(f.hour)}:${p(f.minute)}`
}
