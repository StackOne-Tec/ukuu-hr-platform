import { NextResponse } from "next/server"
import { sendEmail, passwordResetEmailHtml } from "@/lib/email"
import { db } from "@/lib/db"
import { logDbError } from "@/lib/db-error"
import { generatePasswordResetLink } from "@/lib/firebase-auth"

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
    .catch((e) => {
      // Lookup failures are logged server-side but still return the same
      // response as a missing account (no account enumeration).
      logDbError(e, "auth.forgot")
      return null
    })
  if (user) {
    const origin = new URL(req.url).origin
    try {
      // The reset link is minted by Firebase Auth (it embeds a signed code
      // that lets the user choose a new password); we deliver it in our own
      // branded email. Unknown accounts simply get no email — the response
      // below never reveals whether the account exists.
      const resetUrl = await generatePasswordResetLink(email, `${origin}/login`)
      void sendEmail(
        email,
        "Reset your Ukuu HR password",
        passwordResetEmailHtml(user.name ?? "", resetUrl)
      )
    } catch (e) {
      logDbError(e, "auth.forgot.resetLink")
    }
  }

  return NextResponse.json({
    ok: true,
    message: `If an account exists for ${email}, a password reset link is on its way.`,
  })
}
