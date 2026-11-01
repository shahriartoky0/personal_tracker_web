export interface Profile {
  id: string
  displayName: string
  currency: string
  timezone: string
}

export type ReminderType = "plan_day" | "close_day" | "budget_threshold"

export interface ReminderPreference {
  type: ReminderType
  enabled: boolean
  /** HH:mm, for time-based reminders. */
  time: string | null
  /** For budget_threshold: 75, 90 or 100. */
  thresholdPercent: number | null
}

export const THRESHOLD_OPTIONS = [75, 90, 100] as const
