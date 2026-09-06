import { NextResponse } from "next/server"
import { sendEmail, passwordResetEmailHtml } from "@/lib/email"
import { db } from "@/lib/db"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Password-recovery endpoint.
 * Always responds positively (does not leak whether an account exists), but
 * sends the reset email via Resend when the address belongs to a known user.
 * Demo accounts don't store passwords, so the reset link points at the sign-in
 * page — swap in a real token-based reset flow to make it fully functional.
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

  // Fire-and-forget: email failures must not change the response (and must
  // not leak whether the address exists). Only known users get a real email.
  const user = await db.userAccount
    .findUnique({ where: { email }, select: { name: true } })
    .catch(() => null)
  if (user) {
    const origin = new URL(req.url).origin
    void sendEmail(
      email,
      "Reset your Ukuu HR password",
      passwordResetEmailHtml(user.name ?? "", `${origin}/login`)
    )
  }

  return NextResponse.json({
    ok: true,
    message: `If an account exists for ${email}, a password reset link is on its way.`,
  })
}
