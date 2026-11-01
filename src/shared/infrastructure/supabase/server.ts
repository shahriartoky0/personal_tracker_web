import "server-only"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { supabaseEnv } from "@/shared/config/env"

/** Per-request, user-scoped client (publishable key + the user's session; RLS applies). */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const { url, anonKey } = supabaseEnv()
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(list) {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component: the middleware refreshes the session instead.
        }
      },
    },
  })
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>
