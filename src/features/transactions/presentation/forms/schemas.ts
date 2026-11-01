import { z } from "zod"
import { parseMoney } from "@/shared/domain/money"

export const amountField = z
  .string()
  .trim()
  .min(1, "Enter an amount")
  .refine((v) => {
    const m = parseMoney(v)
    return m !== null && m > 0
  }, "Enter an amount greater than zero (max 2 decimals)")

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `Keep it under ${max} characters`)
    .optional()
    .transform((v) => v ?? "")

export const transactionFormSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: amountField,
  categoryId: z.string().min(1, "Choose a category"),
  accountId: z.string().min(1, "Choose an account"),
  occurredAt: z.string().min(1, "Choose a date and time"),
  plannedStatus: z.enum(["planned", "unplanned"]),
  merchant: optionalText(120),
  note: optionalText(500),
})
export type TransactionFormInput = z.input<typeof transactionFormSchema>
export type TransactionFormValues = z.output<typeof transactionFormSchema>

export const transferFormSchema = z
  .object({
    fromAccountId: z.string().min(1, "Choose the source account"),
    toAccountId: z.string().min(1, "Choose the destination account"),
    amount: amountField,
    occurredAt: z.string().min(1, "Choose a date and time"),
    note: optionalText(500),
  })
  .refine((v) => v.fromAccountId !== v.toAccountId, { message: "Choose two different accounts", path: ["toAccountId"] })
export type TransferFormInput = z.input<typeof transferFormSchema>

export const idSchema = z.object({ id: z.string().min(1) })

export const updateTransactionSchema = transactionFormSchema.extend({ id: z.string().min(1) })

export const duplicateSchema = z.object({ id: z.string().min(1), occurredAt: z.string().min(1) })

export const exportSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  categoryId: z.string().optional(),
  accountId: z.string().optional(),
  plannedStatus: z.enum(["planned", "unplanned"]).optional(),
  search: z.string().max(100).optional(),
})
