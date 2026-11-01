import { describe, expect, it } from "vitest"
import { formatMoney, parseMoney, percentChange, percentOf, sumMinor, toDecimalString, MAX_MINOR } from "@/shared/domain/money"
import {
  addDays,
  addMonths,
  endOfMonth,
  instantRange,
  isValidLocalDate,
  localDateOf,
  previousRange,
  rangeForPreset,
  startOfDayInstant,
  startOfWeek,
  eachDay,
} from "@/shared/domain/dates"

describe("money", () => {
  it("parses decimal strings without float error", () => {
    expect(parseMoney("0.10")).toBe(10)
    expect(parseMoney("0.3")).toBe(30)
    expect(parseMoney("19.99")).toBe(1999)
    expect(parseMoney("1,250")).toBe(125_000)
    expect(parseMoney("৳ 99.5")).toBe(9950)
    expect(parseMoney("12345678901.23")).toBe(1_234_567_890_123 > MAX_MINOR ? null : 1_234_567_890_123)
  })
  it("rejects invalid, negative, and over-precise input", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1..2", "1e5"]) expect(parseMoney(bad)).toBeNull()
  })
  it("rejects absurdly large values", () => {
    expect(parseMoney("99999999999999")).toBeNull()
  })
  it("sums exactly (0.1 + 0.2 style)", () => {
    expect(sumMinor([10, 20])).toBe(30)
  })
  it("formats with symbol, grouping, and true minus", () => {
    expect(formatMoney(125_000)).toBe("৳1,250")
    expect(formatMoney(125_050)).toBe("৳1,250.50")
    expect(formatMoney(-50_000)).toBe("−৳500")
    expect(formatMoney(5, { fixedDecimals: true })).toBe("৳0.05")
    expect(formatMoney(100, { showPlus: true, currency: "USD" })).toBe("+$1")
    expect(formatMoney(0)).toBe("৳0")
  })
  it("renders decimal strings", () => {
    expect(toDecimalString(1999)).toBe("19.99")
    expect(toDecimalString(-5)).toBe("-0.05")
    expect(toDecimalString(1000, true)).toBe("10")
  })
  it("rounds percentages with integer math", () => {
    expect(percentOf(1, 3)).toBe(33)
    expect(percentOf(2, 3)).toBe(67)
    expect(percentOf(5, 0)).toBeNull()
    expect(percentChange(150, 100)).toBe(50)
    expect(percentChange(50, 100)).toBe(-50)
    expect(percentChange(10, 0)).toBeNull()
  })
})

describe("dates & timezones", () => {
  it("validates calendar dates incl. leap years", () => {
    expect(isValidLocalDate("2024-02-29")).toBe(true)
    expect(isValidLocalDate("2023-02-29")).toBe(false)
    expect(isValidLocalDate("2024-13-01")).toBe(false)
    expect(isValidLocalDate("2024-1-1")).toBe(false)
  })
  it("assigns instants to the local day in Asia/Dhaka (UTC+6)", () => {
    // 23:30 UTC on Jan 31 is 05:30 Feb 1 in Dhaka.
    expect(localDateOf("2025-01-31T23:30:00Z", "Asia/Dhaka")).toBe("2025-02-01")
    expect(localDateOf("2025-01-31T17:59:59Z", "Asia/Dhaka")).toBe("2025-01-31")
    expect(localDateOf("2025-01-31T18:00:00Z", "Asia/Dhaka")).toBe("2025-02-01")
  })
  it("computes local midnight as a UTC instant", () => {
    expect(startOfDayInstant("2025-03-10", "Asia/Dhaka").toISOString()).toBe("2025-03-09T18:00:00.000Z")
    expect(startOfDayInstant("2025-03-10", "UTC").toISOString()).toBe("2025-03-10T00:00:00.000Z")
  })
  it("handles DST days (24h±1) in America/New_York", () => {
    const { start, end } = instantRange("2025-03-09", "2025-03-09", "America/New_York")
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23)
    const fall = instantRange("2025-11-02", "2025-11-02", "America/New_York")
    expect((fall.end.getTime() - fall.start.getTime()) / 3_600_000).toBe(25)
  })
  it("handles month/year boundaries and leap years", () => {
    expect(addDays("2024-12-31", 1)).toBe("2025-01-01")
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29")
    expect(addDays("2023-02-28", 1)).toBe("2023-03-01")
    expect(endOfMonth("2024-02-10")).toBe("2024-02-29")
    expect(addMonths("2024-01-31", 1)).toBe("2024-02-29")
    expect(addMonths("2025-01-15", -1)).toBe("2024-12-15")
    expect(eachDay("2024-02-27", "2024-03-01")).toHaveLength(4)
  })
  it("builds presets and previous ranges", () => {
    expect(rangeForPreset("month", "2025-03-15")).toEqual({ from: "2025-03-01", to: "2025-03-31" })
    expect(rangeForPreset("last_month", "2025-01-15")).toEqual({ from: "2024-12-01", to: "2024-12-31" })
    expect(startOfWeek("2025-03-12")).toBe("2025-03-10") // Wednesday -> Monday
    expect(previousRange({ from: "2025-03-01", to: "2025-03-31" })).toEqual({ from: "2025-02-01", to: "2025-02-28" })
    expect(previousRange({ from: "2025-03-10", to: "2025-03-16" })).toEqual({ from: "2025-03-03", to: "2025-03-09" })
  })
})

import { instantToZonedLocal, zonedLocalToInstant } from "@/shared/domain/dates"

describe("wall-clock conversion", () => {
  it("round-trips a Dhaka wall-clock time", () => {
    const i = zonedLocalToInstant("2025-03-10T23:30", "Asia/Dhaka")!
    expect(i.toISOString()).toBe("2025-03-10T17:30:00.000Z")
    expect(instantToZonedLocal(i, "Asia/Dhaka")).toBe("2025-03-10T23:30")
  })
  it("rejects invalid values", () => {
    expect(zonedLocalToInstant("2025-02-30T10:00", "UTC")).toBeNull()
    expect(zonedLocalToInstant("2025-02-10T25:00", "UTC")).toBeNull()
    expect(zonedLocalToInstant("garbage", "UTC")).toBeNull()
  })
})
