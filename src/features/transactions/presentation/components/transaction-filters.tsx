"use client"

import { SelectField } from "@/components/layout/select-field"
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
        <SelectField id="f-cat" className="mt-1" value={v.category} onChange={(x) => set("category", x, true)} options={[{ value: "", label: "All categories" }, ...app.categories.map((c) => ({ value: c.id, label: c.name + (c.isArchived ? " (archived)" : "") }))]} />
      </div>
      <div>
        <Label htmlFor="f-acc" className="text-label">Account</Label>
        <SelectField id="f-acc" className="mt-1" value={v.account} onChange={(x) => set("account", x, true)} options={[{ value: "", label: "All accounts" }, ...app.accounts.map((a) => ({ value: a.id, label: a.name }))]} />
      </div>
      <div>
        <Label htmlFor="f-pl" className="text-label">Planned?</Label>
        <SelectField id="f-pl" className="mt-1" value={v.planned} onChange={(x) => set("planned", x, true)} options={[{ value: "", label: "Planned & unplanned" }, { value: "planned", label: "Planned only" }, { value: "unplanned", label: "Unplanned only" }]} />
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
