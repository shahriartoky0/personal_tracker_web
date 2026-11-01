import { requireContainer } from "@/shared/infrastructure/container"
import { DEFAULT_WARN_THRESHOLD } from "@/features/budgets/domain/services/budget-calculator"
import { DashboardView } from "@/features/budgets/presentation/components/dashboard-view"

export const metadata = { title: "Home" }

export default async function DashboardPage() {
  const c = await requireContainer()
  const [profile, reminders] = await Promise.all([c.settings.profile.execute(), c.settings.reminders.list()])
  const threshold = reminders.find((r) => r.type === "budget_threshold")
  const warnAt = threshold?.enabled && threshold.thresholdPercent ? threshold.thresholdPercent : DEFAULT_WARN_THRESHOLD
  const summary = await c.dashboard.execute(profile.timezone, warnAt)
  return <DashboardView summary={summary} />
}
