"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { parseMoney } from "@/shared/domain/money"
import { ok } from "@/shared/domain/result"
import { isValidLocalDate } from "@/shared/domain/dates"
import { runAction } from "@/shared/infrastructure/action-runner"
import type { ActionResult } from "@/shared/lib/action-result"
import type { BudgetTemplate } from "../domain/entities/budget"

const moneyOrEmpty = z
  .string()
  .trim()
  .refine((v) => v === "" || parseMoney(v) !== null, "Enter a valid amount")

const planSchema = z.object({
  date: z.string().refine(isValidLocalDate, "Invalid date"),
  totalLimit: moneyOrEmpty,
  notes: z.string().max(500).optional(),
  allocations: z.array(z.object({ categoryId: z.string().min(1), amount: moneyOrEmpty })).max(100),
})

const refresh = () => revalidatePath("/", "layout")

export async function savePlanAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    planSchema,
    input,
    async (v, { c }) => {
      const r = await c.budgets.save.execute({
        date: v.date,
        totalLimit: parseMoney(v.totalLimit || "0") ?? 0,
        notes: v.notes,
        allocations: v.allocations.map((a) => ({ categoryId: a.categoryId, amount: parseMoney(a.amount || "0") ?? 0 })),
      })
      return r.ok ? ok(undefined) : r
    },
    "Plan saved",
  )
  if (res.ok) refresh()
  return res
}

const dateSchema = z.object({ date: z.string().refine(isValidLocalDate, "Invalid date") })

export async function copyPlanAction(input: unknown): Promise<ActionResult<BudgetTemplate>> {
  return runAction(
    dateSchema.extend({ source: z.enum(["yesterday", "template"]) }),
    input,
    (v, { c }) => c.budgets.copy.execute(v.date, v.source),
  )
}

export async function saveTemplateAction(input: unknown): Promise<ActionResult> {
  return runAction(
    planSchema,
    input,
    async (v, { c }) => {
      const r = await c.budgets.saveTemplate.execute({
        totalLimit: parseMoney(v.totalLimit || "0") ?? 0,
        allocations: v.allocations
          .map((a) => ({ categoryId: a.categoryId, amount: parseMoney(a.amount || "0") ?? 0 }))
          .filter((a) => a.amount > 0),
      })
      return r.ok ? ok(undefined) : r
    },
    "Saved as your daily template",
  )
}

export async function closeDayAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    dateSchema.extend({ closed: z.boolean() }),
    input,
    async (v, { c }) => {
      const r = await c.budgets.close.execute(v.date, v.closed)
      return r.ok ? ok(undefined) : r
    },
  )
  if (res.ok) refresh()
  return res
}

const plannedSchema = z.object({
  date: z.string().refine(isValidLocalDate, "Invalid date"),
  categoryId: z.string().min(1, "Choose a category"),
  title: z.string().trim().min(1, "Enter a title").max(120),
  amount: z.string().trim().refine((v) => (parseMoney(v) ?? 0) > 0, "Enter an amount greater than zero"),
})

export async function addPlannedExpenseAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    plannedSchema,
    input,
    async (v, { c }) => {
      const r = await c.budgets.planned.add({
        date: v.date,
        categoryId: v.categoryId,
        title: v.title,
        expectedAmount: parseMoney(v.amount)!,
      })
      return r.ok ? ok(undefined) : r
    },
    "Planned expense added",
  )
  if (res.ok) refresh()
  return res
}

export async function setPlannedExpenseStatusAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    z.object({ id: z.string().min(1), status: z.enum(["planned", "completed", "skipped"]) }),
    input,
    async (v, { c }) => {
      const r = await c.budgets.planned.setStatus(v.id, v.status)
      return r.ok ? ok(undefined) : r
    },
  )
  if (res.ok) refresh()
  return res
}

export async function deletePlannedExpenseAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(z.object({ id: z.string().min(1) }), input, async (v, { c }) => {
    const r = await c.budgets.planned.remove(v.id)
    return r.ok ? ok(undefined) : r
  })
  if (res.ok) refresh()
  return res
}

