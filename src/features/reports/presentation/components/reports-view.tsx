"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowDownRight, ArrowUpRight, Minus, TriangleAlert } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/components/layout/app-context"
import { CategoryDonut } from "@/components/charts/category-donut"
import { PlannedActualChart } from "@/components/charts/planned-actual-chart"
import { SpendBarChart } from "@/components/charts/spend-bar-chart"
import { colorAt } from "@/components/charts/palette"
import { formatDate, formatPercent } from "@/shared/lib/format"
import { diffDays, type PeriodPreset } from "@/shared/domain/dates"
import { ExportButton, type ExportFilters } from "@/features/transactions/presentation/components/export-button"
import type { PeriodReport } from "../../domain/services/period-report"

const PRESETS: { id: Exclude<PeriodPreset, "custom">; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
]

export interface ReportFiltersState {
  preset: string
  category: string
  account: string
  planned: string
}

function qs(f: ReportFiltersState, extra: Record<string, string>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v)
  return `?${p.toString()}`
}

function Summary({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-label text-muted-foreground">{label}</p>
      <p className={cn("num text-value break-words", tone)}>{value}</p>
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </Card>
  )
}

function Change({ label, amount, percent, goodWhenDown }: { label: string; amount: number; percent: number | null; goodWhenDown?: boolean }) {
  const { money } = useApp()
  const Icon = amount === 0 ? Minus : amount > 0 ? ArrowUpRight : ArrowDownRight
  const good = amount === 0 ? null : goodWhenDown ? amount < 0 : amount > 0
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      <span className={cn("num inline-flex items-center gap-1 font-medium", good === true && "text-success", good === false && "text-destructive")}>
        <Icon className="size-4" aria-hidden />
        {amount > 0 ? "+" : amount < 0 ? "−" : ""}
        {money(Math.abs(amount))} <span className="text-muted-foreground">({formatPercent(percent)})</span>
        <span className="sr-only">{amount === 0 ? "no change" : amount > 0 ? "increase" : "decrease"}</span>
      </span>
    </div>
  )
}

export function ReportsView({
  report,
  filters,
  exportFilters,
  error,
  demo,
}: {
  report: PeriodReport | null
  filters: ReportFiltersState
  exportFilters: ExportFilters
  error?: string
  /** Read-only sample mode: only the period presets are interactive. */
  demo?: boolean
}) {
  const app = useApp()
  const router = useRouter()
  const path = usePathname()
  const [from, setFrom] = useState(report?.range.from ?? "")
  const [to, setTo] = useState(report?.range.to ?? "")
  const { money } = app

  const select = "tap w-full rounded-md border bg-background px-3 text-sm"
  const go = (extra: Record<string, string>) => router.push(`${path}${qs(filters, extra)}`)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {demo ? <p className="text-section">Reports</p> : <h1 className="text-title">Reports</h1>}
          {report && (
            <p className="text-sm text-muted-foreground">
              {formatDate(report.range.from)} – {formatDate(report.range.to)} · {diffDays(report.range.from, report.range.to) + 1} days
            </p>
          )}
        </div>
        {report && !demo && <ExportButton filters={exportFilters} filename={`transactions_${report.range.from}_to_${report.range.to}.csv`} label="Export transactions" />}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Button
                key={p.id}
                asChild
                variant={filters.preset === p.id ? "default" : "outline"}
                size="sm"
                className="tap"
              >
                <Link href={`${path}${qs(filters, { preset: p.id, from: "", to: "" })}`} aria-current={filters.preset === p.id ? "true" : undefined}>
                  {p.label}
                </Link>
              </Button>
            ))}
          </div>
          {!demo && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr_auto]">
            <div>
              <Label htmlFor="r-from" className="text-label">From</Label>
              <Input id="r-from" type="date" className="tap mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="r-to" className="text-label">To</Label>
              <Input id="r-to" type="date" className="tap mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="r-cat" className="text-label">Category</Label>
              <select id="r-cat" className={`${select} mt-1`} value={filters.category} onChange={(e) => go({ category: e.target.value })}>
                <option value="">All categories</option>
                {app.categories.filter((c) => c.type === "expense").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="r-acc" className="text-label">Account</Label>
              <select id="r-acc" className={`${select} mt-1`} value={filters.account} onChange={(e) => go({ account: e.target.value })}>
                <option value="">All accounts</option>
                {app.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
            <div>
              <Label htmlFor="r-pl" className="text-label">Planned?</Label>
              <select id="r-pl" className={`${select} mt-1`} value={filters.planned} onChange={(e) => go({ planned: e.target.value })}>
                <option value="">All spending</option>
                <option value="planned">Planned only</option>
                <option value="unplanned">Unplanned only</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="tap w-full" onClick={() => go({ preset: "custom", from, to })} disabled={!from || !to}>Apply dates</Button>
            </div>
          </div>
          )}
        </CardContent>
      </Card>

      {error && <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}

      {report && (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Summary label="Opening balance" value={money(report.openingBalance)} />
            <Summary label="Income" value={money(report.income)} tone="text-success" />
            <Summary label="Expenses" value={money(report.expenses)} />
            <Summary label="Net cash flow" value={money(report.net, { showPlus: true })} tone={report.net < 0 ? "text-destructive" : "text-success"} hint="Income − expenses" />
            <Summary label="Closing balance" value={money(report.closingBalance)} hint={report.transfersExcluded > 0 ? `${money(report.transfersExcluded)} of transfers excluded` : "Transfers excluded"} />
          </section>

          {report.unplannedSpent > 0 && (
            <div role="note" className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning-soft p-4 text-sm">
              <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <p>
                <strong className="num">{money(report.unplannedSpent)}</strong> of your spending was <strong>unplanned</strong> ({report.unplannedCount}{" "}
                {report.unplannedCount === 1 ? "purchase" : "purchases"}) — {report.expenses ? Math.round((report.unplannedSpent * 100) / report.expenses) : 0}% of all expenses.
              </p>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-section">Where it went</CardTitle><CardDescription>Expenses by category</CardDescription></CardHeader>
              <CardContent><CategoryDonut slices={report.byCategory} /></CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-section">Spending trend</CardTitle>
                <CardDescription>{report.trendGranularity === "day" ? "By day" : "By week"}</CardDescription>
              </CardHeader>
              <CardContent>
                <SpendBarChart
                  showIncome={false}
                  data={report.trend.map((b) => ({
                    label: report.trendGranularity === "day" ? String(Number(b.start.slice(8))) : formatDate(b.start, { year: false }),
                    tooltipLabel: report.trendGranularity === "day" ? formatDate(b.start, { weekday: true }) : `${formatDate(b.start)} – ${formatDate(b.end)}`,
                    spent: b.spent,
                  }))}
                  summary={`Spending by ${report.trendGranularity} from ${formatDate(report.range.from)} to ${formatDate(report.range.to)}. Total ${money(report.expenses)}.`}
                />
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle className="text-section">Planned vs actual</CardTitle><CardDescription>Budget allocations compared with what you spent</CardDescription></CardHeader>
              <CardContent><PlannedActualChart rows={report.plannedVsActual} /></CardContent>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-section">Compared with before</CardTitle><CardDescription>{formatDate(report.previous.range.from)} – {formatDate(report.previous.range.to)}</CardDescription></CardHeader>
              <CardContent className="flex flex-col gap-3">
                <Change label="Spending" amount={report.change.expenses.amount} percent={report.change.expenses.percent} goodWhenDown />
                <Change label="Income" amount={report.change.income.amount} percent={report.change.income.percent} />
                <p className="num border-t pt-3 text-caption text-muted-foreground">Previous period: spent {money(report.previous.expenses)}, earned {money(report.previous.income)}.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-section">Payment methods</CardTitle></CardHeader>
              <CardContent>
                {report.byPaymentMethod.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No expenses yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {report.byPaymentMethod.map((m, i) => (
                      <li key={m.accountId} className="space-y-1">
                        <div className="flex justify-between gap-2 text-sm">
                          <span className="truncate">{app.accountById(m.accountId)?.name ?? "Account"}</span>
                          <span className="num font-medium">{money(m.amount)} <span className="text-muted-foreground">· {m.percent}%</span></span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full" style={{ width: `${m.percent}%`, background: colorAt(i) }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-section">Top merchants &amp; items</CardTitle></CardHeader>
              <CardContent>
                {report.topMerchants.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add a title when recording expenses to see your top items here.</p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {report.topMerchants.map((m, i) => (
                      <li key={m.name} className="flex items-center gap-2">
                        <span className="num w-5 text-muted-foreground">{i + 1}.</span>
                        <span className="min-w-0 flex-1 truncate">{m.name} <span className="text-muted-foreground">×{m.count}</span></span>
                        <span className="num font-medium">{money(m.amount)}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
