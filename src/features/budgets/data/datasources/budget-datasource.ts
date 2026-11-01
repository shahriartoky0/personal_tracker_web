import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { unwrap, unwrapVoid } from "@/shared/infrastructure/supabase/errors"
import type { AllocationRow, DailyBudgetRow, PlannedExpenseRow, TemplateRow } from "../dto/budget-dto"

const WITH_ALLOCATIONS = "*, budget_allocations(*)"

export class BudgetDatasource {
  constructor(private readonly db: SupabaseServerClient) {}

  async getByDate(date: string) {
    return unwrap(
      await this.db.from("daily_budgets").select(WITH_ALLOCATIONS).eq("budget_date", date).maybeSingle(),
    ) as DailyBudgetRow | null
  }

  async listByRange(from: string, to: string) {
    return unwrap(
      await this.db
        .from("daily_budgets")
        .select(WITH_ALLOCATIONS)
        .gte("budget_date", from)
        .lte("budget_date", to)
        .order("budget_date"),
    ) as DailyBudgetRow[]
  }

  async insertBudget(row: Record<string, unknown>) {
    return unwrap(await this.db.from("daily_budgets").insert(row).select("id").single()) as { id: string }
  }

  async updateBudget(id: string, patch: Record<string, unknown>) {
    unwrapVoid(await this.db.from("daily_budgets").update(patch).eq("id", id))
  }

  async updateClosed(date: string, closed: boolean) {
    unwrapVoid(
      await this.db
        .from("daily_budgets")
        .update({ is_closed: closed, closed_at: closed ? new Date().toISOString() : null })
        .eq("budget_date", date),
    )
  }

  async listAllocations(budgetId: string) {
    return unwrap(await this.db.from("budget_allocations").select("*").eq("daily_budget_id", budgetId)) as AllocationRow[]
  }

  async deleteAllocations(ids: string[]) {
    if (ids.length) unwrapVoid(await this.db.from("budget_allocations").delete().in("id", ids))
  }

  async upsertAllocations(rows: Record<string, unknown>[]) {
    if (rows.length) unwrapVoid(await this.db.from("budget_allocations").upsert(rows, { onConflict: "daily_budget_id,category_id" }))
  }

  async getTemplate() {
    return unwrap(await this.db.from("budget_templates").select("total_limit, allocations").maybeSingle()) as TemplateRow | null
  }

  async upsertTemplate(row: Record<string, unknown>) {
    unwrapVoid(await this.db.from("budget_templates").upsert(row, { onConflict: "user_id" }))
  }

  async listPlanned(from: string, to: string) {
    return unwrap(
      await this.db.from("planned_expenses").select("*").gte("planned_date", from).lte("planned_date", to).order("created_at"),
    ) as PlannedExpenseRow[]
  }

  async insertPlanned(row: Record<string, unknown>) {
    return unwrap(await this.db.from("planned_expenses").insert(row).select("*").single()) as PlannedExpenseRow
  }

  async updatePlannedStatus(id: string, status: string) {
    unwrapVoid(await this.db.from("planned_expenses").update({ status }).eq("id", id))
  }

  async deletePlanned(id: string) {
    unwrapVoid(await this.db.from("planned_expenses").delete().eq("id", id))
  }

  async deleteEverything(userId: string) {
    unwrapVoid(await this.db.from("planned_expenses").delete().eq("user_id", userId))
    unwrapVoid(await this.db.from("daily_budgets").delete().eq("user_id", userId)) // allocations cascade
  }
}
