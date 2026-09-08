import "server-only"
import crypto from "node:crypto"
import type { NextRequest } from "next/server"

export const GOOGLE_STATE_COOKIE = "ukuu_google_oauth_state"

export function googleClientId(): string {
  return process.env.GOOGLE_CLIENT_ID?.trim() ?? ""
}

export function googleClientSecret(): string {
  return process.env.GOOGLE_CLIENT_SECRET?.trim() ?? ""
}

export function isSafeReturnPath(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && value !== "/login"
}

export function googleRedirectUri(req: NextRequest): string {
  const configured = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (configured) return configured

  return `${req.nextUrl.protocol}//${req.nextUrl.hostname}/api/auth/google/callback`
}

export function createOAuthState(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function encodeOAuthState(data: {
  state: string
  redirectUri: string
  returnPath: string
  mode: "signin" | "signup"
}): string {
  return Buffer.from(JSON.stringify(data), "utf8").toString("base64url")
}

export function decodeOAuthState(value: string): {
  state: string
  redirectUri: string
  returnPath: string
  mode: "signin" | "signup"
} | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Record<string, unknown>
    if (
      typeof parsed.state !== "string" ||
      typeof parsed.redirectUri !== "string" ||
      typeof parsed.returnPath !== "string" ||
      (parsed.mode !== "signin" && parsed.mode !== "signup")
    ) {
      return null
    }
    return {
      state: parsed.state,
      redirectUri: parsed.redirectUri,
      returnPath: parsed.returnPath,
      mode: parsed.mode,
    }
  } catch {
    return null
  }
}

export function googleCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  }
}
