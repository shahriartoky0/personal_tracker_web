import { addDays, rangeForPreset, todayIn, zonedLocalToInstant, type DateRange } from "@/shared/domain/dates"
import { GetDashboardSummary } from "@/shared/application/get-dashboard-summary"
import { GetPeriodReport } from "@/features/reports/domain/use-cases/get-period-report"
import { CreateDailyBudget } from "@/features/budgets/domain/use-cases/budget-use-cases"
import { CreateExpense, CreateIncome } from "@/features/transactions/domain/use-cases/transaction-use-cases"
import type { Category } from "@/features/categories/domain/entities/category"
import { InMemoryAccounts, InMemoryBudgets, InMemoryCategories, InMemoryTransactions } from "./in-memory-repositories"

export const DEMO_TZ = "Asia/Dhaka"

const CATS: [string, string, string, string, "income" | "expense"][] = [
  ["d-food", "Food", "utensils", "#c2410c", "expense"],
  ["d-groc", "Groceries", "shopping-basket", "#4d7c0f", "expense"],
  ["d-trans", "Transport", "bus", "#0369a1", "expense"],
  ["d-bills", "Bills", "receipt", "#7c3aed", "expense"],
  ["d-ent", "Entertainment", "clapperboard", "#b45309", "expense"],
  ["d-sal", "Salary", "banknote", "#15803d", "income"],
]

/**
 * Sample data for the public /demo route. It lives only in memory, is built with the same
 * use cases as the real app, and is never mixed with a signed-in user's records.
 */
export async function buildDemo(preset: string, now: Date = new Date()) {
  const accountsRepo = new InMemoryAccounts()
  const categoriesRepo = new InMemoryCategories()
  const transactions = new InMemoryTransactions()
  const budgets = new InMemoryBudgets()

  accountsRepo.items.push(
    { id: "d-cash", name: "Cash", type: "cash", openingBalance: 800_000, isArchived: false },
    { id: "d-bkash", name: "bKash", type: "mobile", openingBalance: 1_500_000, isArchived: false },
    { id: "d-bank", name: "City Bank", type: "bank", openingBalance: 4_000_000, isArchived: false },
  )
  const categories: Category[] = CATS.map(([id, name, icon, color, type]) => ({ id, name, icon, color, type, isDefault: true, isArchived: false }))
  categoriesRepo.items.push(...categories)

  const deps = { transactions, accounts: accountsRepo, categories: categoriesRepo }
  const expense = new CreateExpense(deps)
  const income = new CreateIncome(deps)
  const planDay = new CreateDailyBudget(budgets, categoriesRepo)
  const today = todayIn(DEMO_TZ, now)
  const at = (date: string, hhmm: string) => zonedLocalToInstant(`${date}T${hhmm}`, DEMO_TZ)!.toISOString()

  const merchants = [
    ["d-food", "Lunch at Star Kabab", 28_000],
    ["d-food", "Tea & snacks", 6_000],
    ["d-groc", "Shwapno groceries", 95_000],
    ["d-trans", "Uber to office", 22_000],
    ["d-trans", "Rickshaw", 8_000],
    ["d-ent", "Movie night", 45_000],
    ["d-bills", "Internet bill", 120_000],
  ] as const

  for (let back = 40; back >= 0; back--) {
    const date = addDays(today, -back)
    const pick = (n: number) => merchants[(back * 3 + n) % merchants.length]
    for (const [i, hhmm] of ["09:30", "13:15", "19:40"].entries()) {
      if ((back + i) % 3 === 2) continue
      const [cat, title, amt] = pick(i)
      await expense.execute({
        accountId: i === 1 ? "d-bkash" : "d-cash",
        categoryId: cat,
        amount: amt + ((back * 700) % 5_000),
        occurredAt: at(date, hhmm),
        merchant: title,
        plannedStatus: (back + i) % 4 === 0 ? "unplanned" : "planned",
      })
    }
    if (back % 15 === 0) await income.execute({ accountId: "d-bank", categoryId: "d-sal", amount: 7_500_000, occurredAt: at(date, "10:00"), merchant: "Salary" })
    await planDay.execute({
      date: date,
      totalLimit: 90_000,
      allocations: [
        { categoryId: "d-food", amount: 40_000 },
        { categoryId: "d-trans", amount: 25_000 },
        { categoryId: "d-ent", amount: 15_000 },
      ],
    })
  }

  const dashboard = await new GetDashboardSummary({ transactions, accounts: accountsRepo, budgets }).execute(DEMO_TZ, 90, now)
  const range: DateRange = rangeForPreset((["today", "week", "month", "last_month", "last_30"].includes(preset) ? preset : "month") as "month", today)
  const report = await new GetPeriodReport({ transactions, accounts: accountsRepo, budgets }).execute(range, DEMO_TZ)

  return {
    accounts: await accountsRepo.list(),
    categories,
    dashboard,
    report: report.ok ? report.value : null,
    preset: ["today", "week", "month", "last_month", "last_30"].includes(preset) ? preset : "month",
  }
}
