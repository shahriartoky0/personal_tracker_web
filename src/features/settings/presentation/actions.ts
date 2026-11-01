"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { parseMoney } from "@/shared/domain/money"
import { ok } from "@/shared/domain/result"
import { ACCOUNT_TYPES } from "@/features/accounts/domain/entities/account"
import { runAction } from "@/shared/infrastructure/action-runner"
import { getContainer } from "@/shared/infrastructure/container"
import type { ActionResult } from "@/shared/lib/action-result"

const refresh = () => revalidatePath("/", "layout")

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    z.object({
      displayName: z.string().trim().max(80, "Name is too long"),
      currency: z.string().length(3),
      timezone: z.string().min(1),
    }),
    input,
    async (v, { c }) => {
      const r = await c.settings.updateProfile.execute(v)
      return r.ok ? ok(undefined) : r
    },
    "Profile saved",
  )
  if (res.ok) refresh()
  return res
}

export async function saveReminderAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    z.object({
      type: z.enum(["plan_day", "close_day", "budget_threshold"]),
      enabled: z.boolean(),
      time: z.string().nullable(),
      thresholdPercent: z.number().int().nullable(),
    }),
    input,
    async (v, { c }) => {
      const r = await c.settings.reminders.save(v)
      return r.ok ? ok(undefined) : r
    },
  )
  if (res.ok) refresh()
  return res
}

const accountSchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(80),
  type: z.enum(ACCOUNT_TYPES),
  openingBalance: z.string().trim().refine((v) => v === "" || parseMoney(v) !== null, "Enter a valid amount"),
})

export async function createAccountAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    accountSchema,
    input,
    async (v, { c }) => {
      const r = await c.accounts.create.execute({
        name: v.name,
        type: v.type,
        openingBalance: parseMoney(v.openingBalance || "0") ?? 0,
      })
      return r.ok ? ok(undefined) : r
    },
    "Account added",
  )
  if (res.ok) refresh()
  return res
}

export async function updateAccountAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    accountSchema.partial().extend({ id: z.string().min(1), isArchived: z.boolean().optional() }),
    input,
    async (v, { c }) => {
      const r = await c.accounts.update.execute(v.id, {
        name: v.name,
        type: v.type,
        openingBalance: v.openingBalance === undefined ? undefined : (parseMoney(v.openingBalance || "0") ?? 0),
        isArchived: v.isArchived,
      })
      return r.ok ? ok(undefined) : r
    },
    "Account updated",
  )
  if (res.ok) refresh()
  return res
}

const categorySchema = z.object({
  name: z.string().trim().min(1, "Enter a name").max(60),
  type: z.enum(["income", "expense"]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour").optional(),
})

export async function createCategoryAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    categorySchema,
    input,
    async (v, { c }) => {
      const r = await c.categories.create.execute(v)
      return r.ok ? ok(undefined) : r
    },
    "Category added",
  )
  if (res.ok) refresh()
  return res
}

export async function updateCategoryAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    categorySchema.partial().extend({ id: z.string().min(1), isArchived: z.boolean().optional() }),
    input,
    async (v, { c }) => {
      const r = await c.categories.update.execute(v.id, { name: v.name, color: v.color, isArchived: v.isArchived })
      return r.ok ? ok(undefined) : r
    },
    "Category updated",
  )
  if (res.ok) refresh()
  return res
}

export async function deleteAllDataAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    z.object({ confirm: z.literal("DELETE") }),
    input,
    async (_v, { c }) => {
      const r = await c.settings.deleteAllData.execute()
      return r.ok ? ok(undefined) : r
    },
    "All transactions and plans were deleted",
  )
  if (res.ok) refresh()
  return res
}

export async function deleteAccountAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(z.object({ confirm: z.literal("DELETE") }), input, async (_v, { c }) => c.auth.deleteAccount())
  if (res.ok) redirect("/login")
  return res
}

export async function signOutAction() {
  const c = await getContainer()
  if (c) await c.auth.signOut()
  redirect("/login")
}
