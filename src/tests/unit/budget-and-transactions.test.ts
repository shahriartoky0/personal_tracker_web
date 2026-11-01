import { describe, expect, it } from "vitest"
import { CreateExpense, CreateIncome, CreateTransfer, DeleteTransaction, ExportTransactions, ListTransactions, UpdateTransaction, DuplicateTransaction } from "@/features/transactions/domain/use-cases/transaction-use-cases"
import { CloseDailyBudget, CopyPreviousPlan, CreateDailyBudget } from "@/features/budgets/domain/use-cases/budget-use-cases"
import { budgetStatus, summarizeDay, plannedVsActual } from "@/features/budgets/domain/services/budget-calculator"
import { onLocalDate } from "@/features/transactions/domain/services/transaction-calculator"
import { totalBalance, accountBalance } from "@/features/accounts/domain/services/balance"
import { buildPeriodReport } from "@/features/reports/domain/services/period-report"
import { GetPeriodReport } from "@/features/reports/domain/use-cases/get-period-report"
import { GetDashboardSummary } from "@/shared/application/get-dashboard-summary"
import { transactionsToCsv } from "@/features/transactions/domain/services/csv"
import { seedWorld } from "@/shared/demo/in-memory-repositories"

const TZ = "Asia/Dhaka"
// 12:00 Dhaka on 2025-03-10 == 06:00Z
const NOON = "2025-03-10T06:00:00Z"

function setup() {
  const w = seedWorld()
  const deps = { transactions: w.transactions, accounts: w.accounts, categories: w.categories }
  return {
    ...w,
    deps,
    expense: new CreateExpense(deps),
    income: new CreateIncome(deps),
    transfer: new CreateTransfer(deps),
  }
}

describe("budget status & remaining", () => {
  it("computes remaining, including negative when overspent", async () => {
    const w = setup()
    await new CreateDailyBudget(w.budgets, w.categories).execute({
      date: "2025-03-10", totalLimit: 100_000, allocations: [{ categoryId: "food", amount: 60_000 }],
    })
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 70_000, occurredAt: NOON, plannedStatus: "planned" })
    await w.expense.execute({ accountId: "cash", categoryId: "transport", amount: 50_000, occurredAt: NOON })
    const day = summarizeDay(await w.budgets.getByDate("2025-03-10"), onLocalDate(w.transactions.items, "2025-03-10", TZ))
    expect(day.spent).toBe(120_000)
    expect(day.remaining).toBe(-20_000)
    expect(day.status).toBe("over")
    expect(day.unplannedSpent).toBe(50_000)
    expect(day.plannedSpent).toBe(70_000)
    expect(day.categories[0]).toMatchObject({ allocated: 60_000, spent: 70_000, remaining: -10_000 })
  })
  it("flags approaching at the threshold and handles no-budget days", () => {
    expect(budgetStatus(8_999, 10_000)).toBe("ok")
    expect(budgetStatus(9_000, 10_000)).toBe("approaching")
    expect(budgetStatus(10_000, 10_000)).toBe("approaching")
    expect(budgetStatus(10_001, 10_000)).toBe("over")
    expect(budgetStatus(5_000, null)).toBe("none")
    expect(summarizeDay(null, []).remaining).toBeNull()
  })
  it("a no-spend day leaves the full limit", async () => {
    const w = setup()
    await new CreateDailyBudget(w.budgets, w.categories).execute({ date: "2025-03-10", totalLimit: 50_000, allocations: [] })
    const day = summarizeDay(await w.budgets.getByDate("2025-03-10"), [])
    expect(day.remaining).toBe(50_000)
    expect(day.percentUsed).toBe(0)
  })
  it("assigns late-night spending to the correct local day", async () => {
    const w = setup()
    // 23:30 Dhaka Mar 10 == 17:30Z Mar 10 ; 00:30 Dhaka Mar 11 == 18:30Z Mar 10
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 100, occurredAt: "2025-03-10T17:30:00Z" })
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 200, occurredAt: "2025-03-10T18:30:00Z" })
    expect(summarizeDay(null, onLocalDate(w.transactions.items, "2025-03-10", TZ)).spent).toBe(100)
    expect(summarizeDay(null, onLocalDate(w.transactions.items, "2025-03-11", TZ)).spent).toBe(200)
  })
})

describe("plan editing preserves originals", () => {
  it("keeps original limit/allocation after editing", async () => {
    const w = setup()
    const uc = new CreateDailyBudget(w.budgets, w.categories)
    await uc.execute({ date: "2025-03-10", totalLimit: 100_000, allocations: [{ categoryId: "food", amount: 40_000 }] })
    const r = await uc.execute({ date: "2025-03-10", totalLimit: 150_000, allocations: [{ categoryId: "food", amount: 70_000 }, { categoryId: "transport", amount: 10_000 }] })
    if (!r.ok) throw new Error("expected ok")
    expect(r.value.totalLimit).toBe(150_000)
    expect(r.value.originalLimit).toBe(100_000)
    expect(r.value.allocations.find((a) => a.categoryId === "food")).toMatchObject({ plannedAmount: 70_000, originalAmount: 40_000 })
    expect(r.value.allocations.find((a) => a.categoryId === "transport")).toMatchObject({ plannedAmount: 10_000, originalAmount: 10_000 })
  })
  it("rejects allocations above the limit, duplicates and income categories", async () => {
    const w = setup()
    const uc = new CreateDailyBudget(w.budgets, w.categories)
    expect((await uc.execute({ date: "2025-03-10", totalLimit: 1_000, allocations: [{ categoryId: "food", amount: 2_000 }] })).ok).toBe(false)
    expect((await uc.execute({ date: "2025-03-10", totalLimit: 9_000, allocations: [{ categoryId: "salary", amount: 1_000 }] })).ok).toBe(false)
    expect((await uc.execute({ date: "bad", totalLimit: 9_000, allocations: [] })).ok).toBe(false)
  })
  it("allocations are not actual expenses", async () => {
    const w = setup()
    await new CreateDailyBudget(w.budgets, w.categories).execute({ date: "2025-03-10", totalLimit: 100_000, allocations: [{ categoryId: "food", amount: 50_000 }] })
    expect(w.transactions.items).toHaveLength(0)
  })
  it("copies yesterday's plan as a draft", async () => {
    const w = setup()
    await new CreateDailyBudget(w.budgets, w.categories).execute({ date: "2025-03-09", totalLimit: 80_000, allocations: [{ categoryId: "food", amount: 30_000 }] })
    const r = await new CopyPreviousPlan(w.budgets).execute("2025-03-10", "yesterday")
    expect(r.ok && r.value.totalLimit).toBe(80_000)
    expect((await new CopyPreviousPlan(w.budgets).execute("2025-03-12", "yesterday")).ok).toBe(false)
  })
  it("closing requires a plan", async () => {
    const w = setup()
    expect((await new CloseDailyBudget(w.budgets).execute("2025-03-10")).ok).toBe(false)
    await new CreateDailyBudget(w.budgets, w.categories).execute({ date: "2025-03-10", totalLimit: 1, allocations: [] })
    expect((await new CloseDailyBudget(w.budgets).execute("2025-03-10")).ok).toBe(true)
  })
})

describe("transaction use cases", () => {
  it("validates amount, category type and archived references", async () => {
    const w = setup()
    for (const amount of [0, -5, 1.5, Number.NaN]) {
      const r = await w.expense.execute({ accountId: "cash", categoryId: "food", amount, occurredAt: NOON })
      expect(r.ok).toBe(false)
    }
    const wrongType = await w.expense.execute({ accountId: "cash", categoryId: "salary", amount: 100, occurredAt: NOON })
    expect(!wrongType.ok && wrongType.error.fields?.categoryId).toBeTruthy()
    const badDate = await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 100, occurredAt: "nope" })
    expect(badDate.ok).toBe(false)
    await w.accounts.update("cash", { isArchived: true })
    expect((await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 100, occurredAt: NOON })).ok).toBe(false)
    expect((await w.expense.execute({ accountId: "ghost", categoryId: "food", amount: 100, occurredAt: NOON })).ok).toBe(false)
  })
  it("defaults an expense to unplanned and trims text", async () => {
    const w = setup()
    const r = await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 100, occurredAt: NOON, merchant: "  Tea  " })
    expect(r.ok && r.value.plannedStatus).toBe("unplanned")
    expect(r.ok && r.value.merchant).toBe("Tea")
  })
  it("handles zero-pad edge: very large amounts are rejected, max-ish accepted", async () => {
    const w = setup()
    expect((await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 2_000_000_000_000, occurredAt: NOON })).ok).toBe(false)
    expect((await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 999_999_999_999, occurredAt: NOON })).ok).toBe(true)
  })
  it("edits, duplicates and deletes", async () => {
    const w = setup()
    const created = await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 100, occurredAt: NOON })
    if (!created.ok) throw new Error()
    const upd = await new UpdateTransaction(w.deps).execute(created.value.id, { amount: 250, note: "lunch" })
    expect(upd.ok && upd.value.amount).toBe(250)
    const dup = await new DuplicateTransaction(w.deps).execute(created.value.id, "2025-03-11T06:00:00Z")
    expect(dup.ok && dup.value.id !== created.value.id).toBe(true)
    expect(w.transactions.items).toHaveLength(2)
    expect((await new DeleteTransaction(w.transactions).execute(created.value.id)).ok).toBe(true)
    expect((await new DeleteTransaction(w.transactions).execute("nope")).ok).toBe(false)
    expect(w.transactions.items).toHaveLength(1)
  })
  it("supports refunds as income without touching expense totals", async () => {
    const w = setup()
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 1_000, occurredAt: NOON })
    await w.income.execute({ accountId: "cash", categoryId: "salary", amount: 400, occurredAt: NOON, note: "refund" })
    expect(accountBalance(w.cash, w.transactions.items)).toBe(100_000 - 1_000 + 400)
  })
})

describe("transfers", () => {
  it("creates linked legs that never count as income or expense", async () => {
    const w = setup()
    const before = totalBalance([w.cash, w.bank], w.transactions.items)
    const r = await w.transfer.execute({ fromAccountId: "bank", toAccountId: "cash", amount: 20_000, occurredAt: NOON })
    expect(r.ok).toBe(true)
    expect(w.transactions.items).toHaveLength(2)
    expect(accountBalance(w.cash, w.transactions.items)).toBe(120_000)
    expect(accountBalance(w.bank, w.transactions.items)).toBe(480_000)
    expect(totalBalance([w.cash, w.bank], w.transactions.items)).toBe(before)
    const day = summarizeDay(null, onLocalDate(w.transactions.items, "2025-03-10", TZ))
    expect(day.spent).toBe(0)
    const rep = buildPeriodReport({
      range: { from: "2025-03-01", to: "2025-03-31" }, timezone: TZ, accounts: [w.cash, w.bank],
      transactions: w.transactions.items, previousTransactions: [], budgets: [],
    })
    expect(rep.income).toBe(0)
    expect(rep.expenses).toBe(0)
    expect(rep.transfersExcluded).toBe(20_000)
  })
  it("rejects same-account and archived transfers, and cannot edit a transfer", async () => {
    const w = setup()
    expect((await w.transfer.execute({ fromAccountId: "cash", toAccountId: "cash", amount: 1, occurredAt: NOON })).ok).toBe(false)
    expect((await w.transfer.execute({ fromAccountId: "cash", toAccountId: "bank", amount: 0, occurredAt: NOON })).ok).toBe(false)
    await w.transfer.execute({ fromAccountId: "cash", toAccountId: "bank", amount: 100, occurredAt: NOON })
    const leg = w.transactions.items[0]
    expect((await new UpdateTransaction(w.deps).execute(leg.id, { amount: 5 })).ok).toBe(false)
  })
  it("deleting one leg removes the pair", async () => {
    const w = setup()
    await w.transfer.execute({ fromAccountId: "cash", toAccountId: "bank", amount: 100, occurredAt: NOON })
    await new DeleteTransaction(w.transactions).execute(w.transactions.items[0].id)
    expect(w.transactions.items).toHaveLength(0)
  })
})

describe("filtering & export", () => {
  async function populated() {
    const w = setup()
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 10_000, occurredAt: "2025-03-10T06:00:00Z", plannedStatus: "planned", merchant: "Cafe" })
    await w.expense.execute({ accountId: "bank", categoryId: "transport", amount: 5_000, occurredAt: "2025-03-11T06:00:00Z" })
    await w.income.execute({ accountId: "bank", categoryId: "salary", amount: 90_000, occurredAt: "2025-03-12T06:00:00Z" })
    return w
  }
  it("filters by date range, category, account, planned status and search", async () => {
    const w = await populated()
    const list = new ListTransactions(w.transactions)
    const val = async (q: Parameters<ListTransactions["execute"]>[0]) => {
      const r = await list.execute(q, TZ)
      return r.ok ? r.value.length : -1
    }
    expect(await val({})).toBe(3)
    expect(await val({ range: { from: "2025-03-10", to: "2025-03-10" } })).toBe(1)
    expect(await val({ range: { from: "2025-03-10", to: "2025-03-11" } })).toBe(2)
    expect(await val({ categoryId: "food" })).toBe(1)
    expect(await val({ accountId: "bank" })).toBe(2)
    expect(await val({ plannedStatus: "planned" })).toBe(1)
    expect(await val({ search: "cafe" })).toBe(1)
    expect(await val({ range: { from: "2025-03-12", to: "2025-03-10" } })).toBe(-1)
  })
  it("exports accurate CSV with signed amounts and local dates", async () => {
    const w = await populated()
    const r = await new ExportTransactions(w.deps).execute({ range: { from: "2025-03-10", to: "2025-03-12" } }, TZ)
    if (!r.ok) throw new Error()
    const lines = r.value.trim().split("\r\n")
    expect(lines[0]).toBe("Date,Time,Type,Amount,Category,Account,Planned,Merchant,Note,Transfer group")
    expect(lines[1]).toBe("2025-03-10,12:00,expense,-100.00,Food,Cash,planned,Cafe,,")
    expect(lines[3]).toBe("2025-03-12,12:00,income,900.00,Salary,Bank,,,,")
    expect(lines).toHaveLength(4)
  })
  it("escapes quotes/commas and neutralises formula injection", () => {
    const csv = transactionsToCsv(
      [{ id: "1", accountId: "a", categoryId: "c", type: "expense", transferDirection: null, transferGroupId: null, amount: 100, occurredAt: NOON, merchant: '=HYPERLINK("x")', note: 'a,"b"', plannedStatus: "unplanned", receiptPath: null }],
      { timezone: TZ, accountName: () => "A", categoryName: () => "C" },
    )
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
    expect(csv).toContain(`"a,""b"""`)
  })
})

describe("period report & dashboard", () => {
  async function world() {
    const w = setup()
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 30_000, occurredAt: "2025-03-10T06:00:00Z", plannedStatus: "planned", merchant: "Cafe" })
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 20_000, occurredAt: "2025-03-11T06:00:00Z", merchant: "cafe" })
    await w.expense.execute({ accountId: "bank", categoryId: "transport", amount: 10_000, occurredAt: "2025-03-11T06:00:00Z" })
    await w.income.execute({ accountId: "bank", categoryId: "salary", amount: 200_000, occurredAt: "2025-03-12T06:00:00Z" })
    await w.expense.execute({ accountId: "cash", categoryId: "food", amount: 15_000, occurredAt: "2025-02-20T06:00:00Z" })
    await new CreateDailyBudget(w.budgets, w.categories).execute({ date: "2025-03-10", totalLimit: 50_000, allocations: [{ categoryId: "food", amount: 25_000 }] })
    return w
  }
  it("derives opening/closing balance, totals and comparison", async () => {
    const w = await world()
    const r = await new GetPeriodReport(w).execute({ from: "2025-03-01", to: "2025-03-31" }, TZ)
    if (!r.ok) throw new Error()
    const rep = r.value
    expect(rep.openingBalance).toBe(600_000 - 15_000)
    expect(rep.income).toBe(200_000)
    expect(rep.expenses).toBe(60_000)
    expect(rep.net).toBe(140_000)
    expect(rep.closingBalance).toBe(rep.openingBalance + rep.net)
    expect(rep.unplannedSpent).toBe(30_000)
    expect(rep.unplannedCount).toBe(2)
    expect(rep.byCategory[0]).toMatchObject({ categoryId: "food", amount: 50_000, percent: 83 })
    expect(rep.topMerchants[0]).toMatchObject({ name: "Cafe", amount: 50_000, count: 2 })
    expect(rep.previous.expenses).toBe(15_000)
    expect(rep.change.expenses).toEqual({ amount: 45_000, percent: 300 })
    expect(rep.trendGranularity).toBe("day")
    expect(rep.trend).toHaveLength(31)
    expect(rep.trend.find((t) => t.start === "2025-03-11")?.spent).toBe(30_000)
  })
  it("compares planned vs actual and uses weekly buckets for long ranges", async () => {
    const w = await world()
    const r = await new GetPeriodReport(w).execute({ from: "2025-01-01", to: "2025-03-31" }, TZ)
    if (!r.ok) throw new Error()
    expect(r.value.trendGranularity).toBe("week")
    const food = r.value.plannedVsActual.find((p) => p.categoryId === "food")!
    expect(food).toMatchObject({ planned: 25_000, actual: 65_000, variance: 40_000 })
    expect(plannedVsActual([], []).length).toBe(0)
  })
  it("category filter doesn't distort closing balance", async () => {
    const w = await world()
    const r = await new GetPeriodReport(w).execute({ from: "2025-03-01", to: "2025-03-31" }, TZ, { categoryId: "transport" })
    if (!r.ok) throw new Error()
    expect(r.value.expenses).toBe(10_000)
    expect(r.value.closingBalance).toBe(585_000 + 200_000 - 60_000)
  })
  it("dashboard composes balance, month totals and today's plan", async () => {
    const w = await world()
    const now = new Date("2025-03-10T09:00:00Z")
    const d = await new GetDashboardSummary(w).execute(TZ, 90, now)
    expect(d.today).toBe("2025-03-10")
    expect(d.hasPlan).toBe(true)
    expect(d.daily.spent).toBe(30_000)
    expect(d.daily.remaining).toBe(20_000)
    expect(d.monthExpenses).toBe(60_000)
    expect(d.balance).toBe(600_000 - 15_000 - 60_000 + 200_000)
    expect(d.recent[0].occurredAt >= d.recent[1].occurredAt).toBe(true)
  })
})
