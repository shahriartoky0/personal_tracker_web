"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useApp } from "@/components/layout/app-context"
import { useMediaQuery } from "@/shared/lib/use-media-query"
import { formatMoney } from "@/shared/domain/money"

export interface BarDatum {
  label: string
  spent: number
  income?: number
  tooltipLabel?: string
}

/** Compact amount for axis ticks: 12k, 1.2L is avoided — plain k/M keeps it unambiguous. */
function compact(minor: number): string {
  const v = minor / 100
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}M`
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`
  return String(Math.round(v))
}

export function SpendBarChart({
  data,
  height = 220,
  showIncome = false,
  summary,
}: {
  data: BarDatum[]
  height?: number
  showIncome?: boolean
  summary: string
}) {
  const { currency } = useApp()
  const small = !useMediaQuery("(min-width: 640px)")
  const total = data.reduce((s, d) => s + d.spent, 0)

  if (data.length === 0 || (total === 0 && !data.some((d) => (d.income ?? 0) > 0))) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No spending in this period yet.</p>
  }

  return (
    <figure className="m-0">
      <div role="img" aria-label={summary} style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              interval={data.length > (small ? 8 : 14) ? "preserveStartEnd" : 0}
              minTickGap={16}
            />
            <YAxis
              width={small ? 36 : 44}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickFormatter={compact}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
              labelFormatter={(_, p) => p?.[0]?.payload?.tooltipLabel ?? p?.[0]?.payload?.label}
              formatter={(v, name) => [formatMoney(Number(v), { currency }), name === "income" ? "Income" : "Spent"]}
            />
            <Bar isAnimationActive={false} dataKey="spent" name="Spent" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
            {showIncome && <Bar isAnimationActive={false} dataKey="income" name="income" fill="var(--chart-5)" radius={[4, 4, 0, 0]} maxBarSize={36} />}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{summary}</figcaption>
    </figure>
  )
}
