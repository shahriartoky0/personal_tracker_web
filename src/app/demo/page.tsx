import Link from "next/link"
import { AppShell } from "@/components/layout/app-shell"
import { buildDemo } from "@/shared/demo/demo-data"
import { DashboardView } from "@/features/budgets/presentation/components/dashboard-view"
import { ReportsView } from "@/features/reports/presentation/components/reports-view"

export const metadata = { title: "Demo" }
export const dynamic = "force-dynamic"

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ preset?: string }> }) {
  const { preset = "last_30" } = await searchParams
  const demo = await buildDemo(preset)
  return (
    <AppShell
      data={{ currency: "BDT", timezone: "Asia/Dhaka", displayName: "Demo", email: "", accounts: demo.accounts, categories: demo.categories, payees: [], demo: true }}
    >
      <div role="note" className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning/40 bg-warning-soft p-3 text-sm">
        <span><strong>Demo data.</strong> Everything below is sample data kept in memory — it is not your records and nothing is saved.</span>
        <Link href="/signup" className="font-medium underline underline-offset-4">Create your own account</Link>
      </div>
      <DashboardView summary={demo.dashboard} />
      <h2 className="text-title mb-4 mt-12">Sample report</h2>
      <ReportsView
        key={demo.preset}
        report={demo.report}
        filters={{ preset: demo.preset, category: "", account: "", planned: "" }}
        exportFilters={{}}
        demo
      />
    </AppShell>
  )
}
