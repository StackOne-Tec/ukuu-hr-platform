import { NextRequest, NextResponse } from "next/server"
import {
  createOAuthState,
  encodeOAuthState,
  googleClientId,
  googleRedirectUri,
  googleCookieOptions,
  isSafeReturnPath,
  GOOGLE_STATE_COOKIE,
} from "@/lib/google-oauth"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const clientId = googleClientId()
  if (!clientId) {
    return NextResponse.json({ ok: false, error: "Google OAuth is not configured." }, { status: 503 })
  }

  const returnPath = req.nextUrl.searchParams.get("returnUrl") ?? ""
  const mode = req.nextUrl.searchParams.get("mode") === "signup" ? "signup" : "signin"
  const state = createOAuthState()
  const redirectUri = googleRedirectUri(req)
  const statePayload = encodeOAuthState({
    state,
    redirectUri,
    returnPath: isSafeReturnPath(returnPath) ? returnPath : "/dashboard",
    mode,
  })

  const googleUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
  googleUrl.searchParams.set("client_id", clientId)
  googleUrl.searchParams.set("redirect_uri", redirectUri)
  googleUrl.searchParams.set("response_type", "code")
  googleUrl.searchParams.set("scope", "openid email profile")
  googleUrl.searchParams.set("state", statePayload)
  googleUrl.searchParams.set("prompt", "select_account")

  const res = NextResponse.redirect(googleUrl)
  res.cookies.set(GOOGLE_STATE_COOKIE, state, googleCookieOptions())
  return res
}
