"use client"

import { useMemo, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useApp } from "@/components/layout/app-context"
import { Segmented } from "@/components/layout/segmented"
import { SelectField } from "@/components/layout/select-field"
import { instantToZonedLocal } from "@/shared/domain/dates"
import { toDecimalString } from "@/shared/domain/money"
import type { Transaction } from "@/features/transactions/domain/entities/transaction"
import { recordPersonTransferAction, updatePersonTransferAction } from "../actions"
import {
  personTransferFormSchema,
  type PersonTransferFormInput,
  type PersonTransferFormValues,
} from "../forms/schemas"
import { ProofUpload } from "./proof-upload"

export function PersonTransferForm({ initial, onDone }: { initial?: Transaction; onDone: () => void }) {
  const app = useApp()
  const [formError, setFormError] = useState<string | null>(null)
  const saved = useRef(false)
  const editing = Boolean(initial)
  const active = app.accounts.filter((a) => !a.isArchived || a.id === initial?.accountId)

  const defaults = useMemo<PersonTransferFormInput>(
    () => ({
      direction: initial?.transferDirection === "in" ? "in" : "out",
      payeeName: app.payeeById(initial?.payeeId ?? null)?.name ?? "",
      amount: initial ? toDecimalString(initial.amount, true) : "",
      accountId: initial?.accountId ?? active[0]?.id ?? "",
      occurredAt: instantToZonedLocal(initial?.occurredAt ?? new Date(), app.timezone),
      note: initial?.note ?? "",
      receiptPath: initial?.receiptPath ?? null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initial, app.timezone],
  )

  const form = useForm<PersonTransferFormInput, unknown, PersonTransferFormValues>({
    resolver: zodResolver(personTransferFormSchema),
    defaultValues: defaults,
  })
  const { register, handleSubmit, setValue, watch, setError, formState } = form
  const err = formState.errors
  const direction = watch("direction")
  const payeeName = watch("payeeName") ?? ""
  const receiptPath = watch("receiptPath") ?? null

  const suggestions = useMemo(() => {
    const q = payeeName.trim().toLowerCase()
    return app.payees
      .filter((p) => !p.isArchived && (!q || p.name.toLowerCase().includes(q)) && p.name.toLowerCase() !== q)
      .slice(0, 6)
  }, [app.payees, payeeName])

  async function onSubmit(values: PersonTransferFormValues) {
    setFormError(null)
    const res = initial
      ? await updatePersonTransferAction({ ...values, id: initial.id, receiptPath: values.receiptPath ?? null })
      : await recordPersonTransferAction(values)
    if (res.ok) {
      saved.current = true
      toast.success(editing ? "Transfer updated" : direction === "out" ? "Sent money recorded" : "Received money recorded")
      onDone()
      return
    }
    setFormError(res.message)
    for (const [field, message] of Object.entries(res.fieldErrors ?? {})) setError(field as keyof PersonTransferFormInput, { message })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5" aria-busy={formState.isSubmitting}>
      <p className="text-sm text-muted-foreground">
        Money sent to or received from a person. It changes your balance and is tracked on the Transfers screen — it isn&apos;t counted as an expense or income.
      </p>

      <Segmented
        label="Direction"
        value={direction}
        onChange={(v) => setValue("direction", v)}
        options={[
          { value: "out", label: "I sent" },
          { value: "in", label: "I received" },
        ]}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-amount">Amount <span className="text-muted-foreground">(required)</span></Label>
        <Input id="pt-amount" inputMode="decimal" autoComplete="off" autoFocus={!editing} placeholder="0" aria-invalid={!!err.amount} className="num h-14 text-2xl font-semibold" {...register("amount")} />
        {err.amount && <p role="alert" className="text-caption text-destructive">{err.amount.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-person">{direction === "out" ? "Sent to" : "Received from"} <span className="text-muted-foreground">(required)</span></Label>
        <Input id="pt-person" autoComplete="off" maxLength={80} placeholder="Person's name" aria-invalid={!!err.payeeName} {...register("payeeName")} />
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2" role="group" aria-label="Previous people">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setValue("payeeName", p.name, { shouldValidate: true })}
                className="tap rounded-full border px-4 text-sm font-medium transition-colors hover:bg-muted"
              >
                {p.name}
              </button>
            ))}
          </div>
        )}
        {err.payeeName && <p role="alert" className="text-caption text-destructive">{err.payeeName.message}</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pt-account">{direction === "out" ? "Paid from" : "Deposited to"}</Label>
          <SelectField
            id="pt-account"
            value={watch("accountId")}
            onChange={(v) => setValue("accountId", v, { shouldValidate: true })}
            invalid={!!err.accountId}
            options={active.map((a) => ({ value: a.id, label: a.name }))}
          />
          {err.accountId && <p role="alert" className="text-caption text-destructive">{err.accountId.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pt-when">Date &amp; time</Label>
          <Input id="pt-when" type="datetime-local" className="tap" aria-invalid={!!err.occurredAt} {...register("occurredAt")} />
          {err.occurredAt && <p role="alert" className="text-caption text-destructive">{err.occurredAt.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pt-note">Note <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="pt-note" rows={2} maxLength={500} placeholder="e.g. Loan, bKash reference, rent share…" {...register("note")} />
        {err.note && <p role="alert" className="text-caption text-destructive">{err.note.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Proof</Label>
        <ProofUpload value={receiptPath} savedRef={saved} onChange={(p) => setValue("receiptPath", p)} />
      </div>

      {formError && <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{formError}</p>}

      <div className="sticky bottom-0 -mx-1 bg-background/95 px-1 pb-1 pt-2 backdrop-blur">
        <Button type="submit" size="lg" disabled={formState.isSubmitting} className="tap w-full text-base">
          {formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? "Save changes" : direction === "out" ? "Save sent transfer" : "Save received transfer"}
        </Button>
      </div>
    </form>
  )
}
