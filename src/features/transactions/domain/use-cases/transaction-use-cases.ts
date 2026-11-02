import { fail, notFound, ok, validation, type Result } from "@/shared/domain/result"
import { isValidMinor } from "@/shared/domain/money"
import { instantRange, isValidLocalDate, type DateRange, type LocalDate } from "@/shared/domain/dates"
import type { AccountRepository } from "@/features/accounts/domain/repositories/account-repository"
import type { PayeeRepository, ProofStorage } from "@/features/transfers/domain/repositories/transfer-ports"
import type { CategoryRepository } from "@/features/categories/domain/repositories/category-repository"
import type {
  NewTransaction,
  NewTransfer,
  PlannedStatus,
  Transaction,
  TransactionFilter,
  TransactionPatch,
  TransactionType,
} from "../entities/transaction"
import type { TransactionRepository } from "../repositories/transaction-repository"
import { transactionsToCsv } from "../services/csv"

export interface TransactionDeps {
  transactions: TransactionRepository
  accounts: AccountRepository
  categories: CategoryRepository
  payees: PayeeRepository
}

function validateCommon(input: { amount?: number; occurredAt?: string; note?: string | null; merchant?: string | null }) {
  const errors: Record<string, string> = {}
  if (input.amount !== undefined) {
    if (!isValidMinor(input.amount) || input.amount <= 0) errors.amount = "Enter an amount greater than zero."
  }
  if (input.occurredAt !== undefined && Number.isNaN(Date.parse(input.occurredAt))) errors.occurredAt = "Enter a valid date and time."
  if (input.note && input.note.length > 500) errors.note = "Note is too long (500 max)."
  if (input.merchant && input.merchant.length > 120) errors.merchant = "Title is too long (120 max)."
  return errors
}

async function checkRefs(
  deps: TransactionDeps,
  refs: { accountId?: string; categoryId?: string; categoryType?: "income" | "expense" },
): Promise<Record<string, string>> {
  const errors: Record<string, string> = {}
  if (refs.accountId) {
    const acc = await deps.accounts.getById(refs.accountId)
    if (!acc) errors.accountId = "Choose an account."
    else if (acc.isArchived) errors.accountId = "This account is archived."
  }
  if (refs.categoryId) {
    const cat = await deps.categories.getById(refs.categoryId)
    if (!cat) errors.categoryId = "Choose a category."
    else if (cat.isArchived) errors.categoryId = "This category is archived."
    else if (refs.categoryType && cat.type !== refs.categoryType)
      errors.categoryId = `Choose an ${refs.categoryType} category.`
  }
  return errors
}

async function createTyped(deps: TransactionDeps, input: NewTransaction): Promise<Result<Transaction>> {
  const errors = {
    ...validateCommon(input),
    ...(await checkRefs(deps, { accountId: input.accountId, categoryId: input.categoryId, categoryType: input.type })),
  }
  if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
  return ok(
    await deps.transactions.create({
      ...input,
      merchant: input.merchant?.trim() || null,
      note: input.note?.trim() || null,
      plannedStatus: input.type === "expense" ? (input.plannedStatus ?? "planned") : "unplanned",
    }),
  )
}

export class CreateExpense {
  constructor(private readonly deps: TransactionDeps) {}
  execute(input: Omit<NewTransaction, "type">) {
    return createTyped(this.deps, { ...input, type: "expense" })
  }
}

export class CreateIncome {
  constructor(private readonly deps: TransactionDeps) {}
  execute(input: Omit<NewTransaction, "type" | "plannedStatus">) {
    return createTyped(this.deps, { ...input, type: "income" })
  }
}

/** Moves money between two of the user's own accounts. Never counted as income or expense. */
export class CreateTransfer {
  constructor(private readonly deps: TransactionDeps) {}
  async execute(input: NewTransfer): Promise<Result<{ groupId: string }>> {
    const errors: Record<string, string> = { ...validateCommon(input) }
    if (input.fromAccountId === input.toAccountId) errors.toAccountId = "Choose two different accounts."
    Object.assign(errors, await checkRefs(this.deps, {}))
    for (const [field, id] of [["fromAccountId", input.fromAccountId], ["toAccountId", input.toAccountId]] as const) {
      const acc = await this.deps.accounts.getById(id)
      if (!acc || acc.isArchived) errors[field] = "Choose an active account."
    }
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    const groupId = await this.deps.transactions.createTransfer({ ...input, note: input.note?.trim() || null })
    return ok({ groupId })
  }
}

export class UpdateTransaction {
  constructor(private readonly deps: TransactionDeps) {}
  async execute(id: string, patch: TransactionPatch): Promise<Result<Transaction>> {
    const existing = await this.deps.transactions.getById(id)
    if (!existing) return notFound("Transaction")
    if (existing.type === "transfer")
      return fail("conflict", "Transfers can't be edited. Delete it and create a new one.")
    if (existing.type === "person_transfer") return fail("conflict", "Edit this from the Transfers screen.")
    const errors = {
      ...validateCommon(patch),
      ...(await checkRefs(this.deps, {
        accountId: patch.accountId,
        categoryId: patch.categoryId ?? undefined,
        categoryType: existing.type === "income" ? "income" : "expense",
      })),
    }
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    const updated = await this.deps.transactions.update(id, {
      ...patch,
      merchant: patch.merchant === undefined ? undefined : patch.merchant?.trim() || null,
      note: patch.note === undefined ? undefined : patch.note?.trim() || null,
    })
    return updated ? ok(updated) : notFound("Transaction")
  }
}

export class DeleteTransaction {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly proofs?: ProofStorage,
  ) {}
  async execute(id: string): Promise<Result<true>> {
    const existing = await this.transactions.getById(id)
    if (!(await this.transactions.delete(id))) return notFound("Transaction")
    // Don't leave an orphaned proof image behind.
    if (existing?.receiptPath && this.proofs) await this.proofs.remove(existing.receiptPath).catch(() => {})
    return ok(true)
  }
}

export class DuplicateTransaction {
  constructor(private readonly deps: TransactionDeps) {}
  async execute(id: string, occurredAt: string): Promise<Result<Transaction>> {
    const t = await this.deps.transactions.getById(id)
    if (!t) return notFound("Transaction")
    if (t.type === "transfer" || t.type === "person_transfer" || !t.categoryId) return fail("conflict", "Transfers can't be duplicated.")
    return createTyped(this.deps, {
      accountId: t.accountId,
      categoryId: t.categoryId,
      type: t.type,
      amount: t.amount,
      occurredAt,
      merchant: t.merchant,
      note: t.note,
      plannedStatus: t.plannedStatus,
    })
  }
}

export interface TransactionQuery {
  range?: DateRange
  categoryId?: string
  accountId?: string
  plannedStatus?: PlannedStatus
  type?: TransactionType
  payeeId?: string
  search?: string
}

export function toRepositoryFilter(q: TransactionQuery, timezone: string): Result<TransactionFilter> {
  const filter: TransactionFilter = {
    categoryId: q.categoryId,
    accountId: q.accountId,
    plannedStatus: q.plannedStatus,
    type: q.type,
    payeeId: q.payeeId,
    search: q.search?.trim() || undefined,
  }
  if (q.range) {
    if (!isValidLocalDate(q.range.from) || !isValidLocalDate(q.range.to))
      return validation("Enter a valid date range.", { range: "Invalid dates." })
    if (q.range.from > q.range.to) return validation("The start date must be before the end date.", { range: "Invalid range." })
    const { start, end } = instantRange(q.range.from as LocalDate, q.range.to as LocalDate, timezone)
    filter.from = start.toISOString()
    filter.to = end.toISOString()
  }
  return ok(filter)
}

export class ListTransactions {
  constructor(private readonly transactions: TransactionRepository) {}
  async execute(query: TransactionQuery, timezone: string): Promise<Result<Transaction[]>> {
    const filter = toRepositoryFilter(query, timezone)
    if (!filter.ok) return filter
    return ok(await this.transactions.list(filter.value))
  }
}

export class ExportTransactions {
  constructor(private readonly deps: TransactionDeps) {}
  async execute(query: TransactionQuery, timezone: string): Promise<Result<string>> {
    const filter = toRepositoryFilter(query, timezone)
    if (!filter.ok) return filter
    const [txs, accounts, categories, payees] = await Promise.all([
      this.deps.transactions.list(filter.value),
      this.deps.accounts.list(),
      this.deps.categories.list(),
      this.deps.payees.list(),
    ])
    const payeeNames = new Map(payees.map((p) => [p.id, p.name]))
    const accountNames = new Map(accounts.map((a) => [a.id, a.name]))
    const categoryNames = new Map(categories.map((c) => [c.id, c.name]))
    // CSV is chronological, oldest first.
    const ordered = [...txs].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))
    return ok(
      transactionsToCsv(ordered, {
        timezone,
        accountName: (id) => accountNames.get(id) ?? "",
        categoryName: (id) => (id ? (categoryNames.get(id) ?? "") : ""),
        payeeName: (id) => (id ? (payeeNames.get(id) ?? "") : ""),
      }),
    )
  }
}
