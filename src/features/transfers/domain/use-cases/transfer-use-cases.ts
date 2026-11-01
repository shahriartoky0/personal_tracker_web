import { isValidMinor } from "@/shared/domain/money"
import type { DateRange } from "@/shared/domain/dates"
import { isValidLocalDate } from "@/shared/domain/dates"
import { fail, notFound, ok, validation, type Result } from "@/shared/domain/result"
import type { AccountRepository } from "@/features/accounts/domain/repositories/account-repository"
import type { Transaction, TransferDirection } from "@/features/transactions/domain/entities/transaction"
import type { TransactionRepository } from "@/features/transactions/domain/repositories/transaction-repository"
import type { Payee } from "../entities/payee"
import type { PayeeRepository, ProofStorage } from "../repositories/transfer-ports"
import { validateProof } from "../services/proof"
import { buildTransferTracker, type TransferTracker } from "../services/transfer-tracker"

export interface TransferDeps {
  transactions: TransactionRepository
  accounts: AccountRepository
  payees: PayeeRepository
  proofs: ProofStorage
}

export interface PersonTransferInput {
  accountId: string
  /** Existing or new person; matched case-insensitively and created on first use. */
  payeeName: string
  direction: TransferDirection
  amount: number
  occurredAt: string
  note?: string | null
  receiptPath?: string | null
}

function validate(input: Partial<PersonTransferInput>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (input.payeeName !== undefined) {
    const n = input.payeeName.trim()
    if (n.length < 1) errors.payeeName = "Who is it with? Enter a name."
    else if (n.length > 80) errors.payeeName = "Name is too long (80 max)."
  }
  if (input.direction !== undefined && input.direction !== "in" && input.direction !== "out") errors.direction = "Choose sent or received."
  if (input.amount !== undefined && (!isValidMinor(input.amount) || input.amount <= 0)) errors.amount = "Enter an amount greater than zero."
  if (input.occurredAt !== undefined && Number.isNaN(Date.parse(input.occurredAt))) errors.occurredAt = "Enter a valid date and time."
  if (input.note && input.note.length > 500) errors.note = "Note is too long (500 max)."
  return errors
}

async function resolvePayee(payees: PayeeRepository, name: string): Promise<Payee> {
  const clean = name.trim().replace(/\s+/g, " ")
  const existing = await payees.findByName(clean)
  if (existing) {
    // Typing a previously archived person's name brings them back.
    return existing.isArchived ? ((await payees.update(existing.id, { isArchived: false })) ?? existing) : existing
  }
  return payees.create(clean)
}

async function checkAccount(accounts: AccountRepository, id: string, current?: string): Promise<string | null> {
  const acc = await accounts.getById(id)
  if (!acc) return "Choose an account."
  if (acc.isArchived && id !== current) return "This account is archived."
  return null
}

/** Records money sent to / received from a person. Not an expense, income or own-account transfer. */
export class RecordPersonTransfer {
  constructor(private readonly deps: TransferDeps) {}
  async execute(input: PersonTransferInput): Promise<Result<Transaction>> {
    const errors = validate(input)
    const accErr = await checkAccount(this.deps.accounts, input.accountId)
    if (accErr) errors.accountId = accErr
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    const payee = await resolvePayee(this.deps.payees, input.payeeName)
    return ok(
      await this.deps.transactions.createPersonTransfer({
        accountId: input.accountId,
        payeeId: payee.id,
        direction: input.direction,
        amount: input.amount,
        occurredAt: input.occurredAt,
        note: input.note?.trim() || null,
        receiptPath: input.receiptPath || null,
      }),
    )
  }
}

export class UpdatePersonTransfer {
  constructor(private readonly deps: TransferDeps) {}
  async execute(id: string, patch: Partial<PersonTransferInput>): Promise<Result<Transaction>> {
    const existing = await this.deps.transactions.getById(id)
    if (!existing) return notFound("Transfer")
    if (existing.type !== "person_transfer") return fail("conflict", "That isn't a transfer to a person.")
    const errors = validate(patch)
    if (patch.accountId) {
      const e = await checkAccount(this.deps.accounts, patch.accountId, existing.accountId)
      if (e) errors.accountId = e
    }
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)

    const oldProof = existing.receiptPath
    const payeeId = patch.payeeName !== undefined ? (await resolvePayee(this.deps.payees, patch.payeeName)).id : undefined
    const updated = await this.deps.transactions.update(id, {
      accountId: patch.accountId,
      payeeId,
      transferDirection: patch.direction,
      amount: patch.amount,
      occurredAt: patch.occurredAt,
      note: patch.note === undefined ? undefined : patch.note?.trim() || null,
      receiptPath: patch.receiptPath === undefined ? undefined : patch.receiptPath || null,
    })
    if (!updated) return notFound("Transfer")
    // The old proof is no longer referenced once it was replaced or removed.
    if (patch.receiptPath !== undefined && oldProof && oldProof !== updated.receiptPath) {
      await this.deps.proofs.remove(oldProof).catch(() => {})
    }
    return ok(updated)
  }
}

export class ListPayees {
  constructor(private readonly payees: PayeeRepository) {}
  async execute(opts: { includeArchived?: boolean } = {}): Promise<Payee[]> {
    const all = await this.payees.list()
    return opts.includeArchived ? all : all.filter((p) => !p.isArchived)
  }
}

export class UploadProof {
  constructor(private readonly proofs: ProofStorage) {}
  async execute(file: { bytes: ArrayBuffer; contentType: string; size: number }): Promise<Result<{ path: string }>> {
    const error = validateProof(file)
    if (error) return validation(error, { proof: error })
    return ok({ path: await this.proofs.upload(file) })
  }
}

export class GetProofUrl {
  constructor(private readonly proofs: ProofStorage) {}
  async execute(path: string): Promise<Result<{ url: string }>> {
    const url = await this.proofs.signedUrl(path, 120)
    return url ? ok({ url }) : notFound("Proof image")
  }
}

export class RemoveProof {
  constructor(private readonly proofs: ProofStorage) {}
  async execute(path: string): Promise<Result<true>> {
    await this.proofs.remove(path)
    return ok(true)
  }
}

export class GetTransferTracker {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly payees: PayeeRepository,
  ) {}
  async execute(range: DateRange, timezone: string, payeeId?: string): Promise<Result<TransferTracker>> {
    if (!isValidLocalDate(range.from) || !isValidLocalDate(range.to) || range.from > range.to)
      return validation("Enter a valid date range.", { range: "Invalid range." })
    const [all, payees] = await Promise.all([
      this.transactions.list({ type: "person_transfer" }),
      this.payees.list(),
    ])
    return ok(buildTransferTracker({ all, payees, range, timezone, payeeId }))
  }
}
