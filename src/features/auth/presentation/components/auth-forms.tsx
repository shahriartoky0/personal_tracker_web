"use client"

import { useState } from "react"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, MailCheck } from "lucide-react"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/shared/lib/action-result"
import { emailSchema, resetPasswordSchema, signInSchema, signUpSchema } from "../schemas"
import { requestPasswordResetAction, signInAction, signUpAction, updatePasswordAction } from "../actions"

const emailObj = z.object({ email: emailSchema })

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && <p id={`${id}-err`} role="alert" className="text-caption text-destructive">{error}</p>}
    </div>
  )
}

function FormError({ message }: { message: string | null }) {
  return message ? <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{message}</p> : null
}

function Submit({ busy, children }: { busy: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" size="lg" disabled={busy} className="tap w-full text-base">
      {busy && <Loader2 className="animate-spin" aria-hidden />} {children}
    </Button>
  )
}

function apply<T extends Record<string, unknown>>(res: ActionResult<unknown>, setError: (k: keyof T & string, v: { message: string }) => void, setMsg: (m: string) => void) {
  if (res.ok) return
  setMsg(res.message)
  for (const [k, message] of Object.entries(res.fieldErrors ?? {})) setError(k as keyof T & string, { message })
}

export function SignInForm() {
  type V = z.input<typeof signInSchema>
  const [msg, setMsg] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<V>({ resolver: zodResolver(signInSchema) })
  const e = formState.errors
  return (
    <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => { setMsg(null); const res = await signInAction(v); if (res) apply<V>(res, setError, setMsg) })}>
      <Field id="email" label="Email" error={e.email?.message}><Input id="email" type="email" autoComplete="email" inputMode="email" className="tap" aria-invalid={!!e.email} {...register("email")} /></Field>
      <Field id="password" label="Password" error={e.password?.message}><Input id="password" type="password" autoComplete="current-password" className="tap" aria-invalid={!!e.password} {...register("password")} /></Field>
      <FormError message={msg} />
      <Submit busy={formState.isSubmitting}>Sign in</Submit>
      <div className="flex justify-between text-sm">
        <Link href="/forgot-password" className="underline underline-offset-4">Forgot password?</Link>
        <Link href="/signup" className="underline underline-offset-4">Create an account</Link>
      </div>
    </form>
  )
}

export function SignUpForm() {
  type V = z.input<typeof signUpSchema>
  const [msg, setMsg] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)
  const { register, handleSubmit, setError, getValues, formState } = useForm<V>({ resolver: zodResolver(signUpSchema) })
  const e = formState.errors
  if (sent)
    return (
      <div role="status" className="grid gap-3 text-center">
        <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
        <h2 className="text-section">Check your inbox</h2>
        <p className="text-sm text-muted-foreground">We sent a confirmation link to <strong>{sent}</strong>. Open it on this device to finish creating your account.</p>
        <Link href="/login" className="text-sm underline underline-offset-4">Back to sign in</Link>
      </div>
    )
  return (
    <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => {
      setMsg(null)
      const res = await signUpAction(v)
      if (res?.ok && res.data?.needsConfirmation) setSent(getValues("email"))
      else if (res) apply<V>(res, setError, setMsg)
    })}>
      <Field id="displayName" label="Your name" error={e.displayName?.message}><Input id="displayName" autoComplete="name" className="tap" aria-invalid={!!e.displayName} {...register("displayName")} /></Field>
      <Field id="email" label="Email" error={e.email?.message}><Input id="email" type="email" autoComplete="email" inputMode="email" className="tap" aria-invalid={!!e.email} {...register("email")} /></Field>
      <Field id="password" label="Password" error={e.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" className="tap" aria-describedby="pw-hint" aria-invalid={!!e.password} {...register("password")} />
        <p id="pw-hint" className="text-caption text-muted-foreground">At least 8 characters with a letter and a number.</p>
      </Field>
      <FormError message={msg} />
      <Submit busy={formState.isSubmitting}>Create account</Submit>
      <p className="text-center text-sm">Already have an account? <Link href="/login" className="underline underline-offset-4">Sign in</Link></p>
    </form>
  )
}

export function ForgotPasswordForm() {
  type V = { email: string }
  const [msg, setMsg] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<V>({ resolver: zodResolver(emailObj) })
  if (done)
    return (
      <div role="status" className="grid gap-3 text-center">
        <MailCheck className="mx-auto size-10 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{done}</p>
        <Link href="/login" className="text-sm underline underline-offset-4">Back to sign in</Link>
      </div>
    )
  return (
    <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => {
      setMsg(null)
      const res = await requestPasswordResetAction(v)
      if (res.ok) setDone(res.message ?? "Check your email.")
      else apply<V>(res, setError, setMsg)
    })}>
      <Field id="email" label="Email" error={formState.errors.email?.message}><Input id="email" type="email" autoComplete="email" inputMode="email" className="tap" {...register("email")} /></Field>
      <FormError message={msg} />
      <Submit busy={formState.isSubmitting}>Send reset link</Submit>
      <Link href="/login" className="text-center text-sm underline underline-offset-4">Back to sign in</Link>
    </form>
  )
}

export function ResetPasswordForm() {
  type V = z.input<typeof resetPasswordSchema>
  const [msg, setMsg] = useState<string | null>(null)
  const { register, handleSubmit, setError, formState } = useForm<V>({ resolver: zodResolver(resetPasswordSchema) })
  const e = formState.errors
  return (
    <form noValidate className="grid gap-4" onSubmit={handleSubmit(async (v) => { setMsg(null); const res = await updatePasswordAction(v); if (res) apply<V>(res, setError, setMsg) })}>
      <Field id="password" label="New password" error={e.password?.message}><Input id="password" type="password" autoComplete="new-password" className="tap" aria-invalid={!!e.password} {...register("password")} /></Field>
      <Field id="confirm" label="Confirm new password" error={e.confirm?.message}><Input id="confirm" type="password" autoComplete="new-password" className="tap" aria-invalid={!!e.confirm} {...register("confirm")} /></Field>
      <FormError message={msg} />
      <Submit busy={formState.isSubmitting}>Update password</Submit>
    </form>
  )
}
