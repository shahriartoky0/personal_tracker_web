import { requireContainer } from "@/shared/infrastructure/container"
import { isValidLocalDate, todayIn } from "@/shared/domain/dates"
import { summarizeDay } from "@/features/budgets/domain/services/budget-calculator"
import { PlanView } from "@/features/budgets/presentation/components/plan-view"

export const metadata = { title: "Plan" }

export default async function PlanPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const { date: raw } = await searchParams
  const c = await requireContainer()
  const profile = await c.settings.profile.execute()
  const today = todayIn(profile.timezone)
  const date = raw && isValidLocalDate(raw) ? raw : today

  const [budget, planned, txs] = await Promise.all([
    c.budgets.get.execute(date),
    c.budgets.planned.list(date, date),
    c.transactions.list.execute({ range: { from: date, to: date } }, profile.timezone),
  ])
  const summary = summarizeDay(budget, txs.ok ? txs.value : [])

  return <PlanView key={`${date}:${budget?.id ?? "new"}:${budget?.totalLimit ?? 0}:${budget?.allocations.length ?? 0}`} date={date} today={today} budget={budget} summary={summary} planned={planned} />
}
