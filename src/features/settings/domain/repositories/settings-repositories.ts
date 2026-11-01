import type { Profile, ReminderPreference } from "../entities/settings"

export interface ProfileRepository {
  /** The signed-in user's profile (created on signup; upserted if missing). */
  get(): Promise<Profile>
  update(patch: Partial<Pick<Profile, "displayName" | "currency" | "timezone">>): Promise<Profile>
}

export interface ReminderRepository {
  list(): Promise<ReminderPreference[]>
  save(pref: ReminderPreference): Promise<void>
}
