import { z } from "zod"
import { amountField } from "@/features/transactions/presentation/forms/schemas"

export const personTransferFormSchema = z.object({
  direction: z.enum(["out", "in"]),
  payeeName: z.string().trim().min(1, "Who is it with? Enter a name").max(80, "Name is too long (80 max)"),
  amount: amountField,
  accountId: z.string().min(1, "Choose an account"),
  occurredAt: z.string().min(1, "Choose a date and time"),
  note: z
    .string()
    .max(500, "Keep it under 500 characters")
    .optional()
    .transform((v) => v ?? ""),
  /** Path of an already-uploaded proof image (see uploadProofAction). */
  receiptPath: z.string().max(200).nullable().optional(),
})
export type PersonTransferFormInput = z.input<typeof personTransferFormSchema>
export type PersonTransferFormValues = z.output<typeof personTransferFormSchema>

export const updatePersonTransferSchema = personTransferFormSchema.extend({ id: z.string().min(1) })

export const pathSchema = z.object({ path: z.string().min(1).max(200) })
