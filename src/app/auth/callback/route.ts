import { NextResponse, type NextRequest } from "next/server"
import { getAuthGateway } from "@/shared/infrastructure/container"

/** Completes email-confirmation and password-recovery links. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/"
  // Only allow same-site relative redirects.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"

  if (code) {
    const result = await (await getAuthGateway()).exchangeCode(code)
    if (result.ok) return NextResponse.redirect(`${origin}${safeNext}`)
  }
  return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent("That link is invalid or has expired. Please try again.")}`)
}
