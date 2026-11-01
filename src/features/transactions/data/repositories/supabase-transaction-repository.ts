import type {
  NewTransaction,
  NewTransfer,
  TransactionFilter,
  TransactionPatch,
} from "../../domain/entities/transaction"
import type { TransactionRepository } from "../../domain/repositories/transaction-repository"
import type { TransactionDatasource } from "../datasources/transaction-datasource"
import { toTransaction } from "../mappers/transaction-mapper"

export class SupabaseTransactionRepository implements TransactionRepository {
  constructor(
    private readonly ds: TransactionDatasource,
    private readonly userId: string,
  ) {}

  async list(filter?: TransactionFilter) {
    return (await this.ds.list(filter)).map(toTransaction)
  }

  async getById(id: string) {
    const row = await this.ds.get(id)
    return row ? toTransaction(row) : null
  }

  async create(input: NewTransaction) {
    return toTransaction(
      await this.ds.insert({
        user_id: this.userId,
        account_id: input.accountId,
        category_id: input.categoryId,
        type: input.type,
        amount: input.amount,
        occurred_at: input.occurredAt,
        merchant: input.merchant ?? null,
        note: input.note ?? null,
        planned_status: input.plannedStatus ?? "unplanned",
        receipt_path: input.receiptPath ?? null,
      }),
    )
  }

  createTransfer(input: NewTransfer) {
    return this.ds.createTransfer({
      from: input.fromAccountId,
      to: input.toAccountId,
      amount: input.amount,
      occurredAt: input.occurredAt,
      note: input.note ?? null,
    })
  }

  async update(id: string, patch: TransactionPatch) {
    const row = await this.ds.update(id, {
      ...(patch.accountId !== undefined && { account_id: patch.accountId }),
      ...(patch.categoryId !== undefined && { category_id: patch.categoryId }),
      ...(patch.amount !== undefined && { amount: patch.amount }),
      ...(patch.occurredAt !== undefined && { occurred_at: patch.occurredAt }),
      ...(patch.merchant !== undefined && { merchant: patch.merchant }),
      ...(patch.note !== undefined && { note: patch.note }),
      ...(patch.plannedStatus !== undefined && { planned_status: patch.plannedStatus }),
      ...(patch.receiptPath !== undefined && { receipt_path: patch.receiptPath }),
    })
    return row ? toTransaction(row) : null
  }

  async delete(id: string) {
    const row = await this.ds.get(id)
    if (!row) return false
    return row.transfer_group_id ? this.ds.deleteGroup(row.transfer_group_id) : this.ds.delete(id)
  }

  deleteAll() {
    return this.ds.deleteAll(this.userId)
  }
}
