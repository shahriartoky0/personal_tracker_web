import { fail, notFound, ok, validation, type Result } from "@/shared/domain/result"
import { isValidMinor } from "@/shared/domain/money"
import { isAccountType, type Account, type NewAccount } from "../entities/account"
import type { AccountRepository } from "../repositories/account-repository"

function validate(input: Partial<NewAccount>): Record<string, string> {
  const errors: Record<string, string> = {}
  if (input.name !== undefined) {
    const name = input.name.trim()
    if (name.length < 1 || name.length > 80) errors.name = "Name must be 1–80 characters."
  }
  if (input.type !== undefined && !isAccountType(input.type)) errors.type = "Choose a valid account type."
  if (input.openingBalance !== undefined && !isValidMinor(input.openingBalance))
    errors.openingBalance = "Enter a valid opening balance."
  return errors
}

export class ListAccounts {
  constructor(private readonly accounts: AccountRepository) {}
  async execute(opts: { includeArchived?: boolean } = {}): Promise<Account[]> {
    const all = await this.accounts.list()
    return opts.includeArchived ? all : all.filter((a) => !a.isArchived)
  }
}

export class CreateAccount {
  constructor(private readonly accounts: AccountRepository) {}
  async execute(input: NewAccount): Promise<Result<Account>> {
    const errors = validate(input)
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    return ok(await this.accounts.create({ ...input, name: input.name.trim() }))
  }
}

export class UpdateAccount {
  constructor(private readonly accounts: AccountRepository) {}
  async execute(id: string, patch: Partial<NewAccount> & { isArchived?: boolean }): Promise<Result<Account>> {
    const errors = validate(patch)
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    const existing = await this.accounts.getById(id)
    if (!existing) return notFound("Account")
    if (patch.isArchived) {
      const active = (await this.accounts.list()).filter((a) => !a.isArchived && a.id !== id)
      if (active.length === 0) return fail("conflict", "You need at least one active account.")
    }
    const updated = await this.accounts.update(id, {
      ...patch,
      name: patch.name?.trim(),
    })
    return updated ? ok(updated) : notFound("Account")
  }
}
