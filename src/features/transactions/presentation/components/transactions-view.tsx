"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useApp } from "@/components/layout/app-context"
import { formatMoney } from "@/shared/domain/money"
import type { Transaction } from "../../domain/entities/transaction"
import { totalExpenses, totalIncome } from "../../domain/services/transaction-calculator"
import { ExportButton, type ExportFilters } from "./export-button"
import { TransactionFilters, type FilterValues } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { useQuickAdd } from "./quick-add"

export function TransactionsView({
  transactions,
  filters,
  exportFilters,
  error,
}: {
  transactions: Transaction[]
  filters: FilterValues
  exportFilters: ExportFilters
  error?: string
}) {
  const { currency } = useApp()
  const { openExpense, openTransfer } = useQuickAdd()
  const spent = totalExpenses(transactions)
  const income = totalIncome(transactions)

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title">Transactions</h1>
          <p className="num text-sm text-muted-foreground">
            {transactions.length} {transactions.length === 1 ? "entry" : "entries"} · Spent {formatMoney(spent, { currency })} · Income {formatMoney(income, { currency })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="tap" onClick={openTransfer}>Transfer</Button>
          <ExportButton filters={exportFilters} filename="transactions.csv" />
          <Button className="tap" onClick={openExpense}><Plus aria-hidden /> Add Expense</Button>
        </div>
      </div>
      <TransactionFilters values={filters} />
      {error ? (
        <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{error}</p>
      ) : (
        <TransactionList
          transactions={transactions}
          emptyAction={<Button className="tap" onClick={openExpense}><Plus aria-hidden /> Add expense</Button>}
        />
      )}
    </div>
  )
}
