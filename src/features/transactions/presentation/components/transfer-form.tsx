"use client"

import { SelectField } from "@/components/layout/select-field"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/components/layout/app-context"
import { instantToZonedLocal } from "@/shared/domain/dates"
import { createTransferAction } from "../actions"
import { transferFormSchema, type TransferFormInput } from "../forms/schemas"

export function TransferForm({ onDone }: { onDone: () => void }) {
  const app = useApp()
  const active = app.accounts.filter((a) => !a.isArchived)
  const [formError, setFormError] = useState<string | null>(null)
  const form = useForm<TransferFormInput, unknown, TransferFormInput>({
    resolver: zodResolver(transferFormSchema),
    defaultValues: {
      fromAccountId: active[0]?.id ?? "",
      toAccountId: active[1]?.id ?? "",
      amount: "",
      occurredAt: instantToZonedLocal(new Date(), app.timezone),
      note: "",
    },
  })
  const { register, handleSubmit, setError, watch, setValue, formState } = form
  const err = formState.errors

  async function onSubmit(values: TransferFormInput) {
    setFormError(null)
    const res = await createTransferAction(values)
    if (res.ok) {
      toast.success("Transfer recorded — it doesn't count as income or spending")
      onDone()
      return
    }
    setFormError(res.message)
    for (const [f, message] of Object.entries(res.fieldErrors ?? {})) setError(f as keyof TransferFormInput, { message })
  }

  if (active.length < 2) {
    return <p className="text-sm text-muted-foreground">Add a second account in Settings to move money between your accounts.</p>
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <p className="text-sm text-muted-foreground">
        Moves money between your own accounts. Transfers never count as income or spending.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="t-amount">Amount</Label>
        <Input id="t-amount" inputMode="decimal" autoComplete="off" placeholder="0" className="num h-14 text-2xl font-semibold" aria-invalid={!!err.amount} {...register("amount")} />
        {err.amount && <p role="alert" className="text-caption text-destructive">{err.amount.message}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(["fromAccountId", "toAccountId"] as const).map((f) => (
          <div key={f} className="flex flex-col gap-1.5">
            <Label htmlFor={f}>{f === "fromAccountId" ? "From" : "To"}</Label>
            <SelectField id={f} value={watch(f)} onChange={(v) => setValue(f, v, { shouldValidate: true })} options={active.map((a) => ({ value: a.id, label: a.name }))} />
            {err[f] && <p role="alert" className="text-caption text-destructive">{err[f]?.message}</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="t-when">Date &amp; time</Label>
        <Input id="t-when" type="datetime-local" className="tap" {...register("occurredAt")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="t-note">Note <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="t-note" maxLength={500} {...register("note")} />
      </div>
      {formError && <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{formError}</p>}
      <Button type="submit" size="lg" disabled={formState.isSubmitting} className="tap w-full text-base">
        {formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
        Record transfer
      </Button>
    </form>
  )
}
