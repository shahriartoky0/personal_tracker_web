import type { Minor } from "@/shared/domain/money"
import type { LocalDate } from "@/shared/domain/dates"

export interface BudgetAllocation {
  categoryId: string
  /** Current plan amount. */
  plannedAmount: Minor
  /** Amount when first planned — preserved for variance reporting. */
  originalAmount: Minor
}

export interface DailyBudget {
  id: string
  date: LocalDate
  totalLimit: Minor
  originalLimit: Minor
  notes: string | null
  isClosed: boolean
  allocations: BudgetAllocation[]
}

export interface PlanInput {
  date: LocalDate
  totalLimit: Minor
  notes?: string | null
  allocations: { categoryId: string; amount: Minor }[]
}

export interface BudgetTemplate {
  totalLimit: Minor
  allocations: { categoryId: string; amount: Minor }[]
}

export type PlannedExpenseStatus = "planned" | "completed" | "skipped"

export interface PlannedExpense {
  id: string
  date: LocalDate
  categoryId: string
  title: string
  expectedAmount: Minor
  status: PlannedExpenseStatus
}

export interface NewPlannedExpense {
  date: LocalDate
  categoryId: string
  title: string
  expectedAmount: Minor
}
