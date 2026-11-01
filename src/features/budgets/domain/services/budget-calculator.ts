import { percentOf, sumMinor, type Minor } from "@/shared/domain/money"
import type { Transaction } from "@/features/transactions/domain/entities/transaction"
import {
  expensesByCategory,
  totalExpenses,
  totalPlannedExpenses,
  totalUnplanned,
} from "@/features/transactions/domain/services/transaction-calculator"
import type { DailyBudget } from "../entities/budget"

export type BudgetStatus = "none" | "ok" | "approaching" | "over"

export interface CategoryProgress {
  categoryId: string
  allocated: Minor
  originalAllocated: Minor
  spent: Minor
  /** allocated − spent; negative when over. */
  remaining: Minor
}

export interface DailySummary {
  /** null for "no budget today" days. */
  limit: Minor | null
  originalLimit: Minor | null
  spent: Minor
  plannedSpent: Minor
  unplannedSpent: Minor
  /** limit − spent; may be negative. null when there is no limit. */
  remaining: Minor | null
  /** Integer percentage of the limit used; null when there is no limit. */
  percentUsed: number | null
  status: BudgetStatus
  categories: CategoryProgress[]
  allocatedTotal: Minor
}

export const DEFAULT_WARN_THRESHOLD = 90

export function budgetStatus(spent: Minor, limit: Minor | null, warnAtPercent = DEFAULT_WARN_THRESHOLD): BudgetStatus {
  if (limit === null) return "none"
  if (spent > limit) return "over"
  if (limit === 0) return spent === 0 ? "ok" : "over"
  // spent * 100 >= warn * limit — integer comparison, no rounding surprises.
  return spent * 100 >= warnAtPercent * limit ? "approaching" : "ok"
}

/**
 * The single authoritative daily calculation. `dayTransactions` must already be the
 * transactions belonging to the budget's local date (see `onLocalDate`).
 */
export function summarizeDay(
  budget: DailyBudget | null,
  dayTransactions: readonly Transaction[],
  warnAtPercent = DEFAULT_WARN_THRESHOLD,
): DailySummary {
  const spent = totalExpenses(dayTransactions)
  const limit = budget ? budget.totalLimit : null
  const byCat = expensesByCategory(dayTransactions)

  const categories: CategoryProgress[] = (budget?.allocations ?? []).map((a) => {
    const catSpent = byCat.get(a.categoryId) ?? 0
    return {
      categoryId: a.categoryId,
      allocated: a.plannedAmount,
      originalAllocated: a.originalAmount,
      spent: catSpent,
      remaining: a.plannedAmount - catSpent,
    }
  })

  return {
    limit,
    originalLimit: budget ? budget.originalLimit : null,
    spent,
    plannedSpent: totalPlannedExpenses(dayTransactions),
    unplannedSpent: totalUnplanned(dayTransactions),
    remaining: limit === null ? null : limit - spent,
    percentUsed: limit === null ? null : percentOf(spent, limit),
    status: budgetStatus(spent, limit, warnAtPercent),
    categories,
    allocatedTotal: sumMinor(categories.map((c) => c.allocated)),
  }
}

/** Allocations may not exceed the daily limit. */
export function validateAllocations(totalLimit: Minor, allocations: readonly { amount: Minor }[]): string | null {
  const allocated = sumMinor(allocations.map((a) => a.amount))
  return allocated > totalLimit ? "Category allocations exceed the daily limit." : null
}

export interface VarianceRow {
  categoryId: string
  planned: Minor
  original: Minor
  actual: Minor
  /** actual − planned; positive means overspent. */
  variance: Minor
}

/** Planned (current + original) vs actual per category across any number of budget days. */
export function plannedVsActual(budgets: readonly DailyBudget[], expenses: readonly Transaction[]): VarianceRow[] {
  const planned = new Map<string, { current: Minor; original: Minor }>()
  for (const b of budgets) {
    for (const a of b.allocations) {
      const cur = planned.get(a.categoryId) ?? { current: 0, original: 0 }
      cur.current += a.plannedAmount
      cur.original += a.originalAmount
      planned.set(a.categoryId, cur)
    }
  }
  const actual = expensesByCategory(expenses)
  const ids = new Set([...planned.keys(), ...actual.keys()])
  return [...ids]
    .map((categoryId) => {
      const p = planned.get(categoryId) ?? { current: 0, original: 0 }
      const a = actual.get(categoryId) ?? 0
      return { categoryId, planned: p.current, original: p.original, actual: a, variance: a - p.current }
    })
    .sort((x, y) => y.actual - x.actual)
}
