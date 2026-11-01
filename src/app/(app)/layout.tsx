import { AppShell } from "@/components/layout/app-shell"
import { requireContainer } from "@/shared/infrastructure/container"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const c = await requireContainer()
  const [profile, accounts, categories] = await Promise.all([
    c.settings.profile.execute(),
    c.accounts.list.execute({ includeArchived: true }),
    c.categories.list.execute({ includeArchived: true }),
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
      }}
    >
      {children}
    </AppShell>
  )
}
