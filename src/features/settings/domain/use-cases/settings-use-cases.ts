import { isValidTimezone } from "@/shared/domain/dates"
import { SUPPORTED_CURRENCIES } from "@/shared/domain/money"
import { ok, validation, type Result } from "@/shared/domain/result"
import type { BudgetRepository } from "@/features/budgets/domain/repositories/budget-repository"
import type { TransactionRepository } from "@/features/transactions/domain/repositories/transaction-repository"
import { THRESHOLD_OPTIONS, type Profile, type ReminderPreference } from "../entities/settings"
import type { ProfileRepository, ReminderRepository } from "../repositories/settings-repositories"

export class GetProfile {
  constructor(private readonly profiles: ProfileRepository) {}
  execute() {
    return this.profiles.get()
  }
}

export class UpdateProfile {
  constructor(private readonly profiles: ProfileRepository) {}
  async execute(patch: Partial<Pick<Profile, "displayName" | "currency" | "timezone">>): Promise<Result<Profile>> {
    const errors: Record<string, string> = {}
    if (patch.displayName !== undefined && patch.displayName.trim().length > 80) errors.displayName = "Name is too long."
    if (patch.currency !== undefined && !SUPPORTED_CURRENCIES.includes(patch.currency)) errors.currency = "Unsupported currency."
    if (patch.timezone !== undefined && !isValidTimezone(patch.timezone)) errors.timezone = "Unknown timezone."
    if (Object.keys(errors).length) return validation("Please fix the highlighted fields.", errors)
    return ok(await this.profiles.update({ ...patch, displayName: patch.displayName?.trim() }))
  }
}

export class ManageReminders {
  constructor(private readonly reminders: ReminderRepository) {}
  list() {
    return this.reminders.list()
  }
  async save(pref: ReminderPreference): Promise<Result<true>> {
    if (pref.time !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(pref.time)) return validation("Enter a valid time.", { time: "Use HH:mm." })
    if (pref.type === "budget_threshold" && pref.enabled && !(THRESHOLD_OPTIONS as readonly number[]).includes(pref.thresholdPercent ?? -1))
      return validation("Choose 75%, 90% or 100%.", { thresholdPercent: "Invalid threshold." })
    await this.reminders.save(pref)
    return ok(true)
  }
}

/** Deletes all transactions and budget plans. Accounts and categories are kept. */
export class DeleteAllMyData {
  constructor(
    private readonly transactions: TransactionRepository,
    private readonly budgets: BudgetRepository,
  ) {}
  async execute(): Promise<Result<true>> {
    await this.transactions.deleteAll()
    await this.budgets.deleteAll()
    return ok(true)
  }
}
