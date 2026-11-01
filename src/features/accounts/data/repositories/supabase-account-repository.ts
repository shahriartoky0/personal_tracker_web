import type { AccountRepository } from "../../domain/repositories/account-repository"
import type { NewAccount } from "../../domain/entities/account"
import type { AccountDatasource } from "../datasources/account-datasource"
import { toAccount } from "../mappers/account-mapper"

export class SupabaseAccountRepository implements AccountRepository {
  constructor(
    private readonly ds: AccountDatasource,
    private readonly userId: string,
  ) {}
  async list() {
    return (await this.ds.list()).map(toAccount)
  }
  async getById(id: string) {
    const row = await this.ds.get(id)
    return row ? toAccount(row) : null
  }
  async create(input: NewAccount) {
    return toAccount(
      await this.ds.insert({
        user_id: this.userId,
        name: input.name,
        type: input.type,
        opening_balance: input.openingBalance,
      }),
    )
  }
  async update(id: string, patch: Partial<NewAccount> & { isArchived?: boolean }) {
    const row = await this.ds.update(id, {
      ...(patch.name !== undefined && { name: patch.name }),
      ...(patch.type !== undefined && { type: patch.type }),
      ...(patch.openingBalance !== undefined && { opening_balance: patch.openingBalance }),
      ...(patch.isArchived !== undefined && { is_archived: patch.isArchived }),
    })
    return row ? toAccount(row) : null
  }
}
