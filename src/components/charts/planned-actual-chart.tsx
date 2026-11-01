"use client"

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { useApp } from "@/components/layout/app-context"
import { formatMoney } from "@/shared/domain/money"
import { useMediaQuery } from "@/shared/lib/use-media-query"
import type { VarianceRow } from "@/features/budgets/domain/services/budget-calculator"

export function PlannedActualChart({ rows }: { rows: VarianceRow[] }) {
  const { categoryById, currency, money } = useApp()
  const wide = useMediaQuery("(min-width: 640px)")
  const data = rows.slice(0, 8).map((r) => ({
    name: categoryById(r.categoryId)?.name ?? "Other",
    planned: r.planned,
    actual: r.actual,
    variance: r.variance,
  }))
  if (data.length === 0 || data.every((d) => d.planned === 0)) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No category plans in this period. Allocate your daily budget to categories in <strong>Plan</strong> to compare planned vs actual.
      </p>
    )
  }
  const summary = `Planned versus actual by category. ${data.map((d) => `${d.name}: planned ${money(d.planned)}, actual ${money(d.actual)}`).join("; ")}.`
  return (
    <div>
      <div role="img" aria-label={summary} style={{ height: Math.max(220, data.length * (wide ? 44 : 52) + 60) }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--muted-foreground)" }} tickFormatter={(v) => String(Math.round(v / 100))} />
            <YAxis type="category" dataKey="name" width={wide ? 104 : 92} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "var(--foreground)" }} />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
              formatter={(v, n) => [formatMoney(Number(v), { currency }), String(n)]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar isAnimationActive={false} dataKey="planned" name="Planned" fill="var(--chart-3)" radius={[0, 4, 4, 0]} maxBarSize={14} />
            <Bar isAnimationActive={false} dataKey="actual" name="Actual" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 space-y-1 text-sm">
        {data.map((d) => (
          <li key={d.name} className="flex items-center justify-between gap-2">
            <span className="truncate">{d.name}</span>
            <span className="num text-muted-foreground">
              {money(d.actual)} of {money(d.planned)} ·{" "}
              <span className={d.variance > 0 ? "font-medium text-destructive" : "text-success"}>
                {d.variance > 0 ? `Over by ${money(d.variance)}` : `${money(-d.variance)} left`}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
