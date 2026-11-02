"use client"

import { SelectField } from "@/components/layout/select-field"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { notifySuccess } from "@/components/layout/success-dialog"
import { Archive, ArchiveRestore, LogOut, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { useApp } from "@/components/layout/app-context"
import { CategoryIcon } from "@/components/layout/category-icon"
import { SUPPORTED_CURRENCIES } from "@/shared/domain/money"
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "@/features/accounts/domain/entities/account"
import { ExportButton } from "@/features/transactions/presentation/components/export-button"
import { THRESHOLD_OPTIONS, type ReminderPreference, type ReminderType } from "../../domain/entities/settings"
import {
  createAccountAction,
  createCategoryAction,
  deleteAccountAction,
  deleteAllDataAction,
  saveReminderAction,
  signOutAction,
  updateAccountAction,
  updateCategoryAction,
  updateProfileAction,
} from "../actions"

const TIMEZONES = ["Asia/Dhaka", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore", "Europe/London", "America/New_York", "America/Los_Angeles", "UTC"]

function useAct() {
  const router = useRouter()
  const [pending, start] = useTransition()
  const act = (fn: () => Promise<{ ok: boolean; message?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn()
      if (res.ok) {
        if (ok) notifySuccess(ok)
        router.refresh()
      } else toast.error(res.message ?? "Something went wrong")
    })
  return { pending, act }
}

function ProfileTab() {
  const app = useApp()
  const { pending, act } = useAct()
  const [name, setName] = useState(app.displayName)
  const [currency, setCurrency] = useState(app.currency)
  const [tz, setTz] = useState(app.timezone)
  const zones = TIMEZONES.includes(tz) ? TIMEZONES : [tz, ...TIMEZONES]
  return (
    <Card>
      <CardHeader><CardTitle className="text-section">Profile</CardTitle><CardDescription>Signed in as {app.email}</CardDescription></CardHeader>
      <CardContent className="grid max-w-xl gap-4">
        <div className="grid gap-1.5"><Label htmlFor="name">Display name</Label><Input id="name" className="tap" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="cur">Currency</Label>
            <SelectField id="cur" value={currency} onChange={setCurrency} options={SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }))} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tz">Timezone</Label>
            <SelectField id="tz" value={tz} onChange={setTz} options={zones.map((z) => ({ value: z, label: z }))} />
          </div>
        </div>
        <p className="text-caption text-muted-foreground">Your timezone decides which day a transaction belongs to. Changing it re-groups history by the new local days.</p>
        <Button className="tap w-fit" disabled={pending} onClick={() => act(() => updateProfileAction({ displayName: name, currency, timezone: tz }), "Profile saved")}>Save profile</Button>
      </CardContent>
    </Card>
  )
}

function AccountsTab() {
  const app = useApp()
  const { pending, act } = useAct()
  const [name, setName] = useState("")
  const [type, setType] = useState<AccountType>("bank")
  const [opening, setOpening] = useState("")
  return (
    <Card>
      <CardHeader><CardTitle className="text-section">Accounts &amp; payment methods</CardTitle><CardDescription>Cash, bank, card or mobile wallet. Archive instead of deleting to keep history.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <ul className="divide-y rounded-lg border">
          {app.accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{a.name} {a.isArchived && <Badge variant="outline">Archived</Badge>}</p>
                <p className="text-caption num text-muted-foreground">{ACCOUNT_TYPE_LABELS[a.type]} · Opening {app.money(a.openingBalance)}</p>
              </div>
              <Button variant="ghost" size="sm" className="tap" disabled={pending} onClick={() => act(() => updateAccountAction({ id: a.id, isArchived: !a.isArchived }), a.isArchived ? "Account restored" : "Account archived")}>
                {a.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />} {a.isArchived ? "Restore" : "Archive"}
              </Button>
            </li>
          ))}
        </ul>
        <div className="grid gap-3 sm:grid-cols-[1fr_11rem_9rem_auto] sm:items-end">
          <div className="grid gap-1.5"><Label htmlFor="an">New account name</Label><Input id="an" className="tap" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. bKash" /></div>
          <div className="grid gap-1.5"><Label htmlFor="at">Type</Label>
            <SelectField id="at" value={type} onChange={(v) => setType(v as AccountType)} options={ACCOUNT_TYPES.map((t) => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))} />
          </div>
          <div className="grid gap-1.5"><Label htmlFor="ao">Opening balance</Label><Input id="ao" className="num tap" inputMode="decimal" placeholder="0" value={opening} onChange={(e) => setOpening(e.target.value)} /></div>
          <Button className="tap" disabled={pending || !name.trim()} onClick={() => act(async () => { const r = await createAccountAction({ name, type, openingBalance: opening }); if (r.ok) { setName(""); setOpening("") } return r }, "Account added")}>
            <Plus aria-hidden /> Add
          </Button>
        </div>
        <p className="text-caption text-muted-foreground">Opening balance is the money you had in the account before you started tracking it.</p>
      </CardContent>
    </Card>
  )
}

function CategoriesTab() {
  const app = useApp()
  const { pending, act } = useAct()
  const [name, setName] = useState("")
  const [type, setType] = useState<"expense" | "income">("expense")
  const [color, setColor] = useState("#0f766e")
  return (
    <Card>
      <CardHeader><CardTitle className="text-section">Categories</CardTitle><CardDescription>Archiving hides a category from new entries; past transactions keep it.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-5">
        {(["expense", "income"] as const).map((t) => (
          <div key={t}>
            <h3 className="text-label mb-2 text-muted-foreground">{t === "expense" ? "Expense categories" : "Income categories"}</h3>
            <ul className="divide-y rounded-lg border">
              {app.categories.filter((c) => c.type === t).map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-3">
                  <CategoryIcon name={c.icon} color={c.color} className="size-5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name} {c.isArchived && <Badge variant="outline">Archived</Badge>}</span>
                  <Button variant="ghost" size="sm" className="tap" disabled={pending} onClick={() => act(() => updateCategoryAction({ id: c.id, isArchived: !c.isArchived }), c.isArchived ? "Category restored" : "Category archived")}>
                    {c.isArchived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />} {c.isArchived ? "Restore" : "Archive"}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem_5rem_auto] sm:items-end">
          <div className="grid gap-1.5"><Label htmlFor="cn">New category</Label><Input id="cn" className="tap" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Education" /></div>
          <div className="grid gap-1.5"><Label htmlFor="ct">Type</Label>
            <SelectField id="ct" value={type} onChange={(v) => setType(v as "expense" | "income")} options={[{ value: "expense", label: "Expense" }, { value: "income", label: "Income" }]} />
          </div>
          <div className="grid gap-1.5"><Label htmlFor="cc">Colour</Label><input id="cc" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="tap h-11 w-full cursor-pointer rounded-md border bg-background p-1" /></div>
          <Button className="tap" disabled={pending || !name.trim()} onClick={() => act(async () => { const r = await createCategoryAction({ name, type, color }); if (r.ok) setName(""); return r }, "Category added")}>
            <Plus aria-hidden /> Add
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

const REMINDER_COPY: Record<ReminderType, { title: string; help: string }> = {
  plan_day: { title: "Morning planning reminder", help: "A nudge to set today's limit." },
  close_day: { title: "Evening close-out reminder", help: "A nudge to review and close the day." },
  budget_threshold: { title: "Budget alert", help: "Highlight the dashboard when this much of the daily limit is used." },
}

function RemindersTab({ reminders }: { reminders: ReminderPreference[] }) {
  const { pending, act } = useAct()
  const byType = new Map(reminders.map((r) => [r.type, r]))
  const types: ReminderType[] = ["plan_day", "close_day", "budget_threshold"]
  const save = (r: ReminderPreference) => act(() => saveReminderAction(r))
  return (
    <Card>
      <CardHeader><CardTitle className="text-section">Reminders &amp; alerts</CardTitle><CardDescription>Everything is optional and can be turned off.</CardDescription></CardHeader>
      <CardContent className="flex flex-col divide-y">
        {types.map((t) => {
          const r = byType.get(t) ?? { type: t, enabled: false, time: t === "plan_day" ? "08:00" : t === "close_day" ? "21:00" : null, thresholdPercent: t === "budget_threshold" ? 90 : null }
          return (
            <div key={t} className="flex flex-wrap items-center gap-3 py-4 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <Label htmlFor={`r-${t}`} className="text-sm font-medium">{REMINDER_COPY[t].title}</Label>
                <p className="text-caption text-muted-foreground">{REMINDER_COPY[t].help}</p>
              </div>
              {t !== "budget_threshold" ? (
                <Input aria-label="Reminder time" type="time" className="tap w-32" value={r.time ?? ""} disabled={!r.enabled || pending} onChange={(e) => save({ ...r, time: e.target.value || null })} />
              ) : (
                <SelectField label="Alert threshold" className="w-28" value={String(r.thresholdPercent ?? 90)} disabled={!r.enabled || pending} onChange={(v) => save({ ...r, thresholdPercent: Number(v) })} options={THRESHOLD_OPTIONS.map((p) => ({ value: String(p), label: p + "%" }))} />
              )}
              <Switch id={`r-${t}`} checked={r.enabled} disabled={pending} onCheckedChange={(v) => save({ ...r, enabled: v })} />
            </div>
          )
        })}
        <p className="pt-4 text-caption text-muted-foreground">Budget alerts appear inside the app on your dashboard. Time-based reminders are saved now; push/email delivery is not part of this release.</p>
      </CardContent>
    </Card>
  )
}

function DataTab({ today }: { today: string }) {
  const { pending, act } = useAct()
  const [dialog, setDialog] = useState<null | "data" | "account">(null)
  const [confirm, setConfirm] = useState("")
  const close = () => { setDialog(null); setConfirm("") }
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle className="text-section">Export your data</CardTitle><CardDescription>Download every transaction as a CSV file you own.</CardDescription></CardHeader>
        <CardContent><ExportButton filters={{}} filename={`all_transactions_${today}.csv`} label="Export all transactions" /></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-section">Session</CardTitle></CardHeader>
        <CardContent>
          <form action={signOutAction}><Button type="submit" variant="outline" className="tap"><LogOut aria-hidden /> Sign out</Button></form>
        </CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-section text-destructive">Danger zone</CardTitle><CardDescription>These can&apos;t be undone. Export first if you might want your data later.</CardDescription></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" className="tap border-destructive/50 text-destructive" onClick={() => setDialog("data")}>Delete all transactions &amp; plans</Button>
          <Button variant="destructive" className="tap" onClick={() => setDialog("account")}>Delete my account</Button>
        </CardContent>
      </Card>
      <AlertDialog open={dialog !== null} onOpenChange={(o) => !o && close()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog === "account" ? "Delete your account?" : "Delete all transactions and plans?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {dialog === "account"
                ? "Your sign-in and every record (accounts, categories, budgets, transactions) will be permanently removed."
                : "Every transaction, daily budget and planned expense will be permanently removed. Accounts and categories are kept."}{" "}
              Type <strong>DELETE</strong> to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input aria-label="Type DELETE to confirm" className="tap" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" className="tap" disabled={confirm !== "DELETE" || pending}
              onClick={() => act(async () => {
                const r = dialog === "account" ? await deleteAccountAction({ confirm }) : await deleteAllDataAction({ confirm })
                if (r.ok) close()
                return r
              }, dialog === "data" ? "All transactions and plans were deleted" : undefined)}>
              {pending ? "Deleting…" : "Delete permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export function SettingsView({ reminders, today }: { reminders: ReminderPreference[]; today: string }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-title">Settings</h1>
      <Tabs defaultValue="profile" className="gap-5">
        <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <TabsList className="group-data-[orientation=horizontal]/tabs:h-12 w-max min-w-full justify-start gap-1 sm:w-fit">
          <TabsTrigger value="profile" className="tap flex-none px-4">Profile</TabsTrigger>
          <TabsTrigger value="accounts" className="tap flex-none px-4">Accounts</TabsTrigger>
          <TabsTrigger value="categories" className="tap flex-none px-4">Categories</TabsTrigger>
          <TabsTrigger value="reminders" className="tap flex-none px-4">Reminders</TabsTrigger>
          <TabsTrigger value="data" className="tap flex-none px-4">Data &amp; security</TabsTrigger>
        </TabsList>
        </div>
        <TabsContent value="profile"><ProfileTab /></TabsContent>
        <TabsContent value="accounts"><AccountsTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="reminders"><RemindersTab reminders={reminders} /></TabsContent>
        <TabsContent value="data"><DataTab today={today} /></TabsContent>
      </Tabs>
    </div>
  )
}

