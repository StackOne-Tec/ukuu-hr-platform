import { NextResponse } from "next/server"
import crypto from "node:crypto"
import { db } from "@/lib/db"

const TOKEN_RE = /^[0-9a-f]{64}$/

/**
 * Password reset completion endpoint.
 * - action "verify": checks the token is valid (unused, unexpired) and returns
 *   the account email so the reset form can confirm who is resetting.
 * - action "set": validates the new password, applies it to the account, and
 *   burns the token (single use).
 */
async function findValidToken(raw: string) {
  if (!TOKEN_RE.test(raw)) return null
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex")
  const row = await db.passwordResetToken
    .findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    })
    .catch(() => null)
  return row ?? null
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    token?: unknown
    password?: unknown
    action?: unknown
  } | null

  const token = typeof body?.token === "string" ? body.token.trim() : ""
  const action = body?.action === "verify" ? "verify" : "set"

  const reset = await findValidToken(token)
  if (!reset) {
    return NextResponse.json(
      {
        ok: false,
        error: "This reset link is invalid, already used, or has expired. Request a new one.",
      },
      { status: 400 }
    )
  }

  if (action === "verify") {
    return NextResponse.json({ ok: true, email: reset.email })
  }

  const password = typeof body?.password === "string" ? body.password : ""
  if (password.length < 8) {
    return NextResponse.json(
      { error: "New password must be at least 8 characters." },
      { status: 400 }
    )
  }

  const user = await db.userAccount
    .findUnique({ where: { email: reset.email } })
    .catch(() => null)
  if (!user) {
    return NextResponse.json(
      { error: "No account is linked to this reset link anymore." },
      { status: 400 }
    )
  }

  try {
    await db.userAccount.update({
      where: { id: user.id },
      data: { passwordHash: password },
    })
    // Burn this token and invalidate any other pending tokens for the address.
    await db.passwordResetToken.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    })
    await db.passwordResetToken
      .deleteMany({ where: { email: reset.email, usedAt: null } })
      .catch(() => {})
  } catch {
    return NextResponse.json(
      { error: "The database is temporarily unreachable. Please try again in a moment." },
      { status: 503 }
    )
  }

  return NextResponse.json({
    ok: true,
    message: "Your password has been reset. Sign in with your new password.",
  })
}
