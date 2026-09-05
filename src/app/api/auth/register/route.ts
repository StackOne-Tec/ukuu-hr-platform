import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { createWebSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session"
import { sendEmail, welcomeEmailHtml } from "@/lib/email"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Account creation for the demo auth experience.
 * Provisions a real, isolated tenant: each signup creates its own
 * Organization + Admin UserAccount, so company data is fully separated from
 * every other organization (FRS 11 — company data isolation). The httpOnly
 * session cookie scopes the whole console to that organization.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    firstName?: unknown
    lastName?: unknown
    name?: unknown
    email?: unknown
    phone?: unknown
    organization?: unknown
    country?: unknown
    industry?: unknown
    employees?: unknown
    password?: unknown
  } | null

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

  const email = str(body?.email).toLowerCase()
  const password = str(body?.password)

  /* name: prefer explicit first/last, fall back to single name, else derive from email */
  let name: string
  if (str(body?.firstName) || str(body?.lastName)) {
    name = `${str(body?.firstName)} ${str(body?.lastName)}`.trim()
  } else if (str(body?.name)) {
    name = str(body?.name)
  } else {
    const local = email.split("@")[0] ?? ""
    name = local
      .split(/[._\-+]+/)
      .filter(Boolean)
      .map(titleCase)
      .slice(0, 2)
      .join(" ") || "Ukuu User"
  }

  if (name.length < 2) {
    return NextResponse.json(
      { error: "Enter your full name (at least 2 characters)." },
      { status: 400 }
    )
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid work email address." },
      { status: 400 }
    )
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    )
  }
  const country = str(body?.country)
  const isFullSignup = str(body?.firstName).length > 0 || str(body?.organization).length > 0
  if (isFullSignup && !country) {
    return NextResponse.json(
      { error: "Select the country you operate from." },
      { status: 400 }
    )
  }

  /* simulate workspace provisioning */
  await new Promise((r) => setTimeout(r, 700))

  const orgName = str(body?.organization)
  const workspace = `${(orgName || email.split("@")[0] || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "workspace"}.ukuuhr.app`

  try {
    let organizationId: string | null = null
    let userId: string | null = null

    const existingUser = await db.userAccount.findUnique({ where: { email } })
    if (existingUser?.organizationId) {
      // Returning user — sign into their existing (isolated) tenant.
      organizationId = existingUser.organizationId
      userId = existingUser.id
      /* keep the Bridge password in sync with the cloud sign-up credentials */
      if (password) {
        await db.userAccount.update({ where: { id: existingUser.id }, data: { passwordHash: password } })
      }
    } else {
      // New signup — provision a brand-new, isolated organization.
      let slug = workspace.replace(/\.ukuuhr\.app$/, "")
      let suffix = 1
      while (await db.organization.findUnique({ where: { slug } })) {
        slug = `${workspace.replace(/\.ukuuhr\.app$/, "")}-${suffix++}`
      }
      const org = await db.organization.create({
        data: {
          name: orgName || name,
          slug,
          email,
          country,
          currency: "ZMW",
          plan: "trial-14d",
        },
      })
      const user = await db.userAccount.create({
        data: {
          organizationId: org.id,
          name,
          email,
          role: "Admin",
          /* same credentials work on the Bridge desktop app (plaintext mock
             auth — verifyPassword compares directly) */
          passwordHash: password,
        },
      })
      organizationId = org.id
      userId = user.id
    }

    const sessionToken =
      organizationId && userId
        ? await createWebSession({ userId, organizationId, remember: true })
        : null

    const res = NextResponse.json({
      ok: true,
      user: { email, name, organization: orgName, country },
      token: `ukuu_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
      workspace,
      plan: "trial-14d",
      organizationId,
    })
    if (sessionToken) {
      res.cookies.set(SESSION_COOKIE, sessionToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: SESSION_DAYS * 86400,
      })
    }

    // Welcome email (fire-and-forget — never fail registration because of email).
    void sendEmail(email, "Welcome to Ukuu HR 🎉", welcomeEmailHtml(name, workspace))
    return res
  } catch {
    return NextResponse.json(
      { ok: false, error: "The database is temporarily unreachable. Please try again in a moment." },
      { status: 503 }
    )
  }
}