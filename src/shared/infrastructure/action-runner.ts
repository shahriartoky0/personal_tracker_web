import "server-only"
import type { ZodType } from "zod"
import { getContainer, type Container } from "@/shared/infrastructure/container"
import { RepositoryError, type Result } from "@/shared/domain/result"
import type { Profile } from "@/features/settings/domain/entities/settings"
import type { ActionResult } from "@/shared/lib/action-result"

export interface ActionContext {
  c: Container
  profile: Profile
}

function zodFieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form")
    if (!fields[key]) fields[key] = issue.message
  }
  return fields
}

/**
 * Thin server-action wrapper: authenticates, validates input with Zod, runs a use case and
 * translates the typed result. Business rules live in the use cases, not here.
 */
export async function runAction<S, T = undefined>(
  schema: ZodType<S>,
  input: unknown,
  handler: (data: S, ctx: ActionContext) => Promise<Result<T>>,
  successMessage?: string,
): Promise<ActionResult<T>> {
  const c = await getContainer()
  if (!c) return { ok: false, message: "Your session has expired. Please sign in again." }
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, message: "Please fix the highlighted fields.", fieldErrors: zodFieldErrors(parsed.error) }
  }
  try {
    const profile = await c.settings.profile.execute()
    const result = await handler(parsed.data, { c, profile })
    if (!result.ok) return { ok: false, message: result.error.message, fieldErrors: result.error.fields }
    return { ok: true, data: result.value, message: successMessage }
  } catch (e) {
    if (e instanceof RepositoryError) return { ok: false, message: e.message }
    console.error("[action]", e)
    return { ok: false, message: "Something went wrong. Please try again." }
  }
}
