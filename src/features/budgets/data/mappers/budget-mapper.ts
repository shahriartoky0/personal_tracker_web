import type { BudgetTemplate, DailyBudget, PlannedExpense } from "../../domain/entities/budget"
import type { DailyBudgetRow, PlannedExpenseRow, TemplateRow } from "../dto/budget-dto"

export function toDailyBudget(row: DailyBudgetRow): DailyBudget {
  return {
    id: row.id,
    date: row.budget_date,
    totalLimit: Number(row.total_limit),
    originalLimit: Number(row.original_limit),
    notes: row.notes,
    isClosed: row.is_closed,
    allocations: (row.budget_allocations ?? []).map((a) => ({
      categoryId: a.category_id,
      plannedAmount: Number(a.planned_amount),
      originalAmount: Number(a.original_amount),
    })),
  }
}

export function toTemplate(row: TemplateRow): BudgetTemplate {
  return {
    totalLimit: Number(row.total_limit),
    allocations: (Array.isArray(row.allocations) ? row.allocations : [])
      .filter((a) => typeof a?.categoryId === "string" && Number.isSafeInteger(a.amount))
      .map((a) => ({ categoryId: a.categoryId, amount: a.amount })),
  }
}

export function toPlannedExpense(row: PlannedExpenseRow): PlannedExpense {
  return {
    id: row.id,
    date: row.planned_date,
    categoryId: row.category_id,
    title: row.title,
    expectedAmount: Number(row.expected_amount),
    status: row.status === "completed" ? "completed" : row.status === "skipped" ? "skipped" : "planned",
  }
}
