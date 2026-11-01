"use server"

import { revalidatePath } from "next/cache"
import { parseMoney } from "@/shared/domain/money"
import { fail, ok } from "@/shared/domain/result"
import { zonedLocalToInstant } from "@/shared/domain/dates"
import { runAction } from "@/shared/infrastructure/action-runner"
import type { ActionResult } from "@/shared/lib/action-result"
import {
  duplicateSchema,
  exportSchema,
  idSchema,
  transactionFormSchema,
  transferFormSchema,
  updateTransactionSchema,
} from "./forms/schemas"

function instantOrNull(local: string, tz: string) {
  return zonedLocalToInstant(local, tz)?.toISOString() ?? null
}

const refresh = () => revalidatePath("/", "layout")

export async function saveTransactionAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    transactionFormSchema,
    input,
    async (v, { c, profile }) => {
      const occurredAt = instantOrNull(v.occurredAt, profile.timezone)
      if (!occurredAt) return fail("validation", "Enter a valid date and time.", { occurredAt: "Invalid date" })
      const base = {
        accountId: v.accountId,
        categoryId: v.categoryId,
        amount: parseMoney(v.amount)!,
        occurredAt,
        merchant: v.merchant || null,
        note: v.note || null,
      }
      const r =
        v.type === "expense"
          ? await c.transactions.createExpense.execute({ ...base, plannedStatus: v.plannedStatus })
          : await c.transactions.createIncome.execute(base)
      return r.ok ? ok(undefined) : r
    },
    "Saved",
  )
  if (res.ok) refresh()
  return res
}

export async function updateTransactionAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    updateTransactionSchema,
    input,
    async (v, { c, profile }) => {
      const occurredAt = instantOrNull(v.occurredAt, profile.timezone)
      if (!occurredAt) return fail("validation", "Enter a valid date and time.", { occurredAt: "Invalid date" })
      const r = await c.transactions.update.execute(v.id, {
        accountId: v.accountId,
        categoryId: v.categoryId,
        amount: parseMoney(v.amount)!,
        occurredAt,
        merchant: v.merchant || null,
        note: v.note || null,
        plannedStatus: v.type === "expense" ? v.plannedStatus : "unplanned",
      })
      return r.ok ? ok(undefined) : r
    },
    "Transaction updated",
  )
  if (res.ok) refresh()
  return res
}

export async function createTransferAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    transferFormSchema,
    input,
    async (v, { c, profile }) => {
      const occurredAt = instantOrNull(v.occurredAt, profile.timezone)
      if (!occurredAt) return fail("validation", "Enter a valid date and time.", { occurredAt: "Invalid date" })
      const r = await c.transactions.createTransfer.execute({
        fromAccountId: v.fromAccountId,
        toAccountId: v.toAccountId,
        amount: parseMoney(v.amount)!,
        occurredAt,
        note: v.note || null,
      })
      return r.ok ? ok(undefined) : r
    },
    "Transfer recorded",
  )
  if (res.ok) refresh()
  return res
}

export async function deleteTransactionAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    idSchema,
    input,
    async (v, { c }) => {
      const r = await c.transactions.delete.execute(v.id)
      return r.ok ? ok(undefined) : r
    },
    "Deleted",
  )
  if (res.ok) refresh()
  return res
}

export async function duplicateTransactionAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    duplicateSchema,
    input,
    async (v, { c, profile }) => {
      const occurredAt = instantOrNull(v.occurredAt, profile.timezone)
      if (!occurredAt) return fail("validation", "Enter a valid date and time.")
      const r = await c.transactions.duplicate.execute(v.id, occurredAt)
      return r.ok ? ok(undefined) : r
    },
    "Duplicated",
  )
  if (res.ok) refresh()
  return res
}

export async function exportTransactionsAction(input: unknown): Promise<ActionResult<{ csv: string }>> {
  return runAction(exportSchema, input, async (v, { c, profile }) => {
    const r = await c.transactions.export.execute(
      {
        range: v.from && v.to ? { from: v.from, to: v.to } : undefined,
        categoryId: v.categoryId || undefined,
        accountId: v.accountId || undefined,
        plannedStatus: v.plannedStatus,
        search: v.search,
      },
      profile.timezone,
    )
    return r.ok ? ok({ csv: r.value }) : r
  })
}
