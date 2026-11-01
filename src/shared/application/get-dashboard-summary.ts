import {
  addDays,
  endOfMonth,
  instantRange,
  startOfMonth,
  todayIn,
  type LocalDate,
} from "@/shared/domain/dates"
import type { Minor } from "@/shared/domain/money"
import type { AccountRepository } from "@/features/accounts/domain/repositories/account-repository"
import { totalBalance } from "@/features/accounts/domain/services/balance"
import type { BudgetRepository } from "@/features/budgets/domain/repositories/budget-repository"
import { summarizeDay, type DailySummary } from "@/features/budgets/domain/services/budget-calculator"
import type { Transaction } from "@/features/transactions/domain/entities/transaction"
import type { TransactionRepository } from "@/features/transactions/domain/repositories/transaction-repository"
import {
  expensesByCategory,
  netCashFlow,
  onLocalDate,
  totalExpenses,
  totalIncome,
} from "@/features/transactions/domain/services/transaction-calculator"

export interface DashboardSummary {
  today: LocalDate
  balance: Minor
  monthIncome: Minor
  monthExpenses: Minor
  monthNet: Minor
  daily: DailySummary
  hasPlan: boolean
  todayCategorySpend: { categoryId: string; amount: Minor }[]
  recent: Transaction[]
  /** Last 7 local days, oldest first. */
  weekTrend: { date: LocalDate; spent: Minor }[]
}

export interface DashboardDeps {
  transactions: TransactionRepository
  accounts: AccountRepository
  budgets: BudgetRepository
}

/** Cross-feature orchestration: composes domain calculators only; holds no rules of its own. */
export class GetDashboardSummary {
  constructor(private readonly deps: DashboardDeps) {}

  async execute(timezone: string, warnAtPercent: number, now: Date = new Date()): Promise<DashboardSummary> {
    const today = todayIn(timezone, now)
    const monthStart = startOfMonth(today)
    const { end } = instantRange(monthStart, endOfMonth(today), timezone)
    const [accounts, txs, budget] = await Promise.all([
      this.deps.accounts.list(),
      this.deps.transactions.list(),
      this.deps.budgets.getByDate(today),
    ])
    const active = accounts.filter((a) => !a.isArchived)
    const month = txs.filter((t) => {
      const ts = Date.parse(t.occurredAt)
      return ts >= instantRange(monthStart, monthStart, timezone).start.getTime() && ts < end.getTime()
    })
    const todayTxs = onLocalDate(txs, today, timezone)
    return {
      today,
      balance: totalBalance(active, txs),
      monthIncome: totalIncome(month),
      monthExpenses: totalExpenses(month),
      monthNet: netCashFlow(month),
      daily: summarizeDay(budget, todayTxs, warnAtPercent),
      hasPlan: budget !== null,
      todayCategorySpend: [...expensesByCategory(todayTxs).entries()]
        .map(([categoryId, amount]) => ({ categoryId, amount }))
        .sort((a, b) => b.amount - a.amount),
      recent: txs.slice(0, 6),
      weekTrend: Array.from({ length: 7 }, (_, i) => addDays(today, i - 6)).map((date) => ({
        date,
        spent: totalExpenses(onLocalDate(txs, date, timezone)),
      })),
    }
  }
}
