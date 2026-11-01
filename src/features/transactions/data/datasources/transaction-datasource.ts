import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { fetchAll, unwrap, unwrapVoid } from "@/shared/infrastructure/supabase/errors"
import type { TransactionFilter } from "../../domain/entities/transaction"
import type { TransactionRow } from "../dto/transaction-dto"

/** Strip characters that would alter a PostgREST or()/ilike expression. */
function safeSearch(s: string) {
  return s.replace(/[,()%_\\*]/g, " ").trim()
}

export class TransactionDatasource {
  constructor(private readonly db: SupabaseServerClient) {}

  list(filter: TransactionFilter = {}) {
    return fetchAll<TransactionRow>((from, to) => {
      let q = this.db.from("transactions").select("*")
      if (filter.from) q = q.gte("occurred_at", filter.from)
      if (filter.to) q = q.lt("occurred_at", filter.to)
      if (filter.categoryId) q = q.eq("category_id", filter.categoryId)
      if (filter.accountId) q = q.eq("account_id", filter.accountId)
      if (filter.type) q = q.eq("type", filter.type)
      if (filter.plannedStatus) q = q.eq("type", "expense").eq("planned_status", filter.plannedStatus)
      const term = filter.search ? safeSearch(filter.search) : ""
      if (term) q = q.or(`merchant.ilike.%${term}%,note.ilike.%${term}%`)
      return q.order("occurred_at", { ascending: false }).order("created_at", { ascending: false }).range(from, to)
    })
  }

  async get(id: string) {
    return unwrap(await this.db.from("transactions").select("*").eq("id", id).maybeSingle()) as TransactionRow | null
  }

  async insert(row: Record<string, unknown>) {
    return unwrap(await this.db.from("transactions").insert(row).select("*").single()) as TransactionRow
  }

  async update(id: string, patch: Record<string, unknown>) {
    return unwrap(
      await this.db.from("transactions").update(patch).eq("id", id).select("*").maybeSingle(),
    ) as TransactionRow | null
  }

  async delete(id: string) {
    const rows = unwrap(await this.db.from("transactions").delete().eq("id", id).select("id")) as { id: string }[]
    return rows.length > 0
  }

  async deleteGroup(groupId: string) {
    const rows = unwrap(
      await this.db.from("transactions").delete().eq("transfer_group_id", groupId).select("id"),
    ) as { id: string }[]
    return rows.length > 0
  }

  async deleteAll(userId: string) {
    unwrapVoid(await this.db.from("transactions").delete().eq("user_id", userId))
  }

  async createTransfer(args: { from: string; to: string; amount: number; occurredAt: string; note: string | null }) {
    return unwrap(
      await this.db.rpc("create_transfer", {
        p_from: args.from,
        p_to: args.to,
        p_amount: args.amount,
        p_occurred_at: args.occurredAt,
        p_note: args.note,
      }),
    ) as string
  }
}
