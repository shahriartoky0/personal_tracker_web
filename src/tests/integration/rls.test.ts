import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { beforeAll, describe, expect, it } from "vitest"

/**
 * Two-user isolation test against a real Supabase project.
 * Skipped unless TEST_USER_A_* / TEST_USER_B_* are set (two confirmed users) — use a TEST project.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const creds = ["A", "B"].map((n) => ({
  email: process.env[`TEST_USER_${n}_EMAIL`],
  password: process.env[`TEST_USER_${n}_PASSWORD`],
}))
const enabled = Boolean(url && key && creds.every((c) => c.email && c.password))

describe.skipIf(!enabled)("RLS: user isolation", () => {
  let a: SupabaseClient
  let b: SupabaseClient
  let anon: SupabaseClient
  let aId = ""
  let bId = ""
  let aAccount = ""
  let aCategory = ""
  let aTx = ""

  async function login(i: number) {
    const c = createClient(url!, key!, { auth: { persistSession: false } })
    const { data, error } = await c.auth.signInWithPassword({ email: creds[i].email!, password: creds[i].password! })
    if (error) throw error
    return { c, id: data.user.id }
  }

  beforeAll(async () => {
    ;({ c: a, id: aId } = await login(0))
    ;({ c: b, id: bId } = await login(1))
    anon = createClient(url!, key!, { auth: { persistSession: false } })

    aAccount = (await a.from("accounts").select("id").limit(1).single()).data!.id
    aCategory = (await a.from("categories").select("id").eq("type", "expense").limit(1).single()).data!.id
    const tx = await a
      .from("transactions")
      .insert({ user_id: aId, account_id: aAccount, category_id: aCategory, type: "expense", amount: 123 })
      .select("id")
      .single()
    expect(tx.error).toBeNull()
    aTx = tx.data!.id
  })

  it("signup trigger created defaults for each user", async () => {
    expect((await a.from("categories").select("id")).data!.length).toBeGreaterThan(5)
    expect((await a.from("profiles").select("currency").single()).data?.currency).toBeTruthy()
  })

  it("B cannot read A's rows", async () => {
    for (const t of ["accounts", "categories", "transactions", "profiles", "daily_budgets", "budget_allocations", "planned_expenses"]) {
      const { data } = await b.from(t).select("*").eq(t === "profiles" ? "id" : "user_id", aId)
      expect(data ?? []).toHaveLength(0)
    }
    expect((await b.from("transactions").select("id").eq("id", aTx)).data).toHaveLength(0)
  })

  it("B cannot update or delete A's transaction", async () => {
    const up = await b.from("transactions").update({ amount: 999 }).eq("id", aTx).select("id")
    expect(up.data ?? []).toHaveLength(0)
    const del = await b.from("transactions").delete().eq("id", aTx).select("id")
    expect(del.data ?? []).toHaveLength(0)
    expect((await a.from("transactions").select("amount").eq("id", aTx).single()).data?.amount).toBe(123)
  })

  it("B cannot insert rows as A, or point at A's account/category", async () => {
    const asA = await b.from("transactions").insert({ user_id: aId, account_id: aAccount, category_id: aCategory, type: "expense", amount: 1 })
    expect(asA.error).not.toBeNull()
    const bAcc = (await b.from("accounts").select("id").limit(1).single()).data!.id
    const cross = await b.from("transactions").insert({ user_id: bId, account_id: aAccount, category_id: aCategory, type: "expense", amount: 1 })
    expect(cross.error).not.toBeNull() // composite FK (id, user_id)
    const crossCat = await b.from("transactions").insert({ user_id: bId, account_id: bAcc, category_id: aCategory, type: "expense", amount: 1 })
    expect(crossCat.error).not.toBeNull()
  })

  it("B cannot create a transfer involving A's account", async () => {
    const bAcc = (await b.from("accounts").select("id").limit(1).single()).data!.id
    const r = await b.rpc("create_transfer", { p_from: bAcc, p_to: aAccount, p_amount: 10, p_occurred_at: new Date().toISOString(), p_note: null })
    expect(r.error).not.toBeNull()
  })

  it("unauthenticated requests see nothing and cannot write", async () => {
    for (const t of ["accounts", "categories", "transactions", "profiles", "daily_budgets"]) {
      const { data } = await anon.from(t).select("*")
      expect(data ?? []).toHaveLength(0)
    }
    expect((await anon.from("transactions").insert({ user_id: aId, account_id: aAccount, category_id: aCategory, type: "expense", amount: 1 })).error).not.toBeNull()
  })

  it("receipts bucket is private and folder-scoped", async () => {
    const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" })
    expect((await a.storage.from("receipts").upload(`${aId}/t.png`, png, { upsert: true })).error).toBeNull()
    expect((await b.storage.from("receipts").upload(`${aId}/x.png`, png)).error).not.toBeNull()
    expect((await b.storage.from("receipts").download(`${aId}/t.png`)).error).not.toBeNull()
    await a.storage.from("receipts").remove([`${aId}/t.png`])
  })

  it("cleans up", async () => {
    expect((await a.from("transactions").delete().eq("id", aTx)).error).toBeNull()
  })
})
