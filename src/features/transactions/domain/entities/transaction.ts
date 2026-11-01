import type { Minor } from "@/shared/domain/money"
import type { Instant } from "@/shared/domain/dates"

/** `transfer` = between own accounts; `person_transfer` = money sent to / received from a person. */
export type TransactionType = "income" | "expense" | "transfer" | "person_transfer"
export type PlannedStatus = "planned" | "unplanned"
export type TransferDirection = "in" | "out"

export interface Transaction {
  id: string
  accountId: string
  categoryId: string | null
  type: TransactionType
  transferDirection: TransferDirection | null
  transferGroupId: string | null
  /** Set only for person transfers. */
  payeeId: string | null
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

export interface NewPersonTransfer {
  accountId: string
  payeeId: string
  /** out = I sent money, in = I received money. */
  direction: TransferDirection
  amount: Minor
  occurredAt: Instant
  note?: string | null
  receiptPath?: string | null
}

export type TransactionPatch = Partial<
  Pick<Transaction, "accountId" | "payeeId" | "transferDirection" | "categoryId" | "amount" | "occurredAt" | "merchant" | "note" | "plannedStatus" | "receiptPath">
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
  payeeId?: string
  search?: string
}
