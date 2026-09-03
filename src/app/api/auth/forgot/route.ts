import { NextResponse } from "next/server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Mock password-recovery endpoint.
 * Always responds positively (does not leak whether an account exists).
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    email?: unknown
  } | null

  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : ""

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter the email linked to your account." },
      { status: 400 }
    )
  }

  await new Promise((r) => setTimeout(r, 600))

  return NextResponse.json({
    ok: true,
    message: `If an account exists for ${email}, a password reset link is on its way.`,
  })
}
