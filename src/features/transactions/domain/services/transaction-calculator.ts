import { sumMinor, type Minor } from "@/shared/domain/money"
import { localDateOf, type LocalDate } from "@/shared/domain/dates"
import type { Transaction } from "../entities/transaction"

/** Transfers are never income or expense. These helpers are the only place that rule lives. */
export const isExpense = (t: Transaction) => t.type === "expense"
export const isIncome = (t: Transaction) => t.type === "income"
export const isTransfer = (t: Transaction) => t.type === "transfer"
export const isPersonTransfer = (t: Transaction) => t.type === "person_transfer"
export const isUnplannedExpense = (t: Transaction) => isExpense(t) && t.plannedStatus === "unplanned"

export function totalExpenses(txs: readonly Transaction[]): Minor {
  return sumMinor(txs.filter(isExpense).map((t) => t.amount))
}

export function totalIncome(txs: readonly Transaction[]): Minor {
  return sumMinor(txs.filter(isIncome).map((t) => t.amount))
}

export function totalUnplanned(txs: readonly Transaction[]): Minor {
  return sumMinor(txs.filter(isUnplannedExpense).map((t) => t.amount))
}

export function totalPlannedExpenses(txs: readonly Transaction[]): Minor {
  return sumMinor(txs.filter((t) => isExpense(t) && t.plannedStatus === "planned").map((t) => t.amount))
}

/** Money sent to people (never counted as an expense). */
export function totalSentToPeople(txs: readonly Transaction[]): Minor {
  return sumMinor(txs.filter((t) => isPersonTransfer(t) && t.transferDirection === "out").map((t) => t.amount))
}

/** Money received from people (never counted as income). */
export function totalReceivedFromPeople(txs: readonly Transaction[]): Minor {
  return sumMinor(txs.filter((t) => isPersonTransfer(t) && t.transferDirection === "in").map((t) => t.amount))
}

/** Income − expenses; transfers excluded. */
export function netCashFlow(txs: readonly Transaction[]): Minor {
  return totalIncome(txs) - totalExpenses(txs)
}

/** Transactions whose *local* date (in `tz`) equals `date`. */
export function onLocalDate(txs: readonly Transaction[], date: LocalDate, tz: string): Transaction[] {
  return txs.filter((t) => localDateOf(t.occurredAt, tz) === date)
}

export function groupByLocalDate(txs: readonly Transaction[], tz: string): Map<LocalDate, Transaction[]> {
  const groups = new Map<LocalDate, Transaction[]>()
  for (const t of txs) {
    const d = localDateOf(t.occurredAt, tz)
    const list = groups.get(d)
    if (list) list.push(t)
    else groups.set(d, [t])
  }
  return groups
}

export function expensesByCategory(txs: readonly Transaction[]): Map<string, Minor> {
  const map = new Map<string, Minor>()
  for (const t of txs) {
    if (!isExpense(t) || !t.categoryId) continue
    map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amount)
  }
  return map
}

/** Signed effect of a transaction on its own account's balance. */
export function balanceEffect(t: Transaction): Minor {
  if (t.type === "income") return t.amount
  if (t.type === "expense") return -t.amount
  return t.transferDirection === "in" ? t.amount : -t.amount
}
