import type {
  NewTransaction,
  NewTransfer,
  Transaction,
  TransactionFilter,
  TransactionPatch,
} from "../entities/transaction"

export interface TransactionRepository {
  /** Newest first. */
  list(filter?: TransactionFilter): Promise<Transaction[]>
  getById(id: string): Promise<Transaction | null>
  create(input: NewTransaction): Promise<Transaction>
  /** Atomically creates the linked out/in pair and returns the shared group id. */
  createTransfer(input: NewTransfer): Promise<string>
  update(id: string, patch: TransactionPatch): Promise<Transaction | null>
  /** Deleting one leg of a transfer deletes the whole group. */
  delete(id: string): Promise<boolean>
  /** Removes every transaction of the signed-in user (data deletion). */
  deleteAll(): Promise<void>
}
