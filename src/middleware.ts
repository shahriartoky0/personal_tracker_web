import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PUBLIC_PATHS = ["/login", "/signup", "/forgot-password", "/auth", "/demo", "/offline"]

/** Refreshes the Supabase session cookie and redirects signed-out visitors to /login. */
export async function middleware(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    // Misconfigured deployment: keep public pages alive and explain, instead of a blanket 500.
    const p = request.nextUrl.pathname
    if (PUBLIC_PATHS.some((x) => p === x || p.startsWith(`${x}/`))) return NextResponse.next()
    return new NextResponse("Setup incomplete: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in the hosting environment variables, then redeploy.", { status: 503 })
  }
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(list) {
          for (const { name, value } of list) request.cookies.set(name, value)
          response = NextResponse.next({ request })
          for (const { name, value, options } of list) response.cookies.set(name, value, options)
        },
      },
    },
  )

  // getClaims verifies the JWT locally (no network round trip) and refreshes it when expired.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null
  const path = request.nextUrl.pathname
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`))

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.search = ""
    return NextResponse.redirect(url)
  }
  if (user && ["/login", "/signup", "/forgot-password"].includes(path)) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)"],
}
