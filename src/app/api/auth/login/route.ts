import { NextResponse } from "next/server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? ""
  const parts = local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
  if (parts.length === 0) return "Ukuu User"
  if (parts.length === 1) return `${parts[0]} User`
  return parts.slice(0, 2).join(" ")
}

function makeToken(): string {
  return `ukuu_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`
}

/**
 * Mock sign-in endpoint for the demo auth experience.
 * Accepts any syntactically valid email + password (>= 6 chars) and
 * returns a fake session token. Replace with real auth later.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown
    password?: unknown
    remember?: unknown
  } | null

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body?.password === "string" ? body.password : ""

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 }
    )
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    )
  }

  /* simulate verification latency */
  await new Promise((r) => setTimeout(r, 550))

  const remember = body?.remember === true
  return NextResponse.json({
    ok: true,
    user: { email, name: nameFromEmail(email) },
    token: makeToken(),
    session: remember ? "persistent" : "ephemeral",
  })
}
