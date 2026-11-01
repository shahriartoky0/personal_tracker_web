"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Segmented } from "@/components/layout/segmented"
import { useMediaQuery } from "@/shared/lib/use-media-query"
import type { Transaction } from "../../domain/entities/transaction"
import { TransactionForm } from "./transaction-form"
import { TransferForm } from "./transfer-form"

type Mode = "expense" | "income" | "transfer"

interface QuickAddApi {
  openExpense: () => void
  openIncome: () => void
  openTransfer: () => void
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
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [nonce, setNonce] = useState(0) // remounts the form so defaults (e.g. "now") are fresh
  const desktop = useMediaQuery("(min-width: 768px)")

  const launch = useCallback((m: Mode, t?: Transaction) => {
    setMode(m)
    setEditing(t)
    setNonce((n) => n + 1)
    setOpen(true)
  }, [])

  const api = useMemo<QuickAddApi>(
    () => ({
      openExpense: () => launch("expense"),
      openIncome: () => launch("income"),
      openTransfer: () => launch("transfer"),
      openEdit: (t) => launch(t.type === "income" ? "income" : "expense", t),
    }),
    [launch],
  )

  const close = () => setOpen(false)
  const title = editing ? "Edit transaction" : mode === "expense" ? "Add expense" : mode === "income" ? "Add income" : "Transfer money"

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
              {mode === "transfer" ? "Between your own accounts." : "Amount first — everything else is optional."}
            </SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto overscroll-contain p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {!editing && (
              <div className="mb-5">
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
              </div>
            )}
            {mode === "transfer" ? (
              <TransferForm key={nonce} onDone={close} />
            ) : (
              <TransactionForm key={nonce} type={mode} initial={editing} onDone={close} />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </Ctx.Provider>
  )
}
