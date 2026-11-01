import type { Transaction, TransactionType } from "../../domain/entities/transaction"
import type { TransactionRow } from "../dto/transaction-dto"

const TYPES: readonly TransactionType[] = ["income", "expense", "transfer"]

export function toTransaction(row: TransactionRow): Transaction {
  const type = TYPES.find((t) => t === row.type)
  if (!type) throw new Error(`Unknown transaction type: ${row.type}`)
  return {
    id: row.id,
    accountId: row.account_id,
    categoryId: row.category_id,
    type,
    transferDirection: row.transfer_direction === "in" ? "in" : row.transfer_direction === "out" ? "out" : null,
    transferGroupId: row.transfer_group_id,
    amount: Number(row.amount),
    occurredAt: new Date(row.occurred_at).toISOString(),
    merchant: row.merchant,
    note: row.note,
    plannedStatus: row.planned_status === "planned" ? "planned" : "unplanned",
    receiptPath: row.receipt_path,
  }
}
