"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { getAuthGateway } from "@/shared/infrastructure/container"
import type { ActionResult } from "@/shared/lib/action-result"
import { emailSchema, resetPasswordSchema, signInSchema, signUpSchema } from "./schemas"

function fieldErrors(error: z.ZodError) {
  const f: Record<string, string> = {}
  for (const i of error.issues) f[String(i.path[0] ?? "form")] ??= i.message
  return f
}

export async function signInAction(input: unknown): Promise<ActionResult> {
  const p = signInSchema.safeParse(input)
  if (!p.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(p.error) }
  const r = await (await getAuthGateway()).signIn(p.data)
  if (!r.ok) return { ok: false, message: r.error.message }
  redirect("/")
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const p = signUpSchema.safeParse(input)
  if (!p.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(p.error) }
  const r = await (await getAuthGateway()).signUp(p.data)
  if (!r.ok) return { ok: false, message: r.error.message }
  if (r.value === "signed_in") redirect("/")
  return { ok: true, data: { needsConfirmation: true } }
}

export async function requestPasswordResetAction(input: unknown): Promise<ActionResult> {
  const p = z.object({ email: emailSchema }).safeParse(input)
  if (!p.success) return { ok: false, message: "Enter a valid email.", fieldErrors: fieldErrors(p.error) }
  const r = await (await getAuthGateway()).requestPasswordReset(p.data.email)
  if (!r.ok) return { ok: false, message: r.error.message }
  return { ok: true, message: "If an account exists for that email, a reset link is on its way." }
}

export async function updatePasswordAction(input: unknown): Promise<ActionResult> {
  const p = resetPasswordSchema.safeParse(input)
  if (!p.success) return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: fieldErrors(p.error) }
  const r = await (await getAuthGateway()).updatePassword(p.data.password)
  if (!r.ok) return { ok: false, message: r.error.message }
  redirect("/")
}

