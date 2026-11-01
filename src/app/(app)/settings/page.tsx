import { requireContainer } from "@/shared/infrastructure/container"
import { todayIn } from "@/shared/domain/dates"
import { SettingsView } from "@/features/settings/presentation/components/settings-view"

export const metadata = { title: "Settings" }

export default async function SettingsPage() {
  const c = await requireContainer()
  const [profile, reminders] = await Promise.all([c.settings.profile.execute(), c.settings.reminders.list()])
  return <SettingsView reminders={reminders} today={todayIn(profile.timezone)} />
}
