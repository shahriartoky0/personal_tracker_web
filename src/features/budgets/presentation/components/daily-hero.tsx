"use client"

import Link from "next/link"
import { AlertTriangle, CheckCircle2, CircleSlash, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useApp } from "@/components/layout/app-context"
import type { DailySummary } from "../../domain/services/budget-calculator"

const STATUS = {
  none: { icon: CircleSlash, text: "No daily budget set", tone: "text-muted-foreground bg-muted" },
  ok: { icon: CheckCircle2, text: "On track", tone: "text-success bg-success-soft" },
  approaching: { icon: AlertTriangle, text: "Approaching your limit", tone: "text-warning bg-warning-soft" },
  over: { icon: TrendingUp, text: "Over budget", tone: "text-destructive bg-destructive-soft" },
} as const

export function DailyHero({ daily, hasPlan }: { daily: DailySummary; hasPlan: boolean }) {
  const { money, demo } = useApp()
  const s = STATUS[daily.status]
  const Icon = s.icon
  const over = daily.remaining !== null && daily.remaining < 0
  const pct = Math.min(100, Math.max(0, daily.percentUsed ?? 0))
  const barTone = daily.status === "over" ? "bg-destructive" : daily.status === "approaching" ? "bg-warning" : "bg-primary"

  return (
    <Card className="gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-label text-muted-foreground">{over ? "Over budget" : "Left for today"}</p>
          {hasPlan ? (
            <p className={cn("num text-display mt-1 break-words", over && "text-destructive")} aria-live="polite">
              {over ? `−${money(-daily.remaining!)}` : money(daily.remaining!)}
            </p>
          ) : (
            <p className="text-title mt-1">No budget today</p>
          )}
        </div>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium", s.tone)}>
          <Icon className="size-4" aria-hidden />
          {s.text}
          {daily.percentUsed !== null && daily.status !== "ok" && daily.status !== "none" ? ` · ${daily.percentUsed}%` : ""}
        </span>
      </div>

      {hasPlan ? (
        <div className="space-y-1.5">
          <div
            role="progressbar"
            aria-label="Share of today's limit used"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.min(daily.percentUsed ?? 0, 100)}
            aria-valuetext={`${daily.percentUsed ?? 0}% of today's limit used`}
            className="h-3 overflow-hidden rounded-full bg-muted"
          >
            <div className={cn("h-full rounded-full transition-[width]", barTone)} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-caption num text-muted-foreground">
            {daily.percentUsed ?? 0}% used · {money(daily.spent)} of {money(daily.limit!)}
          </p>
        </div>
      ) : (
        !demo && (
          <Button asChild variant="secondary" className="tap w-fit">
            <Link href="/plan">Plan today</Link>
          </Button>
        )
      )}

      <dl className="grid grid-cols-3 gap-3 border-t pt-4">
        <div>
          <dt className="text-label text-muted-foreground">Planned</dt>
          <dd className="num text-value mt-0.5">{hasPlan ? money(daily.limit!) : "—"}</dd>
        </div>
        <div>
          <dt className="text-label text-muted-foreground">Spent</dt>
          <dd className="num text-value mt-0.5">{money(daily.spent)}</dd>
        </div>
        <div>
          <dt className="text-label text-muted-foreground">Unplanned</dt>
          <dd className={cn("num text-value mt-0.5", daily.unplannedSpent > 0 && "text-warning")}>{money(daily.unplannedSpent)}</dd>
        </div>
      </dl>
    </Card>
  )
}
