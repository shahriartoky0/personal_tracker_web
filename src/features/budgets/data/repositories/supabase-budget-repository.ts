import type { LocalDate } from "@/shared/domain/dates"
import type {
  BudgetTemplate,
  NewPlannedExpense,
  PlanInput,
  PlannedExpenseStatus,
} from "../../domain/entities/budget"
import type { BudgetRepository } from "../../domain/repositories/budget-repository"
import type { BudgetDatasource } from "../datasources/budget-datasource"
import { toDailyBudget, toPlannedExpense, toTemplate } from "../mappers/budget-mapper"

export class SupabaseBudgetRepository implements BudgetRepository {
  constructor(
    private readonly ds: BudgetDatasource,
    private readonly userId: string,
  ) {}

  async getByDate(date: LocalDate) {
    const row = await this.ds.getByDate(date)
    return row ? toDailyBudget(row) : null
  }

  async listByRange(from: LocalDate, to: LocalDate) {
    return (await this.ds.listByRange(from, to)).map(toDailyBudget)
  }

  async save(plan: PlanInput) {
    const existing = await this.ds.getByDate(plan.date)
    let budgetId: string
    const previous = new Map<string, { id: string; original: number }>()

    if (existing) {
      budgetId = existing.id
      // original_limit is deliberately not touched: it preserves the first plan for variance reporting.
      await this.ds.updateBudget(budgetId, { total_limit: plan.totalLimit, notes: plan.notes ?? null })
      for (const a of existing.budget_allocations ?? [])
        previous.set(a.category_id, { id: a.id, original: Number(a.original_amount) })
    } else {
      budgetId = (
        await this.ds.insertBudget({
          user_id: this.userId,
          budget_date: plan.date,
          total_limit: plan.totalLimit,
          original_limit: plan.totalLimit,
          notes: plan.notes ?? null,
        })
      ).id
    }

    const keep = new Set(plan.allocations.map((a) => a.categoryId))
    await this.ds.deleteAllocations([...previous].filter(([cat]) => !keep.has(cat)).map(([, v]) => v.id))
    await this.ds.upsertAllocations(
      plan.allocations.map((a) => ({
        user_id: this.userId,
        daily_budget_id: budgetId,
        category_id: a.categoryId,
        planned_amount: a.amount,
        original_amount: previous.get(a.categoryId)?.original ?? a.amount,
      })),
    )

    const saved = await this.ds.getByDate(plan.date)
    return toDailyBudget(saved!)
  }

  async setClosed(date: LocalDate, closed: boolean) {
    const existing = await this.ds.getByDate(date)
    if (!existing) return null
    await this.ds.updateClosed(date, closed)
    return toDailyBudget({ ...existing, is_closed: closed })
  }

  async getTemplate() {
    const row = await this.ds.getTemplate()
    return row ? toTemplate(row) : null
  }

  saveTemplate(t: BudgetTemplate) {
    return this.ds.upsertTemplate({ user_id: this.userId, total_limit: t.totalLimit, allocations: t.allocations })
  }

  async listPlannedExpenses(from: LocalDate, to: LocalDate) {
    return (await this.ds.listPlanned(from, to)).map(toPlannedExpense)
  }

  async addPlannedExpense(input: NewPlannedExpense) {
    return toPlannedExpense(
      await this.ds.insertPlanned({
        user_id: this.userId,
        planned_date: input.date,
        category_id: input.categoryId,
        title: input.title,
        expected_amount: input.expectedAmount,
      }),
    )
  }

  setPlannedExpenseStatus(id: string, status: PlannedExpenseStatus) {
    return this.ds.updatePlannedStatus(id, status)
  }

  deletePlannedExpense(id: string) {
    return this.ds.deletePlanned(id)
  }

  deleteAll() {
    return this.ds.deleteEverything(this.userId)
  }
}
