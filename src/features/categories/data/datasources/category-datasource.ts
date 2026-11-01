import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { unwrap } from "@/shared/infrastructure/supabase/errors"
import type { CategoryRow } from "../dto/category-dto"

export class CategoryDatasource {
  constructor(private readonly db: SupabaseServerClient) {}
  async list() {
    return unwrap(await this.db.from("categories").select("*").order("created_at")) as CategoryRow[]
  }
  async get(id: string) {
    return unwrap(await this.db.from("categories").select("*").eq("id", id).maybeSingle()) as CategoryRow | null
  }
  async insert(row: Record<string, unknown>) {
    return unwrap(await this.db.from("categories").insert(row).select("*").single()) as CategoryRow
  }
  async update(id: string, patch: Record<string, unknown>) {
    return unwrap(await this.db.from("categories").update(patch).eq("id", id).select("*").maybeSingle()) as CategoryRow | null
  }
}
