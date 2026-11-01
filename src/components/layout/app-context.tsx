"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"
import { formatMoney, type FormatMoneyOptions, type Minor } from "@/shared/domain/money"
import type { Account } from "@/features/accounts/domain/entities/account"
import type { Category } from "@/features/categories/domain/entities/category"

export interface AppData {
  currency: string
  timezone: string
  displayName: string
  email: string
  accounts: Account[]
  categories: Category[]
  /** True on the public /demo route: nothing is written anywhere. */
  demo?: boolean
}

interface AppContextValue extends AppData {
  money: (minor: Minor, opts?: Omit<FormatMoneyOptions, "currency">) => string
  categoryById: (id: string | null) => Category | undefined
  accountById: (id: string) => Account | undefined
}

const Ctx = createContext<AppContextValue | null>(null)

export function AppProvider({ data, children }: { data: AppData; children: ReactNode }) {
  const value = useMemo<AppContextValue>(() => {
    const cats = new Map(data.categories.map((c) => [c.id, c]))
    const accs = new Map(data.accounts.map((a) => [a.id, a]))
    return {
      ...data,
      money: (m, o) => formatMoney(m, { ...o, currency: data.currency }),
      categoryById: (id) => (id ? cats.get(id) : undefined),
      accountById: (id) => accs.get(id),
    }
  }, [data])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error("useApp must be used inside AppProvider")
  return v
}
