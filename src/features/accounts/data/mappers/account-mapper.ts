import { isAccountType, type Account } from "../../domain/entities/account"
import type { AccountRow } from "../dto/account-dto"

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    type: isAccountType(row.type) ? row.type : "other",
    openingBalance: Number(row.opening_balance),
    isArchived: row.is_archived,
  }
}
