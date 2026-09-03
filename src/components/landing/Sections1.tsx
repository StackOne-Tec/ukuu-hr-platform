"use client"

import { MIcon } from "./icons"
import { Reveal } from "./Reveal"

export function TrustStrip() {
  return (
    <section className="lp-trust-strip">
      <div className="lp-trust-strip-inner">
        <span className="lp-muted">Trusted by teams in</span>
        <span className="lp-flag-dot" style={{ background: "#009739" }} title="Zambia" />
        <span style={{ fontWeight: 700 }}>Zambia</span>
        <span className="lp-trust-divider">·</span>
        <span className="lp-flag-dot" style={{ background: "#1EB53A" }} title="Tanzania" />
        <span style={{ fontWeight: 700 }}>Tanzania</span>
        <span className="lp-trust-divider">·</span>
        <span className="lp-flag-dot" style={{ background: "#0077C8" }} title="Malawi" />
        <span style={{ fontWeight: 700 }}>Malawi</span>
      </div>
    </section>
  )
}

type Feature = {
  icon: "badge" | "schedule" | "event_available" | "view_timeline" | "security" | "analytics"
  title: string
  desc: string
  chips: string[]
  variant: "dark" | "accent" | "light"
  span?: "2" | "full"
}

const FEATURES: Feature[] = [
  {
    icon: "badge",
    title: "Employee Management",
    desc: "4-step onboarding wizard — personal, employment, banking & statutory details. Searchable directory with tabbed profiles, bulk import, and org chart views.",
    chips: ["Onboarding", "Profiles", "Banking"],
    variant: "dark",
    span: "2",
  },
  {
    icon: "schedule",
    title: "Time & Attendance",
    desc: "Daily timesheets, clock-in/out, status filters — present, late, absent, on-leave, remote. Worked-hours computation built in.",
    chips: ["Clock-in", "Timesheets"],
    variant: "accent",
  },
  {
    icon: "event_available",
    title: "Leave Management",
    desc: "One-click approve/reject. Configurable leave types. Country-aware public holiday calendar.",
    chips: ["Approvals", "Holidays"],
    variant: "light",
  },
  {
    icon: "view_timeline",
    title: "Shift Scheduling",
    desc: "Department × shift matrix with day-of-week bitmask. Morning, mid & night rotations with weekly coverage view.",
    chips: ["Rotations", "Coverage"],
    variant: "light",
  },
  {
    icon: "security",
    title: "Security & Audit",
    desc: "Configurable MFA, SSO, IP allowlist, session timeout. Full audit log of every user-management action — export for SOC2 & ISO 27001 evidence.",
    chips: ["MFA", "SSO", "Audit Trail"],
    variant: "dark",
    span: "2",
  },
  {
    icon: "analytics",
    title: "Reports & Analytics",
    desc: "Headcount growth, department distribution, attendance rate, leave utilization — all on a single dashboard with real-time KPI cards, charts and one-click export.",
    chips: ["KPIs", "Charts", "Export"],
    variant: "light",
    span: "full",
  },
]

export function Features() {
  return (
    <section className="lp-bento" id="features">
      <div className="lp-bento-header">
        <Reveal>
          <p className="lp-bento-eyebrow">Core Modules</p>
          <h2 className="lp-bento-title">Everything your HR team needs.</h2>
          <p className="lp-bento-sub">
            Six integrated modules covering the full employee lifecycle — from
            onboarding to shift scheduling.
          </p>
        </Reveal>
      </div>

      <div className="lp-bento-grid">
        {FEATURES.map((f, i) => (
          <Reveal
            key={f.title}
            delay={i * 70}
            className={`lp-bento-card lp-bento-card-${f.variant}${
              f.span === "2" ? " lp-bento-span-2" : ""
            }${f.span === "full" ? " lp-bento-span-full" : ""}`}
          >
            <div className="lp-bento-icon">
              <MIcon name={f.icon} size={26} />
            </div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <div className="lp-chips">
              {f.chips.map((c) => (
                <span key={c} className="lp-chip">
                  {c}
                </span>
              ))}
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  )
}

export function Metrics() {
  const items = [
    { num: "16+", label: "pages shipped" },
    { num: "9", label: "core modules" },
    { num: "3", label: "country configs" },
    { num: "100%", label: "compliance" },
  ]
  return (
    <section className="lp-metrics" id="metrics">
      <div className="lp-metrics-inner">
        <Reveal>
          <p className="lp-section-eyebrow lp-section-eyebrow--light">By the Numbers</p>
          <h2 className="lp-section-title lp-section-title--light">
            Shipped, tested, compliant.
          </h2>
        </Reveal>
        <div className="lp-metrics-grid">
          {items.map((m, i) => (
            <Reveal key={m.label} delay={i * 80} className="lp-metric-card">
              <div className="lp-metric-num">{m.num}</div>
              <div className="lp-metric-label">{m.label}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Workflow() {
  const steps: {
    icon: "person_add" | "schedule" | "task_alt" | "calendar_month"
    num: string
    title: string
    text: string
  }[] = [
    {
      icon: "person_add",
      num: "01",
      title: "Onboard",
      text: "Add new hires with a 4-step wizard — personal, employment, banking & statutory details.",
    },
    {
      icon: "schedule",
      num: "02",
      title: "Track",
      text: "Clock-in/out, status filters, worked-hours. Manual entries & system records side by side.",
    },
    {
      icon: "task_alt",
      num: "03",
      title: "Approve",
      text: "One-click approve or reject. Country-aware holidays. Configurable leave types.",
    },
    {
      icon: "calendar_month",
      num: "04",
      title: "Schedule",
      text: "Department × shift assignments with day-of-week bitmask. Morning, mid, night.",
    },
  ]
  return (
    <section className="lp-workflow" id="workflow">
      <div className="lp-workflow-inner">
        <div className="lp-sec-head">
          <Reveal>
            <p className="lp-section-eyebrow">How It Works</p>
            <h2 className="lp-section-title">Four steps. Zero friction.</h2>
            <p className="lp-section-sub">
              The HR workflow, reimagined for speed and compliance.
            </p>
          </Reveal>
        </div>
        <div className="lp-workflow-grid">
          {steps.map((s, i) => (
            <Reveal key={s.num} delay={i * 100} className="lp-step">
              <div className="lp-step-num-wrap">
                <div className="lp-step-num">{s.num}</div>
                <div className="lp-step-icon">
                  <MIcon name={s.icon} size={18} />
                </div>
              </div>
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-text">{s.text}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

export function Testimonials() {
  const quotes = [
    {
      text: "Ukuu HR cut our onboarding time from 3 days to 30 minutes. The country-specific compliance for Zambia and Tanzania is exactly what we needed.",
      initials: "CM",
      name: "Chabwela Mwale",
      role: "HR Director, Lusaka Power Corp.",
      ava: "a" as const,
    },
    {
      text: "Finally, an HR system that understands African payroll and statutory requirements. The leave module automatically handles public holidays across all our branches.",
      initials: "NK",
      name: "Neema Kimaro",
      role: "People Ops Lead, DarVentures Ltd.",
      ava: "b" as const,
    },
  ]
  return (
    <section className="lp-testimonials">
      <div className="lp-testimonials-inner">
        <div className="lp-sec-head">
          <Reveal>
            <p className="lp-section-eyebrow lp-section-eyebrow--light">From the Field</p>
            <h2 className="lp-section-title lp-section-title--light">
              Trusted by HR professionals across Africa.
            </h2>
          </Reveal>
        </div>
        <div className="lp-testimonials-grid">
          {quotes.map((q, i) => (
            <Reveal key={q.name} delay={i * 100} className="lp-testimonial-card">
              <div className="lp-quote-mark" aria-hidden="true">
                &ldquo;
              </div>
              <p className="lp-testimonial-text">{q.text}</p>
              <div className="lp-testimonial-author">
                <div className={`lp-testimonial-ava lp-testimonial-ava--${q.ava}`}>
                  {q.initials}
                </div>
                <div>
                  <div className="lp-testimonial-name">{q.name}</div>
                  <div className="lp-testimonial-role">{q.role}</div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
