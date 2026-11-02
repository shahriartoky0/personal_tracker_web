"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { notifySuccess } from "@/components/layout/success-dialog"
import { ArrowLeftRight, Copy, MoreVertical, Pencil, Trash2, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useApp } from "@/components/layout/app-context"
import { CategoryIcon } from "@/components/layout/category-icon"
import { instantToZonedLocal, todayIn, type LocalDate } from "@/shared/domain/dates"
import { formatMoney } from "@/shared/domain/money"
import { dayLabel, formatTime } from "@/shared/lib/format"
import { groupByLocalDate, totalExpenses } from "../../domain/services/transaction-calculator"
import type { Transaction } from "../../domain/entities/transaction"
import { deleteTransactionAction, duplicateTransactionAction } from "../actions"
import { ProofButton } from "@/features/transfers/presentation/components/proof-viewer"
import { useQuickAdd } from "./quick-add"

function useRowInfo() {
  const app = useApp()
  return (t: Transaction) => {
    const cat = app.categoryById(t.categoryId)
    const acc = app.accountById(t.accountId)
    const isTransfer = t.type === "transfer"
    const isPerson = t.type === "person_transfer"
    const person = app.payeeById(t.payeeId)?.name ?? "someone"
    const title = isPerson
      ? t.transferDirection === "out"
        ? `Sent to ${person}`
        : `Received from ${person}`
      : isTransfer
        ? t.transferDirection === "out"
          ? "Transfer out"
          : "Transfer in"
        : t.merchant || cat?.name || "Transaction"
    const inflow = t.type === "income" || ((isTransfer || isPerson) && t.transferDirection === "in")
    const signed = inflow ? t.amount : -t.amount
    const sub = [isTransfer || isPerson ? null : t.merchant ? cat?.name : null, t.note].filter(Boolean).join(" · ")
    return { cat, acc, isTransfer, isPerson, title, signed, sub }
  }
}

function AmountText({ minor, type }: { minor: number; type: Transaction["type"] }) {
  const { money } = useApp()
  const text = money(minor, { showPlus: minor > 0 })
  return (
    <span
      className={cn(
        "num whitespace-nowrap font-semibold",
        (type === "income" || (type === "person_transfer" && minor > 0)) && "text-success",
        type === "transfer" && "text-muted-foreground",
      )}
    >
      {text}
    </span>
  )
}

function StatusBadge({ t }: { t: Transaction }) {
  if (t.type === "transfer")
    return (
      <Badge variant="outline" className="gap-1">
        <ArrowLeftRight className="size-3" aria-hidden /> Transfer
      </Badge>
    )
  if (t.type === "person_transfer")
    return (
      <Badge variant="outline" className="gap-1">
        <UserRound className="size-3" aria-hidden /> {t.transferDirection === "out" ? "Sent" : "Received"}
      </Badge>
    )
  if (t.type === "income") return <Badge variant="secondary">Income</Badge>
  return t.plannedStatus === "unplanned" ? (
    <Badge className="border-transparent bg-warning-soft text-warning">Unplanned</Badge>
  ) : (
    <Badge variant="secondary">Planned</Badge>
  )
}

function RowMenu({ t, onDelete }: { t: Transaction; onDelete: (t: Transaction) => void }) {
  const app = useApp()
  const { openEdit } = useQuickAdd()
  const [, start] = useTransition()
  if (app.demo) return null
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="tap" aria-label="Transaction actions">
          <MoreVertical aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {t.type !== "transfer" && (
          <DropdownMenuItem onSelect={() => openEdit(t)}>
            <Pencil aria-hidden /> Edit
          </DropdownMenuItem>
        )}
        {t.type !== "transfer" && t.type !== "person_transfer" && (
          <DropdownMenuItem
            onSelect={() =>
              start(async () => {
                const res = await duplicateTransactionAction({ id: t.id, occurredAt: instantToZonedLocal(new Date(), app.timezone) })
                if (res.ok) notifySuccess("Duplicated with today's date and time")
                else toast.error(res.message)
              })
            }
          >
            <Copy aria-hidden /> Duplicate
          </DropdownMenuItem>
        )}
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(t)}>
          <Trash2 aria-hidden /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function TransactionList({
  transactions,
  grouped = true,
  emptyAction,
}: {
  transactions: Transaction[]
  grouped?: boolean
  emptyAction?: React.ReactNode
}) {
  const app = useApp()
  const info = useRowInfo()
  const [toDelete, setToDelete] = useState<Transaction | null>(null)
  const [pending, start] = useTransition()
  const today = todayIn(app.timezone)

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
        <p className="text-section">No transactions here yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">Add your first expense or income and it will show up right away.</p>
        {emptyAction}
      </div>
    )
  }

  const groups: [LocalDate | null, Transaction[]][] = grouped
    ? [...groupByLocalDate(transactions, app.timezone).entries()]
    : [[null, transactions]]

  return (
    <div className="flex flex-col gap-6">
      {groups.map(([date, txs]) => (
        <section key={date ?? "all"} aria-label={date ? dayLabel(date, today) : "Transactions"}>
          {date && (
            <header className="mb-2 flex items-baseline justify-between gap-2 px-1">
              <h3 className="text-label text-muted-foreground">{dayLabel(date, today)}</h3>
              {totalExpenses(txs) > 0 && (
                <span className="text-caption num text-muted-foreground">Spent {formatMoney(totalExpenses(txs), { currency: app.currency })}</span>
              )}
            </header>
          )}

          {/* Phone: card list */}
          <ul className="divide-y rounded-xl border bg-card md:hidden">
            {txs.map((t) => {
              const r = info(t)
              return (
                <li key={t.id} className="flex items-center gap-3 p-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
                    {r.isPerson ? <UserRound className="size-4" aria-hidden /> : r.isTransfer ? <ArrowLeftRight className="size-4" aria-hidden /> : <CategoryIcon name={r.cat?.icon ?? null} color={r.cat?.color} className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.title}</p>
                    <p className="truncate text-caption text-muted-foreground">
                      {r.acc?.name} · {formatTime(t.occurredAt, app.timezone)}
                      {r.sub ? ` · ${r.sub}` : ""}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1"><StatusBadge t={t} />{t.receiptPath && <ProofButton path={t.receiptPath} />}</div>
                  </div>
                  <AmountText minor={r.signed} type={t.type} />
                  <RowMenu t={t} onDelete={setToDelete} />
                </li>
              )
            })}
          </ul>

          {/* Tablet/desktop: table */}
          <div className="hidden overflow-hidden rounded-xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Time</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-12"><span className="sr-only">Actions</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.map((t) => {
                  const r = info(t)
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="num text-muted-foreground">{formatTime(t.occurredAt, app.timezone)}</TableCell>
                      <TableCell className="max-w-[18rem]">
                        <div className="flex items-center gap-2">
                          {r.isPerson ? <UserRound className="size-4 shrink-0" aria-hidden /> : r.isTransfer ? <ArrowLeftRight className="size-4 shrink-0" aria-hidden /> : <CategoryIcon name={r.cat?.icon ?? null} color={r.cat?.color} className="size-4 shrink-0" />}
                          <div className="min-w-0">
                            <p className="truncate font-medium">{r.title}</p>
                            {r.sub && <p className="truncate text-caption text-muted-foreground">{r.sub}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{r.acc?.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1"><StatusBadge t={t} />{t.receiptPath && <ProofButton path={t.receiptPath} />}</div>
                      </TableCell>
                      <TableCell className="text-right"><AmountText minor={r.signed} type={t.type} /></TableCell>
                      <TableCell><RowMenu t={t} onDelete={setToDelete} /></TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </section>
      ))}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this {toDelete?.type === "transfer" || toDelete?.type === "person_transfer" ? "transfer" : "transaction"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete?.type === "transfer"
                ? "Both sides of the transfer will be removed. "
                : toDelete?.receiptPath
                  ? "Its proof image will be deleted too. "
                  : ""}
              This changes your balance and reports, and can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                const id = toDelete?.id
                if (!id) return
                start(async () => {
                  const res = await deleteTransactionAction({ id })
                  if (res.ok) notifySuccess("Deleted")
                  else toast.error(res.message)
                  setToDelete(null)
                })
              }}
            >
              {pending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
