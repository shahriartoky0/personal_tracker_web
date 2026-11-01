import type { Result } from "@/shared/domain/result"

export interface AuthUser {
  id: string
  email: string
}

export type SignUpOutcome = "signed_in" | "confirmation_required"

export interface AuthGateway {
  currentUser(): Promise<AuthUser | null>
  signUp(input: { email: string; password: string; displayName: string }): Promise<Result<SignUpOutcome>>
  signIn(input: { email: string; password: string }): Promise<Result<AuthUser>>
  signOut(): Promise<void>
  requestPasswordReset(email: string): Promise<Result<true>>
  updatePassword(password: string): Promise<Result<true>>
  /** Completes an email-link flow (confirmation / recovery) from the `code` query parameter. */
  exchangeCode(code: string): Promise<Result<true>>
  /** Permanently deletes the signed-in user's auth account (and, by cascade, all their data). */
  deleteAccount(): Promise<Result<true>>
}
