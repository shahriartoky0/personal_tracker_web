import type { Minor } from "@/shared/domain/money"
import type { Instant } from "@/shared/domain/dates"

export type TransactionType = "income" | "expense" | "transfer"
export type PlannedStatus = "planned" | "unplanned"
export type TransferDirection = "in" | "out"

export interface Transaction {
  id: string
  accountId: string
  categoryId: string | null
  type: TransactionType
  transferDirection: TransferDirection | null
  transferGroupId: string | null
  /** Always positive; the sign is implied by `type` / `transferDirection`. */
  amount: Minor
  occurredAt: Instant
  merchant: string | null
  note: string | null
  plannedStatus: PlannedStatus
  receiptPath: string | null
}

export interface NewTransaction {
  accountId: string
  categoryId: string
  type: "income" | "expense"
  amount: Minor
  occurredAt: Instant
  merchant?: string | null
  note?: string | null
  plannedStatus?: PlannedStatus
  receiptPath?: string | null
}

export interface NewTransfer {
  fromAccountId: string
  toAccountId: string
  amount: Minor
  occurredAt: Instant
  note?: string | null
}

export type TransactionPatch = Partial<
  Pick<Transaction, "accountId" | "categoryId" | "amount" | "occurredAt" | "merchant" | "note" | "plannedStatus" | "receiptPath">
>

export interface TransactionFilter {
  /** Inclusive start instant. */
  from?: Instant
  /** Exclusive end instant. */
  to?: Instant
  categoryId?: string
  accountId?: string
  plannedStatus?: PlannedStatus
  type?: TransactionType
  search?: string
}
