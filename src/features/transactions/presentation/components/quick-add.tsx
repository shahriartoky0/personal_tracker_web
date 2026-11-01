"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Segmented } from "@/components/layout/segmented"
import { useMediaQuery } from "@/shared/lib/use-media-query"
import { PersonTransferForm } from "@/features/transfers/presentation/components/person-transfer-form"
import type { Transaction } from "../../domain/entities/transaction"
import { TransactionForm } from "./transaction-form"
import { TransferForm } from "./transfer-form"

type Mode = "expense" | "income" | "transfer"
type TransferKind = "own" | "person"

interface QuickAddApi {
  openExpense: () => void
  openIncome: () => void
  /** Between the user's own accounts. */
  openTransfer: () => void
  /** Money sent to / received from a person. */
  openPersonTransfer: () => void
  openEdit: (t: Transaction) => void
}

const Ctx = createContext<QuickAddApi | null>(null)

export function useQuickAdd() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useQuickAdd must be used inside QuickAddProvider")
  return v
}

/** Hosts the add/edit sheet: a bottom sheet on phones, a side panel on larger screens. */
export function QuickAddProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("expense")
  const [kind, setKind] = useState<TransferKind>("person")
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [nonce, setNonce] = useState(0) // remounts the form so defaults (e.g. "now") are fresh
  const desktop = useMediaQuery("(min-width: 768px)")

  const launch = useCallback((m: Mode, k: TransferKind = "own", t?: Transaction) => {
    setMode(m)
    setKind(k)
    setEditing(t)
    setNonce((n) => n + 1)
    setOpen(true)
  }, [])

  const api = useMemo<QuickAddApi>(
    () => ({
      openExpense: () => launch("expense"),
      openIncome: () => launch("income"),
      openTransfer: () => launch("transfer", "own"),
      openPersonTransfer: () => launch("transfer", "person"),
      openEdit: (t) =>
        t.type === "person_transfer" ? launch("transfer", "person", t) : launch(t.type === "income" ? "income" : "expense", "own", t),
    }),
    [launch],
  )

  const close = () => setOpen(false)
  const personMode = mode === "transfer" && kind === "person"
  const title = editing
    ? personMode
      ? "Edit transfer"
      : "Edit transaction"
    : mode === "expense"
      ? "Add expense"
      : mode === "income"
        ? "Add income"
        : personMode
          ? "Send or receive money"
          : "Move between my accounts"

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={desktop ? "right" : "bottom"}
          className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md md:max-h-none"
        >
          <SheetHeader className="border-b p-4 text-left">
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {mode === "transfer"
                ? personMode
                  ? "To or from a person — tracked separately."
                  : "Between your own accounts."
                : "Amount first — everything else is optional."}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {!editing && (
              <div className="mb-5 flex flex-col gap-3">
                <Segmented
                  label="What are you recording?"
                  value={mode}
                  onChange={(m) => {
                    setMode(m)
                    setNonce((n) => n + 1)
                  }}
                  options={[
                    { value: "expense", label: "Expense" },
                    { value: "income", label: "Income" },
                    { value: "transfer", label: "Transfer" },
                  ]}
                />
                {mode === "transfer" && (
                  <Segmented
                    label="Transfer type"
                    value={kind}
                    onChange={(k) => {
                      setKind(k)
                      setNonce((n) => n + 1)
                    }}
                    options={[
                      { value: "person", label: "With a person" },
                      { value: "own", label: "My accounts" },
                    ]}
                  />
                )}
              </div>
            )}
            {mode === "transfer" ? (
              personMode ? (
                <PersonTransferForm key={nonce} initial={editing} onDone={close} />
              ) : (
                <TransferForm key={nonce} onDone={close} />
              )
            ) : (
              <TransactionForm key={nonce} type={mode} initial={editing} onDone={close} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  )
}
