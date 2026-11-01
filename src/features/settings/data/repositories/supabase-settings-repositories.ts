import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { unwrap, unwrapVoid } from "@/shared/infrastructure/supabase/errors"
import type { Profile, ReminderPreference, ReminderType } from "../../domain/entities/settings"
import type { ProfileRepository, ReminderRepository } from "../../domain/repositories/settings-repositories"

interface ProfileRow {
  id: string
  display_name: string
  currency: string
  timezone: string
}

interface ReminderRow {
  reminder_type: ReminderType
  enabled: boolean
  reminder_time: string | null
  threshold_percent: number | null
}

const toProfile = (r: ProfileRow): Profile => ({
  id: r.id,
  displayName: r.display_name,
  currency: r.currency,
  timezone: r.timezone,
})

export class SupabaseProfileRepository implements ProfileRepository {
  constructor(
    private readonly db: SupabaseServerClient,
    private readonly userId: string,
  ) {}

  async get() {
    const row = unwrap(await this.db.from("profiles").select("*").eq("id", this.userId).maybeSingle()) as ProfileRow | null
    if (row) return toProfile(row)
    // Safety net for users created before the signup trigger existed.
    return toProfile(unwrap(await this.db.from("profiles").upsert({ id: this.userId }).select("*").single()) as ProfileRow)
  }

  async update(patch: Partial<Pick<Profile, "displayName" | "currency" | "timezone">>) {
    const row = unwrap(
      await this.db
        .from("profiles")
        .update({
          ...(patch.displayName !== undefined && { display_name: patch.displayName }),
          ...(patch.currency !== undefined && { currency: patch.currency }),
          ...(patch.timezone !== undefined && { timezone: patch.timezone }),
        })
        .eq("id", this.userId)
        .select("*")
        .single(),
    ) as ProfileRow
    return toProfile(row)
  }
}

export class SupabaseReminderRepository implements ReminderRepository {
  constructor(
    private readonly db: SupabaseServerClient,
    private readonly userId: string,
  ) {}

  async list() {
    const rows = unwrap(await this.db.from("reminder_preferences").select("*")) as ReminderRow[]
    return rows.map(
      (r): ReminderPreference => ({
        type: r.reminder_type,
        enabled: r.enabled,
        time: r.reminder_time ? r.reminder_time.slice(0, 5) : null,
        thresholdPercent: r.threshold_percent,
      }),
    )
  }

  async save(pref: ReminderPreference) {
    unwrapVoid(
      await this.db.from("reminder_preferences").upsert(
        {
          user_id: this.userId,
          reminder_type: pref.type,
          enabled: pref.enabled,
          reminder_time: pref.time,
          threshold_percent: pref.thresholdPercent,
        },
        { onConflict: "user_id,reminder_type" },
      ),
    )
  }
}
