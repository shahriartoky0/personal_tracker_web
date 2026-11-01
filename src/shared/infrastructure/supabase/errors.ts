import { RepositoryError } from "@/shared/domain/result"

interface PgError {
  code?: string
  message: string
}

/** Unwraps a Supabase response, translating database errors into typed domain errors (never raw text). */
export function unwrap<T>(res: { data: T | null; error: PgError | null }): T {
  if (res.error) throw translate(res.error)
  return res.data as T
}

export function unwrapVoid(res: { error: PgError | null }): void {
  if (res.error) throw translate(res.error)
}

export function translate(error: PgError): RepositoryError {
  switch (error.code) {
    case "23503":
      return new RepositoryError("validation", "A referenced record doesn't exist or isn't yours.")
    case "23505":
      return new RepositoryError("conflict", "That record already exists.")
    case "23514":
    case "22P02":
      return new RepositoryError("validation", "Some values are not valid.")
    case "42501":
    case "PGRST301":
      return new RepositoryError("forbidden", "You don't have access to that.")
    default:
      console.error("[supabase]", error.code, error.message)
      return new RepositoryError("unexpected", "Something went wrong. Please try again.")
  }
}

/** Fetches every row of a query in pages (PostgREST caps responses at 1000 rows). */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PgError | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const rows = unwrap(await page(from, from + pageSize - 1)) ?? []
    out.push(...rows)
    if (rows.length < pageSize) return out
  }
}
