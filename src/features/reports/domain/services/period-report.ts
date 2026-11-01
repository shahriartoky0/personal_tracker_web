import { percentChange, percentOf, sumMinor, type Minor } from "@/shared/domain/money"
import {
  diffDays,
  eachDay,
  instantRange,
  localDateOf,
  previousRange,
  startOfWeek,
  type DateRange,
  type LocalDate,
} from "@/shared/domain/dates"
import type { Account } from "@/features/accounts/domain/entities/account"
import { totalBalance } from "@/features/accounts/domain/services/balance"
import type { Transaction, PlannedStatus } from "@/features/transactions/domain/entities/transaction"
import {
  isExpense,
  isIncome,
  isTransfer,
  netCashFlow,
  totalExpenses,
  totalIncome,
  totalPlannedExpenses,
  totalUnplanned,
} from "@/features/transactions/domain/services/transaction-calculator"
import type { DailyBudget } from "@/features/budgets/domain/entities/budget"
import { plannedVsActual, type VarianceRow } from "@/features/budgets/domain/services/budget-calculator"

export interface ReportFilter {
  categoryId?: string
  accountId?: string
  plannedStatus?: PlannedStatus
}

export interface CategoryShare {
  categoryId: string
  amount: Minor
  percent: number
}

export interface TrendBucket {
  /** First local date of the bucket. */
  start: LocalDate
  end: LocalDate
  spent: Minor
  income: Minor
}

export interface PeriodTotals {
  income: Minor
  expenses: Minor
  net: Minor
}

export interface PeriodReport {
  range: DateRange
  openingBalance: Minor
  closingBalance: Minor
  income: Minor
  expenses: Minor
  net: Minor
  /** Money moved between own accounts — shown for transparency, excluded from every figure above. */
  transfersExcluded: Minor
  plannedSpent: Minor
  unplannedSpent: Minor
  unplannedCount: number
  byCategory: CategoryShare[]
  trend: TrendBucket[]
  trendGranularity: "day" | "week"
  byPaymentMethod: { accountId: string; amount: Minor; percent: number }[]
  topMerchants: { name: string; amount: Minor; count: number }[]
  plannedVsActual: VarianceRow[]
  previous: PeriodTotals & { range: DateRange }
  change: { expenses: { amount: Minor; percent: number | null }; income: { amount: Minor; percent: number | null } }
}

export interface PeriodReportInput {
  range: DateRange
  timezone: string
  /** Accounts in scope (all active+archived, or the single filtered one). */
  accounts: readonly Account[]
  /** All transactions of the in-scope accounts up to the end of `range` (needed for opening balance). */
  transactions: readonly Transaction[]
  /** Transactions of the previous equal-length period (same account scope). */
  previousTransactions: readonly Transaction[]
  budgets: readonly DailyBudget[]
  filter?: ReportFilter
}

function passes(t: Transaction, f: ReportFilter): boolean {
  if (f.categoryId && t.categoryId !== f.categoryId) return false
  if (f.plannedStatus && !(isExpense(t) && t.plannedStatus === f.plannedStatus)) return false
  return true
}

function inRange(txs: readonly Transaction[], range: DateRange, tz: string): Transaction[] {
  const { start, end } = instantRange(range.from, range.to, tz)
  return txs.filter((t) => {
    const ts = Date.parse(t.occurredAt)
    return ts >= start.getTime() && ts < end.getTime()
  })
}

function totals(txs: readonly Transaction[]): PeriodTotals {
  return { income: totalIncome(txs), expenses: totalExpenses(txs), net: netCashFlow(txs) }
}

function share(map: Map<string, Minor>): { key: string; amount: Minor; percent: number }[] {
  const total = sumMinor([...map.values()])
  return [...map.entries()]
    .map(([key, amount]) => ({ key, amount, percent: percentOf(amount, total) ?? 0 }))
    .sort((a, b) => b.amount - a.amount)
}

export const MAX_DAILY_BUCKETS = 45

function buildTrend(txs: readonly Transaction[], range: DateRange, tz: string) {
  const days = diffDays(range.from, range.to) + 1
  const granularity: "day" | "week" = days > MAX_DAILY_BUCKETS ? "week" : "day"
  const keyOf = (d: LocalDate) => (granularity === "day" ? d : startOfWeek(d))
  const buckets = new Map<LocalDate, TrendBucket>()
  for (const d of eachDay(range.from, range.to)) {
    const k = keyOf(d)
    const b = buckets.get(k)
    if (b) b.end = d
    else buckets.set(k, { start: d, end: d, spent: 0, income: 0 })
  }
  for (const t of txs) {
    const d = localDateOf(t.occurredAt, tz)
    const b = buckets.get(keyOf(d))
    if (!b) continue
    if (isExpense(t)) b.spent += t.amount
    else if (isIncome(t)) b.income += t.amount
  }
  return { trend: [...buckets.values()], granularity }
}

/** Pure, authoritative period calculation reused by the Reports screen, dashboard and tests. */
export function buildPeriodReport(input: PeriodReportInput): PeriodReport {
  const { range, timezone: tz, accounts, transactions, budgets, filter = {} } = input
  const { start, end } = instantRange(range.from, range.to, tz)

  const inPeriodAll = inRange(transactions, range, tz)
  const flow = inPeriodAll.filter((t) => passes(t, filter))
  const prevRange = previousRange(range)
  const prevFlow = inRange(input.previousTransactions, prevRange, tz).filter((t) => passes(t, filter))

  const expenses = totalExpenses(flow)
  const income = totalIncome(flow)
  const prev = totals(prevFlow)

  const byCategory = share(
    flow.filter(isExpense).reduce((m, t) => m.set(t.categoryId!, (m.get(t.categoryId!) ?? 0) + t.amount), new Map<string, Minor>()),
  ).map((s) => ({ categoryId: s.key, amount: s.amount, percent: s.percent }))

  const byPaymentMethod = share(
    flow.filter(isExpense).reduce((m, t) => m.set(t.accountId, (m.get(t.accountId) ?? 0) + t.amount), new Map<string, Minor>()),
  ).map((s) => ({ accountId: s.key, amount: s.amount, percent: s.percent }))

  const merchants = new Map<string, { name: string; amount: Minor; count: number }>()
  // Oldest first so the display name is the first spelling the user typed.
  for (const t of [...flow].reverse().filter(isExpense)) {
    const name = (t.merchant ?? "").trim() || (t.note ?? "").trim()
    if (!name) continue
    const key = name.toLowerCase()
    const cur = merchants.get(key) ?? { name, amount: 0, count: 0 }
    cur.amount += t.amount
    cur.count += 1
    merchants.set(key, cur)
  }
  const topMerchants = [...merchants.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const { trend, granularity } = buildTrend(flow, range, tz)
  const opening = totalBalance(accounts, transactions, start)
  // Closing balance is built from the period's unfiltered flow so category filters never distort it.
  const closing = totalBalance(accounts, transactions, end)

  return {
    range,
    openingBalance: opening,
    closingBalance: closing,
    income,
    expenses,
    net: income - expenses,
    transfersExcluded: sumMinor(inPeriodAll.filter((t) => isTransfer(t) && t.transferDirection === "out").map((t) => t.amount)),
    plannedSpent: totalPlannedExpenses(flow),
    unplannedSpent: totalUnplanned(flow),
    unplannedCount: flow.filter((t) => isExpense(t) && t.plannedStatus === "unplanned").length,
    byCategory,
    trend,
    trendGranularity: granularity,
    byPaymentMethod,
    topMerchants,
    plannedVsActual: plannedVsActual(budgets, flow.filter(isExpense)),
    previous: { range: prevRange, ...prev },
    change: {
      expenses: { amount: expenses - prev.expenses, percent: percentChange(expenses, prev.expenses) },
      income: { amount: income - prev.income, percent: percentChange(income, prev.income) },
    },
  }
}

