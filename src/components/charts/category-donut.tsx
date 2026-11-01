"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { useApp } from "@/components/layout/app-context"
import { CategoryIcon } from "@/components/layout/category-icon"
import { formatMoney } from "@/shared/domain/money"
import { colorAt } from "./palette"

export interface Slice {
  categoryId: string
  amount: number
  percent: number
}

export function CategoryDonut({ slices }: { slices: Slice[] }) {
  const { currency, categoryById, money } = useApp()
  const total = slices.reduce((s, x) => s + x.amount, 0)
  if (slices.length === 0) {
    return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No expenses to break down yet.</p>
  }
  const rows = slices.map((s, i) => ({ ...s, name: categoryById(s.categoryId)?.name ?? "Other", color: colorAt(i), icon: categoryById(s.categoryId)?.icon ?? null }))
  const summary = `Spending by category, total ${money(total)}. ${rows.map((r) => `${r.name} ${money(r.amount)} (${r.percent}%)`).join("; ")}.`

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-8">
      <div role="img" aria-label={summary} className="relative size-48 shrink-0 sm:size-52">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <PieChart>
            <Pie isAnimationActive={false} data={rows} dataKey="amount" nameKey="name" innerRadius="62%" outerRadius="100%" paddingAngle={rows.length > 1 ? 2 : 0} stroke="var(--card)" strokeWidth={2}>
              {rows.map((r) => (
                <Cell key={r.categoryId} fill={r.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--popover-foreground)" }}
              formatter={(v, name) => [formatMoney(Number(v), { currency }), String(name)]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div>
            <p className="text-caption text-muted-foreground">Total spent</p>
            <p className="num text-value">{money(total)}</p>
          </div>
        </div>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1.5" aria-label="Category legend">
        {rows.map((r) => (
          <li key={r.categoryId} className="flex items-center gap-2 text-sm">
            <span aria-hidden className="size-3 shrink-0 rounded-sm" style={{ background: r.color }} />
            <CategoryIcon name={r.icon} className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className="num font-medium">{money(r.amount)}</span>
            <span className="num w-10 text-right text-muted-foreground">{r.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
