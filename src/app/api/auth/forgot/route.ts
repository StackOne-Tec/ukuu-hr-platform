import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { sendEmail, passwordResetEmailHtml, emailDeliveryMode, devMailboxEnabled } from "@/lib/email"
import { db } from "@/lib/db"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESET_MINUTES = 30

/**
 * Password-recovery endpoint.
 * Always responds positively (does not leak whether an account exists), but
 * generates a single-use, 30-minute reset token and emails a real reset link
 * (/reset-password?token=...) when the address belongs to a known user.
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
    // Invalidate any previous, still-unused tokens for this address so only
    // the newest requested link works.
    await db.passwordResetToken
      .deleteMany({ where: { email, usedAt: null } })
      .catch(() => {})

    const rawToken = crypto.randomBytes(32).toString("hex")
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex")
    const expiresAt = new Date(Date.now() + RESET_MINUTES * 60_000)

    const created = await db.passwordResetToken
      .create({ data: { email, tokenHash, expiresAt } })
      .catch(() => null)

    if (created) {
      const origin = new URL(req.url).origin
      void sendEmail(
        email,
        "Reset your Ukuu HR password",
        passwordResetEmailHtml(user.name ?? "", `${origin}/reset-password?token=${rawToken}`)
      )
    }
  }

  return NextResponse.json({
    ok: true,
    // Global delivery-mode flag (same for every address — no account leak):
    // "resend" → real provider; "outbox" → dev mailbox viewable; "unconfigured"
    // → production without a provider (no public mailbox, admin action needed).
    emailDelivery:
      emailDeliveryMode() === "resend"
        ? "resend"
        : devMailboxEnabled()
          ? "outbox"
          : "unconfigured",
    message: `If an account exists for ${email}, a password reset link is on its way.`,
  })
}
