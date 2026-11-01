export type DomainErrorCode = "validation" | "not_found" | "conflict" | "forbidden" | "unexpected"

export interface DomainError {
  code: DomainErrorCode
  message: string
  /** Field-level messages for validation errors, keyed by field name. */
  fields?: Record<string, string>
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: DomainError }

export const ok = <T>(value: T): Result<T> => ({ ok: true, value })

export const fail = (
  code: DomainErrorCode,
  message: string,
  fields?: Record<string, string>,
): { ok: false; error: DomainError } => ({ ok: false, error: { code, message, fields } })

export const validation = (message: string, fields?: Record<string, string>) =>
  fail("validation", message, fields)
export const notFound = (what: string) => fail("not_found", `${what} was not found.`)

/** Thrown by repositories for unexpected infrastructure failures (translated, never raw DB errors). */
export class RepositoryError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "RepositoryError"
  }
}
