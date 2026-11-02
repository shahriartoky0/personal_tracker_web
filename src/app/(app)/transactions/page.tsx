import { requireContainer } from "@/shared/infrastructure/container"
import { endOfMonth, startOfMonth, todayIn } from "@/shared/domain/dates"
import { TransactionsView } from "@/features/transactions/presentation/components/transactions-view"

export const metadata = { title: "Transactions" }

type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ""

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const c = await requireContainer()
  const profile = await c.settings.profile.execute()
  const today = todayIn(profile.timezone)

  const hasAnyFilter = ["q", "from", "to", "category", "account", "planned"].some((k) => k in sp)
  const filters = {
    q: one(sp.q),
    // No filters yet: show the current month so the page stays fast and relevant.
    from: hasAnyFilter ? one(sp.from) : startOfMonth(today),
    to: hasAnyFilter ? one(sp.to) : endOfMonth(today),
    category: one(sp.category),
    account: one(sp.account),
    planned: one(sp.planned),
  }
  const planned = filters.planned === "planned" || filters.planned === "unplanned" ? filters.planned : undefined
  // A single bound is treated as open-ended on the other side.
  const range = filters.from || filters.to ? { from: filters.from || "1970-01-01", to: filters.to || "2999-12-31" } : undefined

  const result = await c.transactions.list.execute(
    { range, categoryId: filters.category || undefined, accountId: filters.account || undefined, plannedStatus: planned, search: filters.q },
    profile.timezone,
  )

  return (
    <TransactionsView
      transactions={result.ok ? result.value : []}
      error={result.ok ? undefined : result.error.message}
      filters={filters}
      exportFilters={{
        from: range?.from,
        to: range?.to,
        categoryId: filters.category || undefined,
        accountId: filters.account || undefined,
        plannedStatus: planned,
        search: filters.q || undefined,
      }}
    />
  )
}
