import { instantRange, isValidLocalDate, previousRange, type DateRange } from "@/shared/domain/dates"
import { ok, validation, type Result } from "@/shared/domain/result"
import type { AccountRepository } from "@/features/accounts/domain/repositories/account-repository"
import type { BudgetRepository } from "@/features/budgets/domain/repositories/budget-repository"
import type { TransactionRepository } from "@/features/transactions/domain/repositories/transaction-repository"
import { buildPeriodReport, type PeriodReport, type ReportFilter } from "../services/period-report"

export interface PeriodReportDeps {
  transactions: TransactionRepository
  accounts: AccountRepository
  budgets: BudgetRepository
}

export const MAX_REPORT_DAYS = 366 * 2

export class GetPeriodReport {
  constructor(private readonly deps: PeriodReportDeps) {}

  async execute(range: DateRange, timezone: string, filter: ReportFilter = {}): Promise<Result<PeriodReport>> {
    if (!isValidLocalDate(range.from) || !isValidLocalDate(range.to) || range.from > range.to)
      return validation("Enter a valid date range.", { range: "Invalid range." })
    const prev = previousRange(range)
    const { end } = instantRange(range.from, range.to, timezone)

    const [accounts, txs, budgets] = await Promise.all([
      this.deps.accounts.list(),
      // Everything up to the period end: required to derive opening/closing balances.
      this.deps.transactions.list({ to: end.toISOString(), accountId: filter.accountId }),
      this.deps.budgets.listByRange(range.from, range.to),
    ])
    const scoped = filter.accountId ? accounts.filter((a) => a.id === filter.accountId) : accounts

    const prevWindow = instantRange(prev.from, prev.to, timezone)
    const previousTransactions = txs.filter((t) => {
      const ts = Date.parse(t.occurredAt)
      return ts >= prevWindow.start.getTime() && ts < prevWindow.end.getTime()
    })

    return ok(
      buildPeriodReport({
        range,
        timezone,
        accounts: scoped,
        transactions: txs,
        previousTransactions,
        budgets,
        filter,
      }),
    )
  }
}
