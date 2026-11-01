"use client"

import { SelectField } from "@/components/layout/select-field"
import { useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useApp } from "@/components/layout/app-context"
import { CategoryIcon } from "@/components/layout/category-icon"
import { Segmented } from "@/components/layout/segmented"
import { instantToZonedLocal } from "@/shared/domain/dates"
import { toDecimalString } from "@/shared/domain/money"
import type { Transaction } from "../../domain/entities/transaction"
import { saveTransactionAction, updateTransactionAction } from "../actions"
import { transactionFormSchema, type TransactionFormInput, type TransactionFormValues } from "../forms/schemas"

export function TransactionForm({
  type,
  initial,
  onDone,
}: {
  type: "expense" | "income"
  initial?: Transaction
  onDone: () => void
}) {
  const app = useApp()
  const [formError, setFormError] = useState<string | null>(null)
  const editing = Boolean(initial)

  const defaults = useMemo<TransactionFormInput>(
    () => ({
      type: initial && (initial.type === "income" || initial.type === "expense") ? initial.type : type,
      amount: initial ? toDecimalString(initial.amount, true) : "",
      categoryId: initial?.categoryId ?? "",
      accountId: initial?.accountId ?? app.accounts.find((a) => !a.isArchived)?.id ?? "",
      occurredAt: instantToZonedLocal(initial?.occurredAt ?? new Date(), app.timezone),
      plannedStatus: initial?.plannedStatus ?? "unplanned",
      merchant: initial?.merchant ?? "",
      note: initial?.note ?? "",
    }),
    [initial, type, app.accounts, app.timezone],
  )

  const form = useForm<TransactionFormInput, unknown, TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: defaults,
  })
  const { register, handleSubmit, setValue, watch, setError, formState } = form
  const kind = watch("type")
  const categoryId = watch("categoryId")
  const planned = watch("plannedStatus")
  const categories = app.categories.filter((c) => c.type === kind && (!c.isArchived || c.id === initial?.categoryId))
  const submitting = formState.isSubmitting

  async function onSubmit(values: TransactionFormValues) {
    setFormError(null)
    const res = initial
      ? await updateTransactionAction({ ...values, id: initial.id })
      : await saveTransactionAction(values)
    if (res.ok) {
      toast.success(kind === "expense" ? (editing ? "Expense updated" : "Expense saved") : editing ? "Income updated" : "Income saved")
      onDone()
      return
    }
    setFormError(res.message)
    for (const [field, message] of Object.entries(res.fieldErrors ?? {})) {
      setError(field as keyof TransactionFormInput, { message })
    }
  }

  const err = formState.errors
  const label = kind === "expense" ? "Expense" : "Income"

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5" aria-busy={submitting}>
      {!editing && (
        <Segmented
          label="Transaction type"
          value={kind}
          onChange={(v) => {
            setValue("type", v)
            setValue("categoryId", "")
          }}
          options={[
            { value: "expense", label: "Expense" },
            { value: "income", label: "Income" },
          ]}
        />
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="amount">Amount <span className="text-muted-foreground">(required)</span></Label>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl font-semibold text-muted-foreground">
            {app.money(0).replace(/[0-9.,]/g, "")}
          </span>
          <Input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            placeholder="0"
            aria-invalid={!!err.amount}
            aria-describedby={err.amount ? "amount-err" : undefined}
            className="num h-14 pl-9 text-2xl font-semibold"
            {...register("amount")}
          />
        </div>
        {err.amount && <p id="amount-err" role="alert" className="text-caption text-destructive">{err.amount.message}</p>}
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-label mb-1">Category <span className="text-muted-foreground">(required)</span></legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoryId === c.id}
              onClick={() => setValue("categoryId", c.id, { shouldValidate: true })}
              className={cn(
                "tap flex items-center gap-2 rounded-lg border px-3 text-left text-sm font-medium transition-colors",
                categoryId === c.id ? "border-primary bg-accent text-accent-foreground ring-1 ring-primary" : "hover:bg-muted",
              )}
            >
              <CategoryIcon name={c.icon} color={c.color} className="size-4 shrink-0" />
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
        {err.categoryId && <p role="alert" className="text-caption text-destructive">{err.categoryId.message}</p>}
      </fieldset>

      {kind === "expense" && (
        <div className="flex flex-col gap-1.5">
          <Label>Was this planned?</Label>
          <Segmented
            label="Planned or unplanned"
            value={planned}
            onChange={(v) => setValue("plannedStatus", v)}
            options={[
              { value: "planned", label: "Planned" },
              { value: "unplanned", label: "Unplanned" },
            ]}
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="accountId">{kind === "expense" ? "Paid from" : "Deposit to"}</Label>
          <SelectField
            id="accountId"
            value={watch("accountId")}
            onChange={(v) => setValue("accountId", v, { shouldValidate: true })}
            invalid={!!err.accountId}
            options={app.accounts.filter((a) => !a.isArchived || a.id === initial?.accountId).map((a) => ({ value: a.id, label: a.name }))}
          />
          {err.accountId && <p role="alert" className="text-caption text-destructive">{err.accountId.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="occurredAt">Date &amp; time</Label>
          <Input id="occurredAt" type="datetime-local" className="tap" aria-invalid={!!err.occurredAt} {...register("occurredAt")} />
          {err.occurredAt && <p role="alert" className="text-caption text-destructive">{err.occurredAt.message}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="merchant">Title / merchant <span className="text-muted-foreground">(optional)</span></Label>
        <Input id="merchant" autoComplete="off" maxLength={120} placeholder={kind === "expense" ? "e.g. Lunch at Star Kabab" : "e.g. March salary"} {...register("merchant")} />
        {err.merchant && <p role="alert" className="text-caption text-destructive">{err.merchant.message}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="note">Note <span className="text-muted-foreground">(optional)</span></Label>
        <Textarea id="note" rows={2} maxLength={500} {...register("note")} />
        {err.note && <p role="alert" className="text-caption text-destructive">{err.note.message}</p>}
      </div>

      {formError && (
        <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">
          {formError}
        </p>
      )}

      <div className="sticky bottom-0 -mx-1 bg-background/95 px-1 pb-1 pt-2 backdrop-blur">
        <Button type="submit" size="lg" disabled={submitting} className="tap w-full text-base">
          {submitting && <Loader2 className="animate-spin" aria-hidden />}
          {editing ? `Save changes` : `Save ${label}`}
        </Button>
      </div>
    </form>
  )
}
