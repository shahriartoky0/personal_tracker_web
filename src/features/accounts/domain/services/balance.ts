import { sumMinor, type Minor } from "@/shared/domain/money"
import { balanceEffect } from "@/features/transactions/domain/services/transaction-calculator"
import type { Transaction } from "@/features/transactions/domain/entities/transaction"
import type { Account } from "../entities/account"

/** Balance = opening balance + income − expenses ± transfers, for one account. Optionally only before an instant. */
export function accountBalance(account: Account, txs: readonly Transaction[], before?: Date): Minor {
  const relevant = txs.filter(
    (t) => t.accountId === account.id && (!before || Date.parse(t.occurredAt) < before.getTime()),
  )
  return account.openingBalance + sumMinor(relevant.map(balanceEffect))
}

/** Total across accounts. Transfers between included accounts cancel out. */
export function totalBalance(accounts: readonly Account[], txs: readonly Transaction[], before?: Date): Minor {
  return sumMinor(accounts.map((a) => accountBalance(a, txs, before)))
}
