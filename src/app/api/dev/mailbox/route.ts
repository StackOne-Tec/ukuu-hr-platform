import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { devMailboxEnabled } from "@/lib/email"

/**
 * Dev Mailbox API — exposes the local outbox (EmailLog) so email flows can be
 * tested end-to-end in dev/sandbox, where no real provider (RESEND_API_KEY)
 * is configured. The mailbox renders captured emails — including live
 * password-reset links — so it is hard-disabled in production unless
 * DEV_MAILBOX_ENABLED=true is set explicitly (see devMailboxEnabled).
 *
 * GET /api/dev/mailbox          → latest 50 messages (metadata only)
 * GET /api/dev/mailbox?id=<id>  → full message incl. rendered HTML
 */
export async function GET(req: Request) {
  if (!devMailboxEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const id = new URL(req.url).searchParams.get("id")

  try {
    if (id) {
      const email = await db.emailLog.findUnique({ where: { id } })
      if (!email) return NextResponse.json({ error: "Not found" }, { status: 404 })
      return NextResponse.json({ ok: true, email })
    }

    const emails = await db.emailLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        toEmail: true,
        subject: true,
        provider: true,
        status: true,
        error: true,
        createdAt: true,
      },
    })
    return NextResponse.json({ ok: true, mode: "outbox", emails })
  } catch {
    return NextResponse.json(
      { error: "The database is temporarily unreachable." },
      { status: 503 }
    )
  }
}
