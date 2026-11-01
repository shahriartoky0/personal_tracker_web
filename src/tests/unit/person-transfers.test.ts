import { describe, expect, it } from "vitest"
import {
  DeleteTransaction,
  ExportTransactions,
  UpdateTransaction,
} from "@/features/transactions/domain/use-cases/transaction-use-cases"
import {
  GetProofUrl,
  GetTransferTracker,
  RecordPersonTransfer,
  UpdatePersonTransfer,
  UploadProof,
} from "@/features/transfers/domain/use-cases/transfer-use-cases"
import { MAX_PROOF_BYTES, validateProof } from "@/features/transfers/domain/services/proof"
import { summarizeDay } from "@/features/budgets/domain/services/budget-calculator"
import { onLocalDate } from "@/features/transactions/domain/services/transaction-calculator"
import { accountBalance } from "@/features/accounts/domain/services/balance"
import { buildPeriodReport } from "@/features/reports/domain/services/period-report"
import { seedWorld } from "@/shared/demo/in-memory-repositories"

const TZ = "Asia/Dhaka"
const NOON = "2025-03-10T06:00:00Z"

function setup() {
  const w = seedWorld()
  const deps = { transactions: w.transactions, accounts: w.accounts, payees: w.payees, proofs: w.proofs }
  const txDeps = { transactions: w.transactions, accounts: w.accounts, categories: w.categories, payees: w.payees }
  return { ...w, record: new RecordPersonTransfer(deps), update: new UpdatePersonTransfer(deps), deps, txDeps }
}

const send = (w: ReturnType<typeof setup>, payeeName: string, amount: number, occurredAt = NOON, extra = {}) =>
  w.record.execute({ accountId: "cash", payeeName, direction: "out", amount, occurredAt, ...extra })

describe("recording transfers to people", () => {
  it("creates the person on first use and reuses them case-insensitively", async () => {
    const w = setup()
    await send(w, "Rahim", 50_000)
    await send(w, "  rahim ", 20_000)
    await send(w, "Karim", 10_000)
    expect(w.payees.items.map((p) => p.name)).toEqual(["Rahim", "Karim"])
    expect(w.transactions.items).toHaveLength(3)
  })

  it("moves the account balance but is never an expense or income", async () => {
    const w = setup()
    await send(w, "Rahim", 30_000)
    await w.record.execute({ accountId: "cash", payeeName: "Rahim", direction: "in", amount: 5_000, occurredAt: NOON })
    expect(accountBalance(w.cash, w.transactions.items)).toBe(100_000 - 30_000 + 5_000)
    const day = summarizeDay(null, onLocalDate(w.transactions.items, "2025-03-10", TZ))
    expect(day.spent).toBe(0)
    const rep = buildPeriodReport({
      range: { from: "2025-03-01", to: "2025-03-31" }, timezone: TZ, accounts: [w.cash, w.bank],
      transactions: w.transactions.items, previousTransactions: [], budgets: [],
    })
    expect(rep.expenses).toBe(0)
    expect(rep.income).toBe(0)
    expect(rep.closingBalance).toBe(rep.openingBalance - 30_000 + 5_000)
  })

  it("validates name, amount, date, direction and account", async () => {
    const w = setup()
    expect((await send(w, "   ", 100)).ok).toBe(false)
    expect((await send(w, "x".repeat(81), 100)).ok).toBe(false)
    for (const amount of [0, -1, 1.5]) expect((await send(w, "A", amount)).ok).toBe(false)
    expect((await send(w, "A", 100, "nope")).ok).toBe(false)
    expect((await w.record.execute({ accountId: "ghost", payeeName: "A", direction: "out", amount: 1, occurredAt: NOON })).ok).toBe(false)
    expect((await w.record.execute({ accountId: "cash", payeeName: "A", direction: "sideways" as never, amount: 1, occurredAt: NOON })).ok).toBe(false)
    expect(w.transactions.items).toHaveLength(0)
    expect(w.payees.items).toHaveLength(0) // nothing is created when validation fails
  })

  it("restores an archived person when their name is used again", async () => {
    const w = setup()
    const first = await send(w, "Rahim", 100)
    if (!first.ok) throw new Error()
    await w.payees.update(first.value.payeeId!, { isArchived: true })
    await send(w, "Rahim", 100)
    expect(w.payees.items).toHaveLength(1)
    expect(w.payees.items[0].isArchived).toBe(false)
  })
})

describe("editing and deleting", () => {
  it("edits fields, and swaps the proof (old file is removed)", async () => {
    const w = setup()
    const up = await new UploadProof(w.proofs).execute({ bytes: new ArrayBuffer(10), contentType: "image/jpeg", size: 10 })
    if (!up.ok) throw new Error()
    const created = await send(w, "Rahim", 1_000, NOON, { receiptPath: up.value.path })
    if (!created.ok) throw new Error()
    const up2 = await new UploadProof(w.proofs).execute({ bytes: new ArrayBuffer(10), contentType: "image/png", size: 10 })
    if (!up2.ok) throw new Error()
    const r = await w.update.execute(created.value.id, { amount: 2_500, payeeName: "Karim", direction: "in", receiptPath: up2.value.path })
    expect(r.ok && r.value).toMatchObject({ amount: 2_500, transferDirection: "in", receiptPath: up2.value.path })
    expect(w.proofs.files.has(up.value.path)).toBe(false)
    expect(w.proofs.files.has(up2.value.path)).toBe(true)
    const removed = await w.update.execute(created.value.id, { receiptPath: null })
    expect(removed.ok && removed.value.receiptPath).toBeNull()
    expect(w.proofs.files.size).toBe(0)
  })

  it("won't edit the wrong kind of transaction, and the generic editor refuses person transfers", async () => {
    const w = setup()
    const created = await send(w, "Rahim", 1_000)
    if (!created.ok) throw new Error()
    expect((await new UpdateTransaction(w.txDeps).execute(created.value.id, { amount: 5 })).ok).toBe(false)
    const exp = await w.transactions.create({ accountId: "cash", categoryId: "food", type: "expense", amount: 1, occurredAt: NOON })
    expect((await w.update.execute(exp.id, { amount: 5 })).ok).toBe(false)
    expect((await w.update.execute("ghost", { amount: 5 })).ok).toBe(false)
  })

  it("deleting a transfer also deletes its proof image", async () => {
    const w = setup()
    const up = await new UploadProof(w.proofs).execute({ bytes: new ArrayBuffer(10), contentType: "image/webp", size: 10 })
    if (!up.ok) throw new Error()
    const created = await send(w, "Rahim", 1_000, NOON, { receiptPath: up.value.path })
    if (!created.ok) throw new Error()
    expect((await new DeleteTransaction(w.transactions, w.proofs).execute(created.value.id)).ok).toBe(true)
    expect(w.proofs.files.size).toBe(0)
  })
})

describe("proof validation", () => {
  it("accepts small images only", () => {
    expect(validateProof({ size: 1000, contentType: "image/jpeg" })).toBeNull()
    expect(validateProof({ size: 1000, contentType: "application/pdf" })).not.toBeNull()
    expect(validateProof({ size: 0, contentType: "image/png" })).not.toBeNull()
    expect(validateProof({ size: MAX_PROOF_BYTES + 1, contentType: "image/png" })).not.toBeNull()
    expect(validateProof({ size: MAX_PROOF_BYTES, contentType: "image/webp" })).toBeNull()
  })
  it("rejects bad uploads and reports unknown proofs", async () => {
    const w = setup()
    expect((await new UploadProof(w.proofs).execute({ bytes: new ArrayBuffer(1), contentType: "text/html", size: 1 })).ok).toBe(false)
    expect((await new GetProofUrl(w.proofs).execute("nope")).ok).toBe(false)
  })
})

describe("transfer tracker", () => {
  async function world() {
    const w = setup()
    await send(w, "Rahim", 50_000, "2025-03-10T06:00:00Z", { receiptPath: "p1" })
    await send(w, "Rahim", 25_000, "2025-03-15T06:00:00Z")
    await send(w, "Karim", 10_000, "2025-03-12T06:00:00Z")
    await send(w, "Rahim", 70_000, "2025-02-20T06:00:00Z") // earlier period
    await w.record.execute({ accountId: "bank", payeeName: "Karim", direction: "in", amount: 4_000, occurredAt: "2025-03-20T06:00:00Z" })
    // Unrelated rows must be ignored.
    await w.transactions.create({ accountId: "cash", categoryId: "food", type: "expense", amount: 999, occurredAt: NOON })
    await w.transactions.createTransfer({ fromAccountId: "cash", toAccountId: "bank", amount: 123, occurredAt: NOON })
    return w
  }
  const tracker = (w: ReturnType<typeof setup>) => new GetTransferTracker(w.transactions, w.payees)

  it("summarises the period per person with all-time totals", async () => {
    const w = await world()
    const r = await tracker(w).execute({ from: "2025-03-01", to: "2025-03-31" }, TZ)
    if (!r.ok) throw new Error()
    const t = r.value
    expect(t).toMatchObject({ sent: 85_000, received: 4_000, netSent: 81_000, count: 4, peopleCount: 2, withProof: 1 })
    expect(t.byPayee[0]).toMatchObject({ name: "Rahim", sent: 75_000, count: 2, sentAllTime: 145_000 })
    expect(t.byPayee[1]).toMatchObject({ name: "Karim", sent: 10_000, received: 4_000, sentAllTime: 10_000, receivedAllTime: 4_000 })
    expect(t.transfers[0].occurredAt > t.transfers[1].occurredAt).toBe(true) // newest first
  })

  it("can focus on one person and handles empty periods", async () => {
    const w = await world()
    const one = await tracker(w).execute({ from: "2025-03-01", to: "2025-03-31" }, TZ, w.payees.items[0].id)
    if (!one.ok) throw new Error()
    expect(one.value.byPayee.map((p) => p.name)).toEqual(["Rahim"])
    expect(one.value.sent).toBe(75_000)
    const none = await tracker(w).execute({ from: "2024-01-01", to: "2024-01-31" }, TZ)
    expect(none.ok && none.value).toMatchObject({ sent: 0, count: 0, byPayee: [] })
    expect((await tracker(w).execute({ from: "2025-03-31", to: "2025-03-01" }, TZ)).ok).toBe(false)
  })

  it("respects the local-day boundary in the user's timezone", async () => {
    const w = setup()
    // 00:30 Dhaka on Mar 1 == 18:30Z Feb 28
    await send(w, "Rahim", 100, "2025-02-28T18:30:00Z")
    const mar = await tracker(w).execute({ from: "2025-03-01", to: "2025-03-31" }, TZ)
    const feb = await tracker(w).execute({ from: "2025-02-01", to: "2025-02-28" }, TZ)
    expect(mar.ok && mar.value.count).toBe(1)
    expect(feb.ok && feb.value.count).toBe(0)
  })
})

describe("export includes people transfers", () => {
  it("writes the person and a signed amount", async () => {
    const w = setup()
    await send(w, "Rahim", 12_550, NOON, { note: "loan" })
    const r = await new ExportTransactions(w.txDeps).execute({ type: "person_transfer" }, TZ)
    if (!r.ok) throw new Error()
    expect(r.value.trim().split("\r\n")[1]).toBe("2025-03-10,12:00,person_out,-125.50,,Cash,,Rahim,,loan,")
  })
})
