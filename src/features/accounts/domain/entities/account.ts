import type { Minor } from "@/shared/domain/money"

export const ACCOUNT_TYPES = ["cash", "bank", "card", "mobile", "other"] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank account",
  card: "Debit/credit card",
  mobile: "Mobile wallet",
  other: "Other",
}

export interface Account {
  id: string
  name: string
  type: AccountType
  openingBalance: Minor
  isArchived: boolean
}

export interface NewAccount {
  name: string
  type: AccountType
  openingBalance: Minor
}

export function isAccountType(value: string): value is AccountType {
  return (ACCOUNT_TYPES as readonly string[]).includes(value)
}
