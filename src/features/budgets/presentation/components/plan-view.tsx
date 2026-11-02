"use client"

import { SelectField } from "@/components/layout/select-field"
import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { notifySuccess } from "@/components/layout/success-dialog"
import { CalendarCheck, ChevronLeft, ChevronRight, Copy, LockKeyhole, LockKeyholeOpen, Plus, Save, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { useApp } from "@/components/layout/app-context"
import { CategoryIcon } from "@/components/layout/category-icon"
import { addDays, type LocalDate } from "@/shared/domain/dates"
import { parseMoney, sumMinor, toDecimalString } from "@/shared/domain/money"
import { dayLabel, formatDate } from "@/shared/lib/format"
import type { DailyBudget, PlannedExpense } from "../../domain/entities/budget"
import type { DailySummary } from "../../domain/services/budget-calculator"
import {
  addPlannedExpenseAction,
  closeDayAction,
  copyPlanAction,
  deletePlannedExpenseAction,
  saveTemplateAction,
  savePlanAction,
  setPlannedExpenseStatusAction,
} from "../actions"

interface Props {
  date: LocalDate
  today: LocalDate
  budget: DailyBudget | null
  summary: DailySummary
  planned: PlannedExpense[]
}

export function PlanView({ date, today, budget, summary, planned }: Props) {
  const app = useApp()
  const router = useRouter()
  const [pending, start] = useTransition()
  const expenseCats = app.categories.filter((c) => c.type === "expense" && !c.isArchived)

  const [limit, setLimit] = useState(budget ? toDecimalString(budget.totalLimit, true) : "")
  const [alloc, setAlloc] = useState<Record<string, string>>(() =>
    Object.fromEntries((budget?.allocations ?? []).map((a) => [a.categoryId, toDecimalString(a.plannedAmount, true)])),
  )
  const [error, setError] = useState<string | null>(null)

  const limitMinor = parseMoney(limit || "0")
  const allocMinor = useMemo(() => sumMinor(Object.values(alloc).map((v) => parseMoney(v || "0") ?? 0)), [alloc])
  const invalidAmounts = Object.values(alloc).some((v) => v !== "" && parseMoney(v) === null) || (limit !== "" && limitMinor === null)
  const over = limitMinor !== null && allocMinor > limitMinor
  const unallocated = limitMinor === null ? 0 : limitMinor - allocMinor
  const payload = { date, totalLimit: limit, allocations: Object.entries(alloc).filter(([, v]) => v !== "").map(([categoryId, amount]) => ({ categoryId, amount })) }

  const run = (fn: () => Promise<void>) => start(() => void fn())
  const go = (d: LocalDate) => router.push(d === today ? "/plan" : `/plan?date=${d}`)

  const save = () =>
    run(async () => {
      setError(null)
      const res = await savePlanAction(payload)
      if (res.ok) {
        notifySuccess("Plan saved")
        router.refresh()
      } else {
        setError(res.fieldErrors?.allocations ?? res.fieldErrors?.totalLimit ?? res.message)
      }
    })

  const copy = (source: "yesterday" | "template") =>
    run(async () => {
      const res = await copyPlanAction({ date, source })
      if (!res.ok || !res.data) return void toast.error(res.ok ? "Nothing to copy" : res.message)
      setLimit(toDecimalString(res.data.totalLimit, true))
      setAlloc(Object.fromEntries(res.data.allocations.map((a) => [a.categoryId, toDecimalString(a.amount, true)])))
      notifySuccess(source === "yesterday" ? "Copied yesterday's plan — review and save" : "Template loaded — review and save")
    })

  const [pTitle, setPTitle] = useState("")
  const [pAmount, setPAmount] = useState("")
  const [pCat, setPCat] = useState(expenseCats[0]?.id ?? "")
  const [pErr, setPErr] = useState<string | null>(null)

  const addPlanned = () =>
    run(async () => {
      setPErr(null)
      const res = await addPlannedExpenseAction({ date, categoryId: pCat, title: pTitle, amount: pAmount })
      if (res.ok) {
        setPTitle("")
        setPAmount("")
        notifySuccess("Planned expense added")
        router.refresh()
      } else setPErr(res.fieldErrors ? Object.values(res.fieldErrors)[0] : res.message)
    })

  const closed = budget?.isClosed ?? false
  const edited = budget && (budget.originalLimit !== budget.totalLimit || budget.allocations.some((a) => a.originalAmount !== a.plannedAmount))

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-title">Plan {date === today ? "today" : "a day"}</h1>
          <p className="text-sm text-muted-foreground">Decide where the money goes before you spend it.</p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Choose day">
          <Button variant="outline" size="icon" className="tap" aria-label="Previous day" onClick={() => go(addDays(date, -1))}>
            <ChevronLeft aria-hidden />
          </Button>
          <span className="num min-w-32 text-center text-sm font-medium">{dayLabel(date, today)}<span className="block text-caption text-muted-foreground">{formatDate(date)}</span></span>
          <Button variant="outline" size="icon" className="tap" aria-label="Next day" onClick={() => go(addDays(date, 1))}>
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-section">Daily limit &amp; categories</CardTitle>
            <CardDescription>
              Allocations are a plan only — they never count as spending until you record a transaction.
              {!budget && " Leave the limit empty to skip budgeting today (a no-budget day)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="limit">Total spending limit</Label>
              <Input id="limit" inputMode="decimal" placeholder="0" value={limit} onChange={(e) => setLimit(e.target.value)} className="num h-12 text-xl font-semibold" aria-invalid={limitMinor === null} disabled={closed} />
              {edited && budget && (
                <p className="text-caption text-muted-foreground num">Originally planned {app.money(budget.originalLimit)} — kept for your reports.</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" className="tap" disabled={pending || closed} onClick={() => copy("yesterday")}>
                <Copy aria-hidden /> Copy yesterday
              </Button>
              <Button variant="outline" className="tap" disabled={pending || closed} onClick={() => copy("template")}>
                Use template
              </Button>
            </div>

            <fieldset className="flex flex-col gap-2" disabled={closed}>
              <legend className="text-label mb-1">Category allocations <span className="text-muted-foreground">(optional)</span></legend>
              {expenseCats.map((c) => {
                const original = budget?.allocations.find((a) => a.categoryId === c.id)
                const changed = original && original.originalAmount !== original.plannedAmount
                return (
                  <div key={c.id} className="grid grid-cols-[1fr_8.5rem] items-center gap-3">
                    <Label htmlFor={`a-${c.id}`} className="flex min-w-0 items-center gap-2 font-normal">
                      <CategoryIcon name={c.icon} color={c.color} className="size-4 shrink-0" />
                      <span className="truncate">{c.name}</span>
                    </Label>
                    <div>
                      <Input id={`a-${c.id}`} inputMode="decimal" placeholder="0" className="num tap text-right" value={alloc[c.id] ?? ""} onChange={(e) => setAlloc((a) => ({ ...a, [c.id]: e.target.value }))} aria-invalid={(alloc[c.id] ?? "") !== "" && parseMoney(alloc[c.id]) === null} />
                      {changed && <p className="text-caption num mt-0.5 text-right text-muted-foreground">was {app.money(original.originalAmount)}</p>}
                    </div>
                  </div>
                )
              })}
            </fieldset>

            <div className={cn("rounded-lg p-3 text-sm num", over ? "bg-destructive-soft text-destructive" : "bg-muted")} role={over ? "alert" : undefined}>
              <div className="flex justify-between"><span>Allocated</span><strong>{app.money(allocMinor)}</strong></div>
              <div className="flex justify-between">
                <span>{over ? "Over the limit by" : "Not yet allocated"}</span>
                <strong>{app.money(Math.abs(unallocated))}</strong>
              </div>
              {over && <p className="mt-1">Category allocations can&apos;t exceed the daily limit.</p>}
            </div>

            {error && <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button size="lg" className="tap flex-1" onClick={save} disabled={pending || over || invalidAmounts || closed}>
                <Save aria-hidden /> {budget ? "Update plan" : "Save plan"}
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="tap"
                disabled={pending || over || invalidAmounts}
                onClick={() =>
                  run(async () => {
                    const res = await saveTemplateAction(payload)
                    if (res.ok) notifySuccess("Saved as your daily template")
                    else toast.error(res.message)
                  })
                }
              >
                Save as template
              </Button>
            </div>
            {closed && <p className="text-caption text-muted-foreground">This day is closed. Reopen it below to edit the plan.</p>}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-section">Day review</CardTitle>
              <CardDescription>Planned vs actual for {dayLabel(date, today).toLowerCase()}.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {!budget ? (
                <p className="text-sm text-muted-foreground">Save a plan to see how the day compares.</p>
              ) : (
                <>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ["Planned", app.money(summary.limit ?? 0)],
                      ["Spent", app.money(summary.spent)],
                      ["Unplanned", app.money(summary.unplannedSpent)],
                      [summary.remaining !== null && summary.remaining < 0 ? "Over budget" : "Left", app.money(Math.abs(summary.remaining ?? 0))],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-label text-muted-foreground">{k}</dt>
                        <dd className={cn("num text-value", k === "Over budget" && "text-destructive")}>{v}</dd>
                      </div>
                    ))}
                  </dl>
                  {summary.categories.length > 0 && (
                    <ul className="space-y-1.5 border-t pt-3 text-sm">
                      {summary.categories.map((c) => {
                        const cat = app.categoryById(c.categoryId)
                        return (
                          <li key={c.categoryId} className="flex items-center justify-between gap-2">
                            <span className="truncate">{cat?.name}</span>
                            <span className="num text-muted-foreground">
                              {app.money(c.spent)} / {app.money(c.allocated)}
                              {c.remaining < 0 && <Badge className="ml-2 border-transparent bg-destructive-soft text-destructive">Over budget</Badge>}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                  <Button
                    variant={closed ? "outline" : "default"}
                    className="tap"
                    disabled={pending}
                    onClick={() =>
                      run(async () => {
                        const res = await closeDayAction({ date, closed: !closed })
                        if (res.ok) {
                          notifySuccess(closed ? "Day reopened" : "Day closed — nice work reviewing it")
                          router.refresh()
                        } else toast.error(res.message)
                      })
                    }
                  >
                    {closed ? <LockKeyholeOpen aria-hidden /> : <LockKeyhole aria-hidden />}
                    {closed ? "Reopen day" : "Close the day"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-section">Planned expenses</CardTitle>
              <CardDescription>Things you expect to buy. Tick them off after you record the expense.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {planned.length === 0 ? (
                <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">No planned expenses for this day.</p>
              ) : (
                <ul className="divide-y">
                  {planned.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2">
                      <Checkbox
                        id={`p-${p.id}`}
                        checked={p.status === "completed"}
                        aria-label={`Mark ${p.title} done`}
                        onCheckedChange={(v) =>
                          run(async () => {
                            const res = await setPlannedExpenseStatusAction({ id: p.id, status: v ? "completed" : "planned" })
                            if (!res.ok) toast.error(res.message)
                            else router.refresh()
                          })
                        }
                      />
                      <label htmlFor={`p-${p.id}`} className={cn("min-w-0 flex-1 text-sm", p.status === "completed" && "text-muted-foreground line-through")}>
                        <span className="block truncate font-medium">{p.title}</span>
                        <span className="text-caption text-muted-foreground">{app.categoryById(p.categoryId)?.name}</span>
                      </label>
                      <span className="num text-sm font-medium">{app.money(p.expectedAmount)}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="tap"
                        aria-label={`Remove ${p.title}`}
                        onClick={() =>
                          run(async () => {
                            const res = await deletePlannedExpenseAction({ id: p.id })
                            if (!res.ok) toast.error(res.message)
                            else router.refresh()
                          })
                        }
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="grid gap-2 border-t pt-4 sm:grid-cols-[1fr_7rem]">
                <Input aria-label="Planned expense title" placeholder="e.g. Rickshaw to office" value={pTitle} onChange={(e) => setPTitle(e.target.value)} maxLength={120} className="tap" />
                <Input aria-label="Expected amount" inputMode="decimal" placeholder="Amount" value={pAmount} onChange={(e) => setPAmount(e.target.value)} className="num tap" />
                <SelectField label="Category" className="sm:col-span-2" value={pCat} onChange={setPCat} options={expenseCats.map((c) => ({ value: c.id, label: c.name }))} />
                {pErr && <p role="alert" className="text-caption text-destructive sm:col-span-2">{pErr}</p>}
                <Button variant="secondary" className="tap sm:col-span-2" disabled={pending || !pTitle || !pAmount} onClick={addPlanned}>
                  <Plus aria-hidden /> Add planned expense
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {date === today && (
        <p className="text-sm text-muted-foreground">
          <CalendarCheck className="mr-1 inline size-4" aria-hidden />
          Spent something unplanned? Use <strong>Add Expense</strong> and mark it Unplanned — it&apos;s included in today&apos;s total.{" "}
          <Link href="/transactions" className="underline underline-offset-4">View history</Link>
        </p>
      )}
    </div>
  )
}
