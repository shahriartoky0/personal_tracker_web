"use client"

import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useApp } from "@/components/layout/app-context"
import { CategoryIcon } from "@/components/layout/category-icon"
import { SpendBarChart } from "@/components/charts/spend-bar-chart"
import { colorAt } from "@/components/charts/palette"
import { formatDate } from "@/shared/lib/format"
import type { DashboardSummary } from "@/shared/application/get-dashboard-summary"
import { TransactionList } from "@/features/transactions/presentation/components/transaction-list"
import { useQuickAdd } from "@/features/transactions/presentation/components/quick-add"
import { DailyHero } from "./daily-hero"

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-label text-muted-foreground">{label}</p>
      <p className={`num text-value ${tone ?? ""}`}>{value}</p>
    </Card>
  )
}

export function DashboardView({ summary }: { summary: DashboardSummary }) {
  const { money, displayName, categoryById, demo } = useApp()
  const { openIncome } = useQuickAdd()
  const maxCat = Math.max(1, ...summary.todayCategorySpend.map((c) => c.amount))
  const weekTotal = summary.weekTrend.reduce((s, d) => s + d.spent, 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title">Hello{displayName ? `, ${displayName}` : ""}</h1>
        <p className="text-sm text-muted-foreground">{formatDate(summary.today, { weekday: true })}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DailyHero daily={summary.daily} hasPlan={summary.hasPlan} />
        <div className="grid grid-cols-2 gap-3 self-start">
          <Stat label="Balance" value={money(summary.balance)} tone={summary.balance < 0 ? "text-destructive" : ""} />
          <Stat label="Net this month" value={money(summary.monthNet, { showPlus: true })} tone={summary.monthNet < 0 ? "text-destructive" : "text-success"} />
          <Stat label="Income this month" value={money(summary.monthIncome)} />
          <Stat label="Spent this month" value={money(summary.monthExpenses)} />
          {summary.monthSentToPeople > 0 &&
            (demo ? (
              <Stat label="Sent to people" value={money(summary.monthSentToPeople)} />
            ) : (
              <Link href="/transfers" className="col-span-2 block rounded-xl">
                <Card className="gap-1 p-4 transition-colors hover:bg-muted/60">
                  <p className="text-label text-muted-foreground">Sent to people this month · not in spending</p>
                  <p className="num text-value">{money(summary.monthSentToPeople)}</p>
                </Card>
              </Link>
            ))}
          {!demo && (
            <Button variant="outline" onClick={openIncome} className="tap col-span-2">
              <Plus aria-hidden /> Add Income
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-section">Spent today by category</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.todayCategorySpend.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nothing spent yet today. {summary.daily.limit !== null ? "You still have your full limit." : ""}
              </p>
            ) : (
              <ul className="space-y-3">
                {summary.todayCategorySpend.slice(0, 5).map((c, i) => {
                  const cat = categoryById(c.categoryId)
                  return (
                    <li key={c.categoryId} className="space-y-1">
                      <div className="flex items-center gap-2 text-sm">
                        <CategoryIcon name={cat?.icon ?? null} className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate">{cat?.name ?? "Other"}</span>
                        <span className="num font-medium">{money(c.amount)}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                        <div className="h-full rounded-full" style={{ width: `${(c.amount / maxCat) * 100}%`, background: colorAt(i) }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-section">Last 7 days</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendBarChart
              height={180}
              data={summary.weekTrend.map((d) => ({ label: formatDate(d.date, { year: false }).split(" ")[0], tooltipLabel: formatDate(d.date, { weekday: true }), spent: d.spent }))}
              summary={`Spending over the last 7 days, ${money(weekTotal)} in total. ${summary.weekTrend.map((d) => `${formatDate(d.date, { year: false })}: ${money(d.spent)}`).join("; ")}.`}
            />
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="recent" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="recent" className="text-section">Recent transactions</h2>
          {!demo && (
            <Button asChild variant="ghost" size="sm" className="tap">
              <Link href="/transactions">See all</Link>
            </Button>
          )}
        </div>
        <TransactionList transactions={summary.recent} grouped={false} />
      </section>
    </div>
  )
}
