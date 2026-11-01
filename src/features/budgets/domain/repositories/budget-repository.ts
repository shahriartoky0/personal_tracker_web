import type { LocalDate } from "@/shared/domain/dates"
import type {
  BudgetTemplate,
  DailyBudget,
  NewPlannedExpense,
  PlanInput,
  PlannedExpense,
  PlannedExpenseStatus,
} from "../entities/budget"

export interface BudgetRepository {
  getByDate(date: LocalDate): Promise<DailyBudget | null>
  listByRange(from: LocalDate, to: LocalDate): Promise<DailyBudget[]>
  /**
   * Upserts the plan for a date. On first save original* values are set to the given
   * amounts; on later saves only the current values change and originals are retained
   * (a category added later gets its own original).
   */
  save(plan: PlanInput): Promise<DailyBudget>
  setClosed(date: LocalDate, closed: boolean): Promise<DailyBudget | null>
  getTemplate(): Promise<BudgetTemplate | null>
  saveTemplate(template: BudgetTemplate): Promise<void>

  listPlannedExpenses(from: LocalDate, to: LocalDate): Promise<PlannedExpense[]>
  addPlannedExpense(input: NewPlannedExpense): Promise<PlannedExpense>
  setPlannedExpenseStatus(id: string, status: PlannedExpenseStatus): Promise<void>
  deletePlannedExpense(id: string): Promise<void>
  deleteAll(): Promise<void>
}
