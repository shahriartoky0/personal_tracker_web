"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { parseMoney } from "@/shared/domain/money"
import { fail, ok } from "@/shared/domain/result"
import { zonedLocalToInstant } from "@/shared/domain/dates"
import { runAction } from "@/shared/infrastructure/action-runner"
import type { ActionResult } from "@/shared/lib/action-result"
import { pathSchema, personTransferFormSchema, updatePersonTransferSchema } from "./forms/schemas"

const refresh = () => revalidatePath("/", "layout")

export async function recordPersonTransferAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    personTransferFormSchema,
    input,
    async (v, { c, profile }) => {
      const at = zonedLocalToInstant(v.occurredAt, profile.timezone)
      if (!at) return fail("validation", "Enter a valid date and time.", { occurredAt: "Invalid date" })
      const r = await c.transfers.record.execute({
        accountId: v.accountId,
        payeeName: v.payeeName,
        direction: v.direction,
        amount: parseMoney(v.amount)!,
        occurredAt: at.toISOString(),
        note: v.note || null,
        receiptPath: v.receiptPath ?? null,
      })
      return r.ok ? ok(undefined) : r
    },
    "Transfer recorded",
  )
  if (res.ok) refresh()
  return res
}

export async function updatePersonTransferAction(input: unknown): Promise<ActionResult> {
  const res = await runAction(
    updatePersonTransferSchema,
    input,
    async (v, { c, profile }) => {
      const at = zonedLocalToInstant(v.occurredAt, profile.timezone)
      if (!at) return fail("validation", "Enter a valid date and time.", { occurredAt: "Invalid date" })
      const r = await c.transfers.update.execute(v.id, {
        accountId: v.accountId,
        payeeName: v.payeeName,
        direction: v.direction,
        amount: parseMoney(v.amount)!,
        occurredAt: at.toISOString(),
        note: v.note || null,
        // undefined = keep, null = remove, string = replace
        receiptPath: v.receiptPath === undefined ? undefined : v.receiptPath,
      })
      return r.ok ? ok(undefined) : r
    },
    "Transfer updated",
  )
  if (res.ok) refresh()
  return res
}

/** Receives an already-compressed image as FormData and stores it privately; returns its path. */
export async function uploadProofAction(formData: FormData): Promise<ActionResult<{ path: string }>> {
  return runAction(
    z.custom<FormData>((v) => v instanceof FormData),
    formData,
    async (data, { c }) => {
      const file = data.get("file")
      if (!(file instanceof File)) return fail("validation", "Choose an image to upload.")
      return c.transfers.uploadProof.execute({ bytes: await file.arrayBuffer(), contentType: file.type, size: file.size })
    },
  )
}

export async function removeProofAction(input: unknown): Promise<ActionResult> {
  return runAction(pathSchema, input, async (v, { c }) => {
    const r = await c.transfers.removeProof.execute(v.path)
    return r.ok ? ok(undefined) : r
  })
}

/** A 2-minute signed URL for viewing a private proof. */
export async function getProofUrlAction(input: unknown): Promise<ActionResult<{ url: string }>> {
  return runAction(pathSchema, input, (v, { c }) => c.transfers.proofUrl.execute(v.path))
}
