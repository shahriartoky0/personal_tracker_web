/**
 * Money is always an integer count of minor units (poisha for BDT).
 * No floating-point arithmetic is used to store or combine amounts.
 */
export type Minor = number

/** 1 trillion minor units — far below Number.MAX_SAFE_INTEGER, far above any personal balance. */
export const MAX_MINOR = 1_000_000_000_000

const SYMBOLS: Record<string, string> = {
  BDT: "৳",
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  JPY: "¥",
}

export const SUPPORTED_CURRENCIES = Object.keys(SYMBOLS)

export function isValidMinor(value: unknown): value is Minor {
  return typeof value === "number" && Number.isSafeInteger(value) && Math.abs(value) <= MAX_MINOR
}

/**
 * Parses user input such as "1,250", "৳ 99.5" or "12.05" into minor units.
 * Works on the digit string — never multiplies a float. Returns null if invalid.
 */
export function parseMoney(input: string): Minor | null {
  const cleaned = input.replace(/[,\s৳$€£₹¥]/g, "")
  const match = /^(\d{1,13})(?:\.(\d{1,2}))?$/.exec(cleaned)
  if (!match) return null
  const major = Number(match[1])
  const fraction = Number((match[2] ?? "").padEnd(2, "0") || "0")
  const minor = major * 100 + fraction
  return isValidMinor(minor) ? minor : null
}

export function sumMinor(values: readonly Minor[]): Minor {
  let total = 0
  for (const v of values) total += v
  return total
}

/** Plain decimal string, e.g. 125050 -> "1250.50" (used for CSV and form defaults). */
export function toDecimalString(minor: Minor, trimZeros = false): string {
  const sign = minor < 0 ? "-" : ""
  const abs = Math.abs(minor)
  const major = Math.trunc(abs / 100)
  const fraction = abs % 100
  if (trimZeros && fraction === 0) return `${sign}${major}`
  return `${sign}${major}.${String(fraction).padStart(2, "0")}`
}

export function currencySymbol(currency: string): string {
  return SYMBOLS[currency] ?? currency
}

export interface FormatMoneyOptions {
  currency?: string
  /** Always show two decimals (default: only when there is a fractional part). */
  fixedDecimals?: boolean
  /** Prefix positive values with "+" (for income rows). */
  showPlus?: boolean
}

export function formatMoney(minor: Minor, opts: FormatMoneyOptions = {}): string {
  const { currency = "BDT", fixedDecimals = false, showPlus = false } = opts
  const abs = Math.abs(minor)
  const major = Math.trunc(abs / 100)
  const fraction = abs % 100
  const grouped = new Intl.NumberFormat("en-US").format(major)
  const decimals = fraction !== 0 || fixedDecimals ? `.${String(fraction).padStart(2, "0")}` : ""
  const sign = minor < 0 ? "−" : showPlus && minor > 0 ? "+" : ""
  return `${sign}${currencySymbol(currency)}${grouped}${decimals}`
}

/** Percentage of `part` in `total`, rounded to nearest integer using integer math. Null when total is 0. */
export function percentOf(part: Minor, total: Minor): number | null {
  if (total === 0) return null
  return Math.round((part * 100) / total)
}

/** Percentage change from `previous` to `current`; null when previous is 0. */
export function percentChange(current: Minor, previous: Minor): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) * 100) / Math.abs(previous))
}
