"use client"

import { Users, Fingerprint, CalendarClock, TicketPercent, Building2, ShieldCheck } from "lucide-react"
import { HOME_HREF, IS_ADMIN_PLATFORM } from "@/lib/platform"
import { UkuuLogoMark } from "@/components/landing/Header"

/* ── user portal (standard deployment) ── */
const FEATURES = [
  {
    icon: Users,
    tone: "purple",
    title: "People & Payroll",
    desc: "Country-compliant payroll for Kenya, Uganda, and Nigeria.",
  },
  {
    icon: Fingerprint,
    tone: "teal",
    title: "Smart Attendance",
    desc: "Biometric device sync with 7+ vendor integrations.",
  },
  {
    icon: CalendarClock,
    tone: "pink",
    title: "Leave & Shifts",
    desc: "Auto-approve rules, coverage tracking, and overtime.",
  },
] as const

/* ── admin portal (operator console) ── */
const ADMIN_FEATURES = [
  {
    icon: TicketPercent,
    tone: "gold",
    title: "Access Codes & Subscriptions",
    desc: "Issue single-use codes that unlock workspaces and plans.",
  },
  {
    icon: Building2,
    tone: "blue",
    title: "Tenant Oversight",
    desc: "Every organization, user and device across the platform.",
  },
  {
    icon: ShieldCheck,
    tone: "green",
    title: "Security & Audit",
    desc: "Restricted console with a full audit trail of every action.",
  },
] as const

/** Scattered sparkle positions on the dark brand panel (percent-based). */
const SPARKS = [
  { left: "7%", top: "22%", size: 2.5, delay: "0s" },
  { left: "18%", top: "61%", size: 2, delay: "1.2s" },
  { left: "31%", top: "13%", size: 2, delay: "2.1s" },
  { left: "44%", top: "78%", size: 2.5, delay: "0.6s" },
  { left: "57%", top: "30%", size: 2, delay: "1.8s" },
  { left: "68%", top: "9%", size: 2.5, delay: "0.9s" },
  { left: "76%", top: "58%", size: 2, delay: "2.6s" },
  { left: "88%", top: "35%", size: 2.5, delay: "0.3s" },
  { left: "93%", top: "74%", size: 2, delay: "1.5s" },
  { left: "12%", top: "88%", size: 2, delay: "2.9s" },
]

export function BrandLogo() {
  return (
    <a href={HOME_HREF} className="au-logo" aria-label={IS_ADMIN_PLATFORM ? "Ukuu platform admin home" : "Ukuu HR home"}>
      <span className="au-logo-badge">
        <UkuuLogoMark size={26} white />
      </span>
      <span>
        <span className="au-logo-name">{IS_ADMIN_PLATFORM ? "UKUU PLATFORM" : "UKUU HR"}</span>
        <span className="au-logo-sub">{IS_ADMIN_PLATFORM ? "Admin Console" : "HRMS Platform"}</span>
      </span>
    </a>
  )
}

export function StatusBadge() {
  return IS_ADMIN_PLATFORM ? (
    <span className="au-status">
      <span className="au-status-dot" />
      Platform operations
    </span>
  ) : (
    <span className="au-status">
      <span className="au-status-dot" />
      All systems operational
    </span>
  )
}

/** Left brand panel of the auth experience — distinct per deployment. */
export function BrandPanel() {
  const features = IS_ADMIN_PLATFORM ? ADMIN_FEATURES : FEATURES

  return (
    <aside
      className={`au-brand${IS_ADMIN_PLATFORM ? " au-brand--admin" : ""}`}
      aria-label={IS_ADMIN_PLATFORM ? "Ukuu platform administration" : "Ukuu HR platform highlights"}
    >
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="au-spark"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: s.delay,
          }}
        />
      ))}

      <div className="au-brand-top">
        <BrandLogo />
        {IS_ADMIN_PLATFORM ? (
          <span className="au-restricted">
            <ShieldCheck size={12} strokeWidth={2.4} />
            Restricted area
          </span>
        ) : (
          <StatusBadge />
        )}
      </div>

      <div className="au-brand-mid">
        <p className="au-eyebrow">
          {IS_ADMIN_PLATFORM ? "PLATFORM ADMINISTRATION • OPERATIONS" : "REMOTE HR PLATFORM • AFRICA"}
        </p>
        <h1 className="au-headline">
          {IS_ADMIN_PLATFORM ? (
            <>
              The <span className="au-grad">operator console</span> behind every Ukuu workspace.
            </>
          ) : (
            <>
              Welcome back to your <span className="au-grad">workforce</span> command center.
            </>
          )}
        </h1>
        <p className="au-sub">
          {IS_ADMIN_PLATFORM ? (
            <>
              Authorized platform administrators only. Issue access codes, oversee every tenant,
              and monitor platform security — every sign-in is recorded in the audit log.
            </>
          ) : (
            <>
              Sign in to manage employees, run country-compliant payroll, approve leave, and
              track attendance — all from one focused HR platform built for African businesses.
            </>
          )}
        </p>
      </div>

      <div className="au-cards">
        {features.map((f) => (
          <div key={f.title} className="au-fcard">
            <span className={`au-ficon au-ficon--${f.tone}`}>
              <f.icon size={19} strokeWidth={1.9} />
            </span>
            <p className="au-ftitle">{f.title}</p>
            <p className="au-fdesc">{f.desc}</p>
          </div>
        ))}
      </div>
    </aside>
  )
}