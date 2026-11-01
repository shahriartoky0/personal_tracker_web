import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { unwrap } from "@/shared/infrastructure/supabase/errors"
import type { AccountRow } from "../dto/account-dto"

export class AccountDatasource {
  constructor(private readonly db: SupabaseServerClient) {}
  async list() {
    return unwrap(await this.db.from("accounts").select("*").order("created_at")) as AccountRow[]
  }
  async get(id: string) {
    return unwrap(await this.db.from("accounts").select("*").eq("id", id).maybeSingle()) as AccountRow | null
  }
  async insert(row: Record<string, unknown>) {
    return unwrap(await this.db.from("accounts").insert(row).select("*").single()) as AccountRow
  }
  async update(id: string, patch: Record<string, unknown>) {
    return unwrap(await this.db.from("accounts").update(patch).eq("id", id).select("*").maybeSingle()) as AccountRow | null
  }
}
