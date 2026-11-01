import type { Account, NewAccount } from "@/features/accounts/domain/entities/account"
import type { AccountRepository } from "@/features/accounts/domain/repositories/account-repository"
import type { Category, NewCategory } from "@/features/categories/domain/entities/category"
import type { CategoryRepository } from "@/features/categories/domain/repositories/category-repository"
import type {
  NewTransaction,
  NewTransfer,
  Transaction,
  TransactionFilter,
  TransactionPatch,
} from "@/features/transactions/domain/entities/transaction"
import type { TransactionRepository } from "@/features/transactions/domain/repositories/transaction-repository"
import type {
  BudgetTemplate,
  DailyBudget,
  NewPlannedExpense,
  PlanInput,
  PlannedExpense,
  PlannedExpenseStatus,
} from "@/features/budgets/domain/entities/budget"
import type { BudgetRepository } from "@/features/budgets/domain/repositories/budget-repository"
import type { LocalDate } from "@/shared/domain/dates"

let seq = 0
const id = (p: string) => `${p}-${++seq}`

export class InMemoryAccounts implements AccountRepository {
  items: Account[] = []
  async list() {
    return [...this.items]
  }
  async getById(i: string) {
    return this.items.find((a) => a.id === i) ?? null
  }
  async create(input: NewAccount) {
    const a: Account = { id: id("acc"), isArchived: false, ...input }
    this.items.push(a)
    return a
  }
  async update(i: string, patch: Partial<NewAccount> & { isArchived?: boolean }) {
    const a = this.items.find((x) => x.id === i)
    if (!a) return null
    Object.assign(a, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
    return a
  }
}

export class InMemoryCategories implements CategoryRepository {
  items: Category[] = []
  async list() {
    return [...this.items]
  }
  async getById(i: string) {
    return this.items.find((c) => c.id === i) ?? null
  }
  async create(input: NewCategory) {
    const c: Category = { id: id("cat"), icon: null, color: null, isDefault: false, isArchived: false, ...input }
    this.items.push(c)
    return c
  }
  async update(i: string, patch: Partial<NewCategory> & { isArchived?: boolean }) {
    const c = this.items.find((x) => x.id === i)
    if (!c) return null
    Object.assign(c, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
    return c
  }
}

export class InMemoryTransactions implements TransactionRepository {
  items: Transaction[] = []
  async list(f: TransactionFilter = {}) {
    return this.items
      .filter((t) => {
        const ts = Date.parse(t.occurredAt)
        if (f.from && ts < Date.parse(f.from)) return false
        if (f.to && ts >= Date.parse(f.to)) return false
        if (f.categoryId && t.categoryId !== f.categoryId) return false
        if (f.accountId && t.accountId !== f.accountId) return false
        if (f.plannedStatus && t.plannedStatus !== f.plannedStatus) return false
        if (f.type && t.type !== f.type) return false
        if (f.search) {
          const hay = `${t.merchant ?? ""} ${t.note ?? ""}`.toLowerCase()
          if (!hay.includes(f.search.toLowerCase())) return false
        }
        return true
      })
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
  }
  async getById(i: string) {
    return this.items.find((t) => t.id === i) ?? null
  }
  async create(input: NewTransaction) {
    const t: Transaction = {
      id: id("tx"),
      transferDirection: null,
      transferGroupId: null,
      merchant: null,
      note: null,
      plannedStatus: "unplanned",
      receiptPath: null,
      ...input,
    }
    this.items.push(t)
    return t
  }
  async createTransfer(input: NewTransfer) {
    const g = id("grp")
    const base = { categoryId: null, type: "transfer" as const, transferGroupId: g, merchant: null, plannedStatus: "unplanned" as const, receiptPath: null }
    this.items.push(
      { id: id("tx"), accountId: input.fromAccountId, transferDirection: "out", amount: input.amount, occurredAt: input.occurredAt, note: input.note ?? null, ...base },
      { id: id("tx"), accountId: input.toAccountId, transferDirection: "in", amount: input.amount, occurredAt: input.occurredAt, note: input.note ?? null, ...base },
    )
    return g
  }
  async update(i: string, patch: TransactionPatch) {
    const t = this.items.find((x) => x.id === i)
    if (!t) return null
    Object.assign(t, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)))
    return t
  }
  async delete(i: string) {
    const t = this.items.find((x) => x.id === i)
    if (!t) return false
    this.items = this.items.filter((x) => (t.transferGroupId ? x.transferGroupId !== t.transferGroupId : x.id !== i))
    return true
  }
  async deleteAll() {
    this.items = []
  }
}

export class InMemoryBudgets implements BudgetRepository {
  items: DailyBudget[] = []
  template: BudgetTemplate | null = null
  planned: PlannedExpense[] = []
  async getByDate(d: LocalDate) {
    return this.items.find((b) => b.date === d) ?? null
  }
  async listByRange(from: LocalDate, to: LocalDate) {
    return this.items.filter((b) => b.date >= from && b.date <= to)
  }
  async save(plan: PlanInput) {
    const existing = this.items.find((b) => b.date === plan.date)
    const prevAlloc = new Map(existing?.allocations.map((a) => [a.categoryId, a.originalAmount]))
    const budget: DailyBudget = {
      id: existing?.id ?? id("bud"),
      date: plan.date,
      totalLimit: plan.totalLimit,
      originalLimit: existing?.originalLimit ?? plan.totalLimit,
      notes: plan.notes ?? null,
      isClosed: existing?.isClosed ?? false,
      allocations: plan.allocations.map((a) => ({
        categoryId: a.categoryId,
        plannedAmount: a.amount,
        originalAmount: prevAlloc.get(a.categoryId) ?? a.amount,
      })),
    }
    this.items = [...this.items.filter((b) => b.date !== plan.date), budget]
    return budget
  }
  async setClosed(d: LocalDate, closed: boolean) {
    const b = await this.getByDate(d)
    if (!b) return null
    b.isClosed = closed
    return b
  }
  async getTemplate() {
    return this.template
  }
  async saveTemplate(t: BudgetTemplate) {
    this.template = t
  }
  async listPlannedExpenses(from: LocalDate, to: LocalDate) {
    return this.planned.filter((p) => p.date >= from && p.date <= to)
  }
  async addPlannedExpense(input: NewPlannedExpense) {
    const p: PlannedExpense = { id: id("pe"), status: "planned", ...input }
    this.planned.push(p)
    return p
  }
  async setPlannedExpenseStatus(i: string, status: PlannedExpenseStatus) {
    const p = this.planned.find((x) => x.id === i)
    if (p) p.status = status
  }
  async deletePlannedExpense(i: string) {
    this.planned = this.planned.filter((p) => p.id !== i)
  }
  async deleteAll() {
    this.items = []
    this.planned = []
  }
}

export function seedWorld() {
  const accounts = new InMemoryAccounts()
  const categories = new InMemoryCategories()
  const transactions = new InMemoryTransactions()
  const budgets = new InMemoryBudgets()
  const cash: Account = { id: "cash", name: "Cash", type: "cash", openingBalance: 100_000, isArchived: false }
  const bank: Account = { id: "bank", name: "Bank", type: "bank", openingBalance: 500_000, isArchived: false }
  accounts.items.push(cash, bank)
  const mk = (cid: string, name: string, type: "income" | "expense"): Category => ({
    id: cid, name, type, icon: null, color: null, isDefault: true, isArchived: false,
  })
  categories.items.push(mk("food", "Food", "expense"), mk("transport", "Transport", "expense"), mk("salary", "Salary", "income"))
  return { accounts, categories, transactions, budgets, cash, bank }
}
