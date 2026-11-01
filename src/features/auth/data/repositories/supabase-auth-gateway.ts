import "server-only"
import { createClient } from "@supabase/supabase-js"
import type { SupabaseServerClient } from "@/shared/infrastructure/supabase/server"
import { siteUrl, supabaseEnv } from "@/shared/config/env"
import { fail, ok, validation, type Result } from "@/shared/domain/result"
import type { AuthGateway, AuthUser, SignUpOutcome } from "../../domain/repositories/auth-gateway"

/** Maps Supabase auth errors to friendly, non-leaky messages. */
function friendly(error: { message: string; code?: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "Incorrect email or password."
    case "email_not_confirmed":
      return "Please confirm your email first — check your inbox for the link."
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists."
    case "weak_password":
      return "Choose a stronger password (at least 8 characters, mixing letters and numbers)."
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a minute and try again."
    default:
      return error.status === 429 ? "Too many attempts. Please wait a minute and try again." : "Something went wrong. Please try again."
  }
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly db: SupabaseServerClient) {}

  async currentUser(): Promise<AuthUser | null> {
    const { data } = await this.db.auth.getUser()
    return data.user ? { id: data.user.id, email: data.user.email ?? "" } : null
  }

  async signUp(input: { email: string; password: string; displayName: string }): Promise<Result<SignUpOutcome>> {
    const { data, error } = await this.db.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: { display_name: input.displayName },
        emailRedirectTo: `${siteUrl()}/auth/callback?next=/`,
      },
    })
    if (error) return fail("validation", friendly(error))
    // With email confirmation enabled Supabase returns a user but no session.
    return ok(data.session ? "signed_in" : "confirmation_required")
  }

  async signIn(input: { email: string; password: string }): Promise<Result<AuthUser>> {
    const { data, error } = await this.db.auth.signInWithPassword(input)
    if (error || !data.user) return fail("validation", error ? friendly(error) : "Incorrect email or password.")
    return ok({ id: data.user.id, email: data.user.email ?? "" })
  }

  async signOut() {
    await this.db.auth.signOut()
  }

  async requestPasswordReset(email: string): Promise<Result<true>> {
    const { error } = await this.db.auth.resetPasswordForEmail(email, {
      redirectTo: `${siteUrl()}/auth/callback?next=/reset-password`,
    })
    // Same response whether or not the email exists, to avoid account enumeration.
    if (error && (error.status === 429 || error.code?.startsWith("over_"))) return fail("validation", friendly(error))
    return ok(true)
  }

  async updatePassword(password: string): Promise<Result<true>> {
    const { error } = await this.db.auth.updateUser({ password })
    return error ? fail("validation", friendly(error)) : ok(true)
  }

  async exchangeCode(code: string): Promise<Result<true>> {
    const { error } = await this.db.auth.exchangeCodeForSession(code)
    return error ? fail("validation", "This link is invalid or has expired.") : ok(true)
  }

  /**
   * Requires SUPABASE_SERVICE_ROLE_KEY as a *server-only* secret (never NEXT_PUBLIC_).
   * The key is used for this single admin call and nothing else.
   */
  async deleteAccount(): Promise<Result<true>> {
    const user = await this.currentUser()
    if (!user) return fail("forbidden", "You are not signed in.")
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey)
      return validation(
        "Account deletion isn't configured on this deployment. Delete your data from Settings, then remove the user in the Supabase dashboard (Authentication → Users).",
      )
    const admin = createClient(supabaseEnv().url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return fail("unexpected", "Couldn't delete the account. Please try again.")
    await this.db.auth.signOut()
    return ok(true)
  }
}
