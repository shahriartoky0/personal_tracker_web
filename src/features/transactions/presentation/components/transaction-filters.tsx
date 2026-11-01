"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/components/layout/app-context"

export interface FilterValues {
  q: string
  from: string
  to: string
  category: string
  account: string
  planned: string
}

const selectCls = "tap w-full rounded-md border bg-background px-3 text-sm"

/** URL-driven filters: the server page reads the query string, so results are shareable and back-button friendly. */
export function TransactionFilters({ values }: { values: FilterValues }) {
  const router = useRouter()
  const path = usePathname()
  const app = useApp()
  const [v, setV] = useState(values)
  useEffect(() => setV(values), [values])

  const apply = (next: FilterValues) => {
    const p = new URLSearchParams()
    for (const [k, val] of Object.entries(next)) if (val) p.set(k, val)
    router.push(`${path}?${p.toString()}`)
  }
  const set = (k: keyof FilterValues, val: string, now = false) => {
    const next = { ...v, [k]: val }
    setV(next)
    if (now) apply(next)
  }
  const active = Object.values(values).some(Boolean)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        apply(v)
      }}
      className="grid gap-3 rounded-xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-6"
      aria-label="Filter transactions"
    >
      <div className="sm:col-span-2 lg:col-span-2">
        <Label htmlFor="f-q" className="text-label">Search</Label>
        <div className="relative mt-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input id="f-q" type="search" placeholder="Title or note" className="tap pl-9" value={v.q} onChange={(e) => set("q", e.target.value)} />
        </div>
      </div>
      <div>
        <Label htmlFor="f-from" className="text-label">From</Label>
        <Input id="f-from" type="date" className="tap mt-1" value={v.from} onChange={(e) => set("from", e.target.value, true)} />
      </div>
      <div>
        <Label htmlFor="f-to" className="text-label">To</Label>
        <Input id="f-to" type="date" className="tap mt-1" value={v.to} onChange={(e) => set("to", e.target.value, true)} />
      </div>
      <div>
        <Label htmlFor="f-cat" className="text-label">Category</Label>
        <select id="f-cat" className={`${selectCls} mt-1`} value={v.category} onChange={(e) => set("category", e.target.value, true)}>
          <option value="">All categories</option>
          {app.categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}{c.isArchived ? " (archived)" : ""}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="f-acc" className="text-label">Account</Label>
        <select id="f-acc" className={`${selectCls} mt-1`} value={v.account} onChange={(e) => set("account", e.target.value, true)}>
          <option value="">All accounts</option>
          {app.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="f-pl" className="text-label">Planned?</Label>
        <select id="f-pl" className={`${selectCls} mt-1`} value={v.planned} onChange={(e) => set("planned", e.target.value, true)}>
          <option value="">Planned &amp; unplanned</option>
          <option value="planned">Planned only</option>
          <option value="unplanned">Unplanned only</option>
        </select>
      </div>
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2">
        <Button type="submit" className="tap">Apply</Button>
        {active && (
          <Button type="button" variant="ghost" className="tap" onClick={() => router.push(path)}>
            <X aria-hidden /> Clear filters
          </Button>
        )}
      </div>
    </form>
  )
}
