import type { Account, NewAccount } from "../entities/account"

export interface AccountRepository {
  list(): Promise<Account[]>
  getById(id: string): Promise<Account | null>
  create(input: NewAccount): Promise<Account>
  update(id: string, patch: Partial<NewAccount> & { isArchived?: boolean }): Promise<Account | null>
}
