"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowDownLeft, ArrowUpRight, Plus, UserRound, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useApp } from "@/components/layout/app-context"
import { SelectField } from "@/components/layout/select-field"
import { cn } from "@/lib/utils"
import { diffDays } from "@/shared/domain/dates"
import { formatDate } from "@/shared/lib/format"
import { ExportButton } from "@/features/transactions/presentation/components/export-button"
import { TransactionList } from "@/features/transactions/presentation/components/transaction-list"
import { useQuickAdd } from "@/features/transactions/presentation/components/quick-add"
import type { TransferTracker } from "../../domain/services/transfer-tracker"

const PRESETS = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "last_30", label: "Last 30 days" },
  { id: "all", label: "All time" },
] as const

export interface TransferFilters {
  preset: string
  payee: string
}

function qs(f: TransferFilters, extra: Record<string, string>) {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v)
  return `?${p.toString()}`
}

function Stat({ label, value, hint, tone, icon: Icon }: { label: string; value: string; hint?: string; tone?: string; icon?: typeof ArrowUpRight }) {
  return (
    <Card className="gap-1 p-4">
      <p className="text-label flex items-center gap-1.5 text-muted-foreground">
        {Icon && <Icon className="size-4" aria-hidden />} {label}
      </p>
      <p className={cn("num text-value break-words", tone)}>{value}</p>
      {hint && <p className="text-caption text-muted-foreground">{hint}</p>}
    </Card>
  )
}

export function TransfersView({ tracker, filters, error }: { tracker: TransferTracker | null; filters: TransferFilters; error?: string }) {
  const app = useApp()
  const router = useRouter()
  const path = usePathname()
  const { openPersonTransfer } = useQuickAdd()
  const { money } = app
  const [from, setFrom] = useState(tracker?.range.from ?? "")
  const [to, setTo] = useState(tracker?.range.to ?? "")
  const go = (extra: Record<string, string>) => router.push(`${path}${qs(filters, extra)}`)
  const selected = app.payeeById(filters.payee || null)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-title">Transfers</h1>
          <p className="text-sm text-muted-foreground">Money you send to and receive from people — tracked apart from your spending.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {tracker && (
            <ExportButton
              filters={{ type: "person_transfer", from: tracker.range.from, to: tracker.range.to, payeeId: filters.payee || undefined }}
              filename={`person_transfers_${tracker.range.from}_to_${tracker.range.to}.csv`}
              label="Export"
            />
          )}
          <Button className="tap" onClick={openPersonTransfer}>
            <Plus aria-hidden /> Send / receive
          </Button>
        </div>
      </div>

      <Card className="gap-4 p-4">
        <div role="group" aria-label="Period" className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button key={p.id} asChild size="sm" variant={filters.preset === p.id ? "default" : "outline"} className="tap">
              <Link href={`${path}${qs(filters, { preset: p.id })}`} aria-current={filters.preset === p.id ? "true" : undefined}>
                {p.label}
              </Link>
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_auto]">
          <div>
            <Label htmlFor="tr-from" className="text-label">From</Label>
            <Input id="tr-from" type="date" className="tap mt-1" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tr-to" className="text-label">To</Label>
            <Input id="tr-to" type="date" className="tap mt-1" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tr-person" className="text-label">Person</Label>
            <SelectField
              id="tr-person"
              className="mt-1"
              value={filters.payee}
              onChange={(v) => go({ payee: v })}
              options={[{ value: "", label: "Everyone" }, ...app.payees.map((p) => ({ value: p.id, label: p.name }))]}
            />
          </div>
          <div className="flex items-end">
            <Button className="tap w-full" disabled={!from || !to} onClick={() => go({ preset: "custom", from, to })}>
              Apply dates
            </Button>
          </div>
        </div>
      </Card>

      {error && <p role="alert" className="rounded-md bg-destructive-soft p-3 text-sm text-destructive">{error}</p>}

      {tracker && (
        <>
          <p className="text-sm text-muted-foreground">
            {formatDate(tracker.range.from)} – {formatDate(tracker.range.to)} · {diffDays(tracker.range.from, tracker.range.to) + 1} days
            {selected && (
              <>
                {" · "}
                <span className="font-medium text-foreground">{selected.name}</span>{" "}
                <button type="button" className="inline-flex items-center gap-0.5 underline underline-offset-4" onClick={() => go({ payee: "" })}>
                  <X className="size-3" aria-hidden /> clear
                </button>
              </>
            )}
          </p>

          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Sent" icon={ArrowUpRight} value={money(tracker.sent)} />
            <Stat label="Received" icon={ArrowDownLeft} value={money(tracker.received)} tone="text-success" />
            <Stat label="Net sent" value={money(tracker.netSent)} hint="Sent − received" />
            <Stat
              label="Transfers"
              value={String(tracker.count)}
              hint={`${tracker.peopleCount} ${tracker.peopleCount === 1 ? "person" : "people"} · ${tracker.withProof} with proof`}
            />
          </section>

          <section aria-labelledby="by-person" className="flex flex-col gap-3">
            <h2 id="by-person" className="text-section">By person</h2>
            {tracker.byPayee.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
                <p className="text-section">No transfers in this period</p>
                <p className="max-w-sm text-sm text-muted-foreground">Record money you send to or receive from someone and it will be totalled here, per person.</p>
                <Button className="tap" onClick={openPersonTransfer}><Plus aria-hidden /> Record a transfer</Button>
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {tracker.byPayee.map((p) => (
                  <li key={p.payeeId}>
                    <Link
                      href={`${path}${qs(filters, { payee: p.payeeId })}`}
                      className={cn(
                        "block rounded-xl border bg-card p-4 transition-colors hover:bg-muted/60",
                        filters.payee === p.payeeId && "ring-2 ring-primary",
                      )}
                      aria-label={`${p.name}: show only this person`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
                          <UserRound className="size-5" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{p.name}</p>
                          <p className="text-caption text-muted-foreground">
                            {p.count} {p.count === 1 ? "transfer" : "transfers"}
                            {p.lastAt && ` · last ${formatDate(p.lastAt.slice(0, 10), { year: false })}`}
                          </p>
                        </div>
                      </div>
                      <dl className="num mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                        <dt className="text-muted-foreground">Sent</dt>
                        <dd className="text-right font-semibold">{money(p.sent)}</dd>
                        <dt className="text-muted-foreground">Received</dt>
                        <dd className="text-right font-semibold text-success">{money(p.received)}</dd>
                        <dt className="border-t pt-1 text-muted-foreground">All-time sent</dt>
                        <dd className="border-t pt-1 text-right">{money(p.sentAllTime)}</dd>
                        {p.receivedAllTime > 0 && (
                          <>
                            <dt className="text-muted-foreground">All-time received</dt>
                            <dd className="text-right">{money(p.receivedAllTime)}</dd>
                          </>
                        )}
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {tracker.transfers.length > 0 && (
            <section aria-labelledby="history" className="flex flex-col gap-3">
              <h2 id="history" className="text-section">History</h2>
              <TransactionList transactions={tracker.transfers} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
