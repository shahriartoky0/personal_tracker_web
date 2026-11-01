import { AppShell } from "@/components/layout/app-shell"
import { requireContainer } from "@/shared/infrastructure/container"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const c = await requireContainer()
  const [profile, accounts, categories, payees] = await Promise.all([
    c.settings.profile.execute(),
    c.accounts.list.execute({ includeArchived: true }),
    c.categories.list.execute({ includeArchived: true }),
    // The people list is only a convenience (suggestions, names); never let it take the whole app down.
    c.transfers.payees.execute({ includeArchived: true }).catch((e) => {
      console.error("[layout] payees unavailable - is the person_transfers migration applied?", e)
      return []
    }),
  ])
  return (
    <AppShell
      data={{
        currency: profile.currency,
        timezone: profile.timezone,
        displayName: profile.displayName,
        email: c.email,
        accounts,
        categories,
        payees,
      }}
    >
      {children}
    </AppShell>
  )
}
