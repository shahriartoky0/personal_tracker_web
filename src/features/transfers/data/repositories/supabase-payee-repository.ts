import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { unwrap } from "@/shared/infrastructure/supabase/errors"
import type { Payee } from "../../domain/entities/payee"
import type { PayeeRepository } from "../../domain/repositories/transfer-ports"

interface PayeeRow {
  id: string
  name: string
  is_archived: boolean
}

const toPayee = (r: PayeeRow): Payee => ({ id: r.id, name: r.name, isArchived: r.is_archived })

/** ILIKE treats % _ \ as wildcards; escape them so the name is matched literally. */
const literal = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`)

export class SupabasePayeeRepository implements PayeeRepository {
  constructor(
    private readonly db: SupabaseServerClient,
    private readonly userId: string,
  ) {}

  async list() {
    const rows = unwrap(await this.db.from("payees").select("*").order("created_at", { ascending: false })) as PayeeRow[]
    return rows.map(toPayee)
  }

  async getById(id: string) {
    const row = unwrap(await this.db.from("payees").select("*").eq("id", id).maybeSingle()) as PayeeRow | null
    return row ? toPayee(row) : null
  }

  async findByName(name: string) {
    const row = unwrap(await this.db.from("payees").select("*").ilike("name", literal(name)).limit(1).maybeSingle()) as PayeeRow | null
    return row ? toPayee(row) : null
  }

  async create(name: string) {
    return toPayee(unwrap(await this.db.from("payees").insert({ user_id: this.userId, name }).select("*").single()) as PayeeRow)
  }

  async update(id: string, patch: { name?: string; isArchived?: boolean }) {
    const row = unwrap(
      await this.db
        .from("payees")
        .update({
          ...(patch.name !== undefined && { name: patch.name }),
          ...(patch.isArchived !== undefined && { is_archived: patch.isArchived }),
        })
        .eq("id", id)
        .select("*")
        .maybeSingle(),
    ) as PayeeRow | null
    return row ? toPayee(row) : null
  }
}
