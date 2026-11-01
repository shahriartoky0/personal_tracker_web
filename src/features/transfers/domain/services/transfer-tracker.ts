import { instantRange, type DateRange } from "@/shared/domain/dates"
import { sumMinor, type Minor } from "@/shared/domain/money"
import type { Transaction } from "@/features/transactions/domain/entities/transaction"
import { isPersonTransfer } from "@/features/transactions/domain/services/transaction-calculator"
import type { Payee } from "../entities/payee"

export interface PayeeSummary {
  payeeId: string
  name: string
  /** Within the selected period. */
  sent: Minor
  received: Minor
  count: number
  /** All-time money sent to this person (regardless of the period). */
  sentAllTime: Minor
  receivedAllTime: Minor
  lastAt: string | null
}

export interface TransferTracker {
  range: DateRange
  sent: Minor
  received: Minor
  /** sent − received: what has net left your hands in this period. */
  netSent: Minor
  count: number
  peopleCount: number
  withProof: number
  byPayee: PayeeSummary[]
  /** Person transfers in the period, newest first. */
  transfers: Transaction[]
}

/**
 * Pure tracker calculation. `all` is every person transfer (all time, any order); the period
 * numbers are derived from it so per-person all-time totals come from the same single query.
 */
export function buildTransferTracker(args: {
  all: readonly Transaction[]
  payees: readonly Payee[]
  range: DateRange
  timezone: string
  payeeId?: string
}): TransferTracker {
  const { all, payees, range, timezone, payeeId } = args
  const { start, end } = instantRange(range.from, range.to, timezone)
  const people = all.filter((t) => isPersonTransfer(t) && t.payeeId && (!payeeId || t.payeeId === payeeId))
  const inPeriod = people
    .filter((t) => {
      const ts = Date.parse(t.occurredAt)
      return ts >= start.getTime() && ts < end.getTime()
    })
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))

  const names = new Map(payees.map((p) => [p.id, p.name]))
  const rows = new Map<string, PayeeSummary>()
  const row = (id: string): PayeeSummary => {
    let r = rows.get(id)
    if (!r) {
      r = { payeeId: id, name: names.get(id) ?? "Unknown", sent: 0, received: 0, count: 0, sentAllTime: 0, receivedAllTime: 0, lastAt: null }
      rows.set(id, r)
    }
    return r
  }
  for (const t of people) {
    const r = row(t.payeeId!)
    if (t.transferDirection === "out") r.sentAllTime += t.amount
    else r.receivedAllTime += t.amount
    if (!r.lastAt || t.occurredAt > r.lastAt) r.lastAt = t.occurredAt
  }
  for (const t of inPeriod) {
    const r = row(t.payeeId!)
    if (t.transferDirection === "out") r.sent += t.amount
    else r.received += t.amount
    r.count += 1
  }

  const sent = sumMinor(inPeriod.filter((t) => t.transferDirection === "out").map((t) => t.amount))
  const received = sumMinor(inPeriod.filter((t) => t.transferDirection === "in").map((t) => t.amount))
  const byPayee = [...rows.values()]
    .filter((r) => r.count > 0)
    .sort((a, b) => b.sent + b.received - (a.sent + a.received))

  return {
    range,
    sent,
    received,
    netSent: sent - received,
    count: inPeriod.length,
    peopleCount: byPayee.length,
    withProof: inPeriod.filter((t) => t.receiptPath).length,
    byPayee,
    transfers: inPeriod,
  }
}
