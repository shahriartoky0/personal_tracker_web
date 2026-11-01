import { requireContainer } from "@/shared/infrastructure/container"
import { isValidLocalDate, rangeForPreset, todayIn, type DateRange } from "@/shared/domain/dates"
import { ReportsView } from "@/features/reports/presentation/components/reports-view"

export const metadata = { title: "Reports" }

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const PRESETS = ["today", "week", "month", "last_month", "last_30"] as const

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const c = await requireContainer()
  const profile = await c.settings.profile.execute()
  const today = todayIn(profile.timezone)

  const from = one(sp.from)
  const to = one(sp.to)
  const presetParam = one(sp.preset)
  let preset: string
  let range: DateRange
  if (presetParam === "custom" && isValidLocalDate(from) && isValidLocalDate(to)) {
    preset = "custom"
    range = { from, to }
  } else {
    preset = (PRESETS as readonly string[]).includes(presetParam) ? presetParam : "month"
    range = rangeForPreset(preset as (typeof PRESETS)[number], today)
  }

  const category = one(sp.category)
  const account = one(sp.account)
  const planned = one(sp.planned) === "planned" || one(sp.planned) === "unplanned" ? (one(sp.planned) as "planned" | "unplanned") : undefined

  const result = await c.reports.execute(range, profile.timezone, {
    categoryId: category || undefined,
    accountId: account || undefined,
    plannedStatus: planned,
  })

  return (
    <ReportsView
      key={`${range.from}${range.to}${category}${account}${planned}`}
      report={result.ok ? result.value : null}
      error={result.ok ? undefined : result.error.message}
      filters={{ preset, category, account, planned: planned ?? "" }}
      exportFilters={{ from: range.from, to: range.to, categoryId: category || undefined, accountId: account || undefined, plannedStatus: planned }}
    />
  )
}
