import { requireContainer } from "@/shared/infrastructure/container"
import { isValidLocalDate, rangeForPreset, todayIn, type DateRange } from "@/shared/domain/dates"
import { TransfersView } from "@/features/transfers/presentation/components/transfers-view"

export const metadata = { title: "Transfers" }

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""
const PRESETS = ["today", "week", "month", "last_month", "last_30"] as const

export default async function TransfersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const c = await requireContainer()
  const profile = await c.settings.profile.execute()
  const today = todayIn(profile.timezone)

  const presetParam = one(sp.preset)
  const from = one(sp.from)
  const to = one(sp.to)
  let preset: string
  let range: DateRange
  if (presetParam === "custom" && isValidLocalDate(from) && isValidLocalDate(to)) {
    preset = "custom"
    range = { from, to }
  } else if (presetParam === "all") {
    preset = "all"
    range = { from: "2000-01-01", to: today }
  } else {
    preset = (PRESETS as readonly string[]).includes(presetParam) ? presetParam : "month"
    range = rangeForPreset(preset as (typeof PRESETS)[number], today)
  }

  const payee = one(sp.payee)
  const result = await c.transfers.tracker.execute(range, profile.timezone, payee || undefined)

  return (
    <TransfersView
      key={`${range.from}${range.to}${payee}`}
      tracker={result.ok ? result.value : null}
      error={result.ok ? undefined : result.error.message}
      filters={{ preset, payee }}
    />
  )
}
