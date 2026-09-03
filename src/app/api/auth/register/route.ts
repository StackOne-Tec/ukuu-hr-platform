import { NextResponse } from "next/server"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

/**
 * Mock account-creation endpoint for the demo auth experience.
 * Supports the full signup payload (first/last name, organization,
 * country, industry, size) as well as the legacy { name, email } shape.
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

  const org = str(body?.organization)
  const workspace = `${(org || email.split("@")[0] || "workspace")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "workspace"}.ukuuhr.app`

  return NextResponse.json({
    ok: true,
    user: { email, name, organization: org, country },
    token: `ukuu_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`,
    workspace,
    plan: "trial-14d",
  })
}
