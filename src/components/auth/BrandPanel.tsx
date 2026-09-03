"use client"

import { Users, Fingerprint, CalendarClock } from "lucide-react"
import { UkuuLogoMark } from "@/components/landing/Header"

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
    <a href="/" className="au-logo" aria-label="Ukuu HR home">
      <span className="au-logo-badge">
        <UkuuLogoMark size={26} />
      </span>
      <span>
        <span className="au-logo-name">UKUU HR</span>
        <span className="au-logo-sub">HRMS Platform</span>
      </span>
    </a>
  )
}

export function StatusBadge() {
  return (
    <span className="au-status">
      <span className="au-status-dot" />
      All systems operational
    </span>
  )
}

/** Left dark-purple branding panel of the auth experience. */
export function BrandPanel() {
  return (
    <aside className="au-brand" aria-label="Ukuu HR platform highlights">
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
        <StatusBadge />
      </div>

      <div className="au-brand-mid">
        <p className="au-eyebrow">REMOTE HR PLATFORM • AFRICA</p>
        <h1 className="au-headline">
          Welcome back to your <span className="au-grad">workforce</span> command
          center.
        </h1>
        <p className="au-sub">
          Sign in to manage employees, run country-compliant payroll, approve
          leave, and track attendance — all from one focused HR platform built
          for African businesses.
        </p>
      </div>

      <div className="au-cards">
        {FEATURES.map((f) => (
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
