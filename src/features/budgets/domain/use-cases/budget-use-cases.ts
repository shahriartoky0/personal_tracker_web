import { isValidLocalDate, addDays, type LocalDate } from "@/shared/domain/dates"
import { isValidMinor } from "@/shared/domain/money"
import { fail, ok, validation, type Result } from "@/shared/domain/result"
import type { CategoryRepository } from "@/features/categories/domain/repositories/category-repository"
import type {
  BudgetTemplate,
  DailyBudget,
  NewPlannedExpense,
  PlanInput,
  PlannedExpense,
  PlannedExpenseStatus,
} from "../entities/budget"
import type { BudgetRepository } from "../repositories/budget-repository"
import { validateAllocations } from "../services/budget-calculator"

export class CreateDailyBudget {
  constructor(
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryRepository,
  ) {}

  /** Creates or edits the plan for a day. Editing never overwrites the original amounts. */
  async execute(input: PlanInput): Promise<Result<DailyBudget>> {
    const errors: Record<string, string> = {}
    if (!isValidLocalDate(input.date)) errors.date = "Enter a valid date."
    if (!isValidMinor(input.totalLimit) || input.totalLimit < 0) errors.totalLimit = "Enter a valid daily limit."
    const seen = new Set<string>()
    for (const a of input.allocations) {
      if (!isValidMinor(a.amount) || a.amount < 0) errors.allocations = "Allocation amounts must be zero or more."
      if (seen.has(a.categoryId)) errors.allocations = "A category appears twice."
      seen.add(a.categoryId)
    }
    if (!errors.totalLimit && !errors.allocations) {
      const over = validateAllocations(input.totalLimit, input.allocations)
      if (over) errors.allocations = over
    }
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)

    const categories = await this.categories.list()
    const valid = new Map(categories.filter((c) => c.type === "expense" && !c.isArchived).map((c) => [c.id, c]))
    if (input.allocations.some((a) => !valid.has(a.categoryId)))
      return validation("Choose active expense categories.", { allocations: "Unknown category." })

    const cleaned = input.allocations.filter((a) => a.amount > 0)
    return ok(await this.budgets.save({ ...input, allocations: cleaned, notes: input.notes?.trim() || null }))
  }
}

export class GetDailyBudget {
  constructor(private readonly budgets: BudgetRepository) {}
  execute(date: LocalDate) {
    return this.budgets.getByDate(date)
  }
}

/** Returns the previous day's plan (or the saved template) as a draft; nothing is persisted. */
export class CopyPreviousPlan {
  constructor(private readonly budgets: BudgetRepository) {}
  async execute(date: LocalDate, source: "yesterday" | "template"): Promise<Result<BudgetTemplate>> {
    if (source === "template") {
      const t = await this.budgets.getTemplate()
      return t ? ok(t) : fail("not_found", "You haven't saved a template yet.")
    }
    const prev = await this.budgets.getByDate(addDays(date, -1))
    if (!prev) return fail("not_found", "There is no plan for yesterday.")
    return ok({
      totalLimit: prev.totalLimit,
      allocations: prev.allocations.map((a) => ({ categoryId: a.categoryId, amount: a.plannedAmount })),
    })
  }
}

export class SaveBudgetTemplate {
  constructor(private readonly budgets: BudgetRepository) {}
  async execute(t: BudgetTemplate): Promise<Result<true>> {
    const over = validateAllocations(t.totalLimit, t.allocations)
    if (!isValidMinor(t.totalLimit) || t.totalLimit < 0) return validation("Enter a valid daily limit.")
    if (over) return validation(over, { allocations: over })
    await this.budgets.saveTemplate(t)
    return ok(true)
  }
}

export class CloseDailyBudget {
  constructor(private readonly budgets: BudgetRepository) {}
  async execute(date: LocalDate, closed = true): Promise<Result<DailyBudget>> {
    const b = await this.budgets.setClosed(date, closed)
    return b ? ok(b) : fail("not_found", "Plan the day first, then you can close it.")
  }
}

export class ManagePlannedExpenses {
  constructor(
    private readonly budgets: BudgetRepository,
    private readonly categories: CategoryRepository,
  ) {}
  list(from: LocalDate, to: LocalDate): Promise<PlannedExpense[]> {
    return this.budgets.listPlannedExpenses(from, to)
  }
  async add(input: NewPlannedExpense): Promise<Result<PlannedExpense>> {
    const errors: Record<string, string> = {}
    if (!isValidLocalDate(input.date)) errors.date = "Enter a valid date."
    if (!isValidMinor(input.expectedAmount) || input.expectedAmount <= 0) errors.expectedAmount = "Enter an amount greater than zero."
    const title = input.title.trim()
    if (title.length < 1 || title.length > 120) errors.title = "Title must be 1–120 characters."
    const cat = await this.categories.getById(input.categoryId)
    if (!cat || cat.type !== "expense" || cat.isArchived) errors.categoryId = "Choose an expense category."
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    return ok(await this.budgets.addPlannedExpense({ ...input, title }))
  }
  async setStatus(id: string, status: PlannedExpenseStatus): Promise<Result<true>> {
    await this.budgets.setPlannedExpenseStatus(id, status)
    return ok(true)
  }
  async remove(id: string): Promise<Result<true>> {
    await this.budgets.deletePlannedExpense(id)
    return ok(true)
  }
}

