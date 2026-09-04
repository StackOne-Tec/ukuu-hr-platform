"use client"

import { useEffect, useRef, useState } from "react"
import { MIcon } from "./icons"
import { Reveal } from "./Reveal"
import { UkuuLogoMark } from "./Header"

/* ─── Animated counter ─── */
function Counter({
  target,
  prefix = "",
  suffix = "",
  duration = 1800,
}: {
  target: number
  prefix?: string
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [value, setValue] = useState(0)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !started.current) {
            started.current = true
            const t0 = performance.now()
            const tick = (now: number) => {
              const p = Math.min((now - t0) / duration, 1)
              const eased = 1 - Math.pow(1 - p, 3)
              setValue(Math.round(target * eased))
              if (p < 1) requestAnimationFrame(tick)
            }
            requestAnimationFrame(tick)
            observer.disconnect()
          }
        })
      },
      { threshold: 0.4 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [target, duration])

  return (
    <span ref={ref}>
      {prefix}
      {value.toLocaleString()}
      {suffix}
    </span>
  )
}

export function Stats() {
  const items = [
    {
      target: 12480,
      suffix: "+",
      label: "Employees managed",
      sub: "across 3 countries",
    },
    {
      target: 8,
      suffix: " min",
      label: "Friday payroll",
      sub: "down from 2 days",
    },
    {
      target: 100,
      suffix: "%",
      label: "Statutory compliance",
      sub: "ZRA · NAPSA · NHIMA",
    },
    {
      target: 3,
      suffix: "",
      label: "Country configs",
      sub: "Zambia · Tanzania · Malawi",
    },
  ]
  return (
    <section className="lp-stats" id="stats">
      <div className="lp-stats-inner">
        <Reveal>
          <p className="lp-section-eyebrow lp-section-eyebrow--light">
            By the numbers
          </p>
          <h2 className="lp-section-title lp-section-title--light">
            Built for the realities of running HR in Africa.
          </h2>
        </Reveal>
        <div className="lp-stats-grid">
          {items.map((s, i) => (
            <Reveal key={s.label} delay={i * 90} className="lp-stat-card">
              <div className="lp-stat-num">
                <em>
                  <Counter target={s.target} suffix={s.suffix} />
                </em>
              </div>
              <div className="lp-stat-label">{s.label}</div>
              <div className="lp-stat-sub">{s.sub}</div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Before / After comparison slider ─── */
const BEFORE: { icon: "schedule" | "description" | "calculate" | "error_outline" | "person_off"; text: string }[] = [
  { icon: "schedule", text: "2 full days on payroll" },
  { icon: "description", text: "Paper timesheets & missing punches" },
  { icon: "calculate", text: "Manual NAPSA / PAYE calculations" },
  { icon: "error_outline", text: "Re-keying data across systems" },
  { icon: "person_off", text: "HR misses family dinner on payday" },
]

const AFTER: { icon: "bolt" | "devices" | "verified" | "link" | "home"; text: string }[] = [
  { icon: "bolt", text: "Payroll runs in 8 minutes" },
  { icon: "devices", text: "Real-time attendance from any device" },
  { icon: "verified", text: "Auto-applied ZRA 2025 PAYE brackets" },
  { icon: "link", text: "One source of truth across HR" },
  { icon: "home", text: "HR leaves at 5 PM, every Friday" },
]

export function Compare() {
  const [split, setSplit] = useState(50)
  const dragging = useRef(false)
  const shellRef = useRef<HTMLDivElement | null>(null)

  const updateFromClientX = (clientX: number) => {
    const el = shellRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = ((clientX - rect.left) / rect.width) * 100
    setSplit(Math.min(94, Math.max(6, pct)))
  }

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (dragging.current) updateFromClientX(e.clientX)
    }
    const touchMove = (e: TouchEvent) => {
      if (dragging.current && e.touches[0]) updateFromClientX(e.touches[0].clientX)
    }
    const up = () => {
      dragging.current = false
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("touchmove", touchMove, { passive: true })
    window.addEventListener("mouseup", up)
    window.addEventListener("touchend", up)
    return () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("touchmove", touchMove)
      window.removeEventListener("mouseup", up)
      window.removeEventListener("touchend", up)
    }
  }, [])

  return (
    <section className="lp-compare" id="compare">
      <div className="lp-compare-inner">
        <Reveal>
          <p className="lp-section-eyebrow lp-section-eyebrow--light">
            The difference
          </p>
          <h2 className="lp-section-title lp-section-title--light">
            Before UKUU vs. with UKUU.
          </h2>
          <p className="lp-section-sub lp-section-sub--light">
            Slide the divider to see what changes when HR goes from
            spreadsheet-and-calculator to one platform.
          </p>
        </Reveal>

        <Reveal>
          <div
            className="lp-compare-slider"
            ref={shellRef}
            style={{ ["--lp-split" as string]: `${split}%` }}
            onMouseDown={(e) => {
              dragging.current = true
              updateFromClientX(e.clientX)
            }}
            onTouchStart={(e) => {
              if (e.touches[0]) {
                dragging.current = true
                updateFromClientX(e.touches[0].clientX)
              }
            }}
          >
            {/* Ghost layer for height */}
            <div className="lp-compare-ghost">
              <div className="lp-compare-pane">
                <span className="lp-compare-pane-label lp-compare-pane-label--bad">
                  <MIcon name="close" size={16} />
                  Before · Manual HR
                </span>
                <ul className="lp-compare-list">
                  {BEFORE.map((b) => (
                    <li key={b.text}>
                      <MIcon name={b.icon} className="lp-compare-ico-bad" />
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Before (left side) */}
            <div className="lp-compare-before">
              <div className="lp-compare-pane lp-compare-pane-inner">
                <span className="lp-compare-pane-label lp-compare-pane-label--bad">
                  <MIcon name="close" size={16} />
                  Before · Manual HR
                </span>
                <ul className="lp-compare-list">
                  {BEFORE.map((b) => (
                    <li key={b.text}>
                      <MIcon name={b.icon} className="lp-compare-ico-bad" />
                      {b.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* After (right side) */}
            <div className="lp-compare-after">
              <div className="lp-compare-pane lp-compare-pane-inner">
                <span className="lp-compare-pane-label lp-compare-pane-label--good">
                  <MIcon name="check" size={16} />
                  With UKUU · One platform
                </span>
                <ul className="lp-compare-list">
                  {AFTER.map((a) => (
                    <li key={a.text}>
                      <MIcon name={a.icon} className="lp-compare-ico-good" />
                      {a.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Handle */}
            <div
              className="lp-compare-handle"
              role="slider"
              aria-label="Comparison divider"
              aria-valuenow={Math.round(split)}
              aria-valuemin={0}
              aria-valuemax={100}
              tabIndex={0}
              onMouseDown={(e) => {
                e.preventDefault()
                dragging.current = true
              }}
              onTouchStart={() => {
                dragging.current = true
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowLeft") setSplit((v) => Math.max(6, v - 4))
                if (e.key === "ArrowRight") setSplit((v) => Math.min(94, v + 4))
              }}
            >
              <div className="lp-compare-knob">
                <MIcon name="chevron_left" size={14} />
                <MIcon name="chevron_right" size={14} />
              </div>
            </div>
          </div>
          <p className="lp-compare-hint">Drag the divider · works with touch too</p>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Pricing ─── */
export function Pricing() {
  const tiers = [
    {
      name: "Starter",
      amount: "Free",
      period: "14-day trial",
      features: [
        "Up to 10 employees",
        "All 9 core modules",
        "Demo data preloaded",
        "Email support",
      ],
      cta: "Start free trial",
      featured: false,
    },
    {
      name: "Professional",
      amount: "$3",
      period: "/employee / month",
      features: [
        "Up to 250 employees",
        "Multi-branch & multi-org",
        "Device sync (Hikvision · ZKTeco)",
        "Payslip email via Resend",
        "Audit log + CSV export",
        "Priority support (24h)",
      ],
      cta: "Choose Professional",
      featured: true,
    },
    {
      name: "Enterprise",
      amount: "Custom",
      period: "Annual contract",
      features: [
        "Unlimited employees",
        "Multi-tenant with SSO",
        "On-prem / private cloud",
        "Custom country compliance",
        "SLA + dedicated CSM",
        "API rate-limit increases",
      ],
      cta: "Talk to sales",
      featured: false,
    },
  ]

  return (
    <section className="lp-pricing" id="pricing">
      <div className="lp-pricing-inner">
        <Reveal>
          <p className="lp-section-eyebrow lp-section-eyebrow--light">Pricing</p>
          <h2 className="lp-section-title lp-section-title--light">
            One platform. Simple pricing.
          </h2>
          <p className="lp-section-sub lp-section-sub--light">
            Per-employee pricing means you only pay for what you use. Switch
            plans any time. 14-day free trial, no credit card required.
          </p>
        </Reveal>

        <div className="lp-pricing-grid">
          {tiers.map((t, i) => (
            <Reveal
              key={t.name}
              delay={i * 90}
              className={`lp-pricing-card${t.featured ? " lp-pricing-card--featured" : ""}`}
            >
              {t.featured && (
                <span className="lp-pricing-badge">Most popular</span>
              )}
              <div className="lp-pricing-name">{t.name}</div>
              <div className="lp-pricing-price">
                <span className="lp-pricing-amount">{t.amount}</span>
                <span className="lp-pricing-period">{t.period}</span>
              </div>
              <ul className="lp-pricing-features">
                {t.features.map((f) => (
                  <li key={f}>
                    <MIcon name="check" size={17} />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="#cta"
                className={`lp-pricing-btn${t.featured ? " lp-pricing-btn--featured" : ""}`}
              >
                {t.cta}
              </a>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── FAQ ─── */
export function Faq() {
  const items: { q: string; a: React.ReactNode }[] = [
    {
      q: "Is Ukuu HR specific to the Zambian tax system?",
      a: (
        <>
          Ukuu HR ships with built-in country configurations for Zambia (ZRA
          2025 PAYE brackets, NAPSA), Tanzania (PAYE, NSSF), and Malawi (PAYE,
          NHIMA). Switching organization country automatically loads the right
          statutory config — same UI, different compliance rules.
        </>
      ),
    },
    {
      q: "Can I import my existing employee list?",
      a: (
        <>
          Yes — CSV and XLSX import are built in. The 4-step onboarding wizard
          (Personal → Employment → Banking → Tax &amp; Statutory) mirrors the
          import columns, so you can round-trip data without losing fidelity.
        </>
      ),
    },
    {
      q: "Does it work with our attendance device?",
      a: (
        <>
          Hikvision (ISAPI), ZKTeco, Suprema, Dahua, Anviz, Matrix, and eSSL are
          all supported via REST + CSV. The desktop sync app bridges LAN-only
          devices. New vendor connectors can be added in &lt; 200 lines via the{" "}
          <code>IDeviceConnector</code> interface.
        </>
      ),
    },
    {
      q: "What if I don't have a Postgres database?",
      a: (
        <>
          Ukuu HR falls back to SQLite automatically — fine for trials and small
          teams. For production with multiple concurrent users, set{" "}
          <code>POSTGRES_CONNECTION_STRING</code> and the app will use Postgres
          without any code changes.
        </>
      ),
    },
    {
      q: "Can I run it on my own infrastructure?",
      a: (
        <>
          Yes. The Docker image is published at{" "}
          <code>ghcr.io/stackone-tec/ukuu-hr-csharp:latest</code> (multi-arch:
          linux/amd64 + linux/arm64). Deploy to Fly.io, Render, AWS ECS, Azure
          Container Apps, or any Docker host. Or run from source with the .NET 10
          SDK.
        </>
      ),
    },
    {
      q: "Is my data encrypted?",
      a: (
        <>
          Bank account numbers, NRCs, and TPINs are AES-256 encrypted at rest
          with a key from <code>UKUU_ENCRYPTION_KEY</code> (or a key file
          fallback). The encryption service never crashes on a missing key — it
          generates a process-stable one so your app keeps running during
          migrations.
        </>
      ),
    },
  ]

  return (
    <section className="lp-faq" id="faq">
      <div className="lp-faq-inner">
        <Reveal>
          <p className="lp-section-eyebrow lp-section-eyebrow--light">FAQ</p>
          <h2 className="lp-section-title lp-section-title--light">
            Answers to the questions HR teams actually ask.
          </h2>
        </Reveal>
        <div>
          {items.map((item, i) => (
            <Reveal key={item.q} delay={i * 50}>
              <details className="lp-faq-item">
                <summary>
                  {item.q}
                  <span className="lp-faq-icon" aria-hidden="true">
                    <MIcon name="add" size={16} />
                  </span>
                </summary>
                <div className="lp-faq-body">{item.a}</div>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─── Founders note ─── */
export function Founders() {
  return (
    <section className="lp-founders" id="founders">
      <div className="lp-founders-inner">
        <Reveal>
          <div className="lp-founders-quote-mark" aria-hidden="true">
            &ldquo;
          </div>
          <p className="lp-founders-text">
            We built Ukuu HR after watching HR managers in Lusaka spend their
            Fridays on a calculator and a stack of paper timesheets. Every
            decision we make — every module, every screen, every line of code —
            is in service of one outcome:{" "}
            <span className="lp-mission">getting HR home on time.</span>
          </p>
          <div className="lp-founders-author">
            <div className="lp-founders-ava">U</div>
            <div className="lp-founders-author-text">
              <div className="lp-founders-author-name">The Ukuu HR team</div>
              <div className="lp-founders-author-loc">
                Lusaka · Dar es Salaam · Lilongwe
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Final CTA ─── */
export function Cta() {
  return (
    <section className="lp-cta" id="cta">
      <div className="lp-cta-inner">
        <Reveal>
          <h2 className="lp-cta-title">Ready to run your workforce?</h2>
          <p className="lp-cta-sub">
            Sign in with the demo account and explore the full platform —
            employees, attendance, leave &amp; scheduling, all pre-loaded with
            sample data.
          </p>
          <a href="#" className="lp-cta-btn">
            <MIcon name="login" size={19} />
            Sign in to Ukuu HR
          </a>
        </Reveal>
      </div>
    </section>
  )
}

/* ─── Footer ─── */
export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div className="lp-footer-grid">
          <div className="lp-footer-brand">
            <div
              style={{ display: "flex", alignItems: "center", gap: 12, color: "#fff" }}
            >
              <UkuuLogoMark size={30} white />
              <span className="lp-logo-name" style={{ fontSize: 16 }}>UKUU HR</span>
            </div>
            <p>
              A complete HR management system for African businesses. Employees,
              attendance, leave and statutory compliance — all in one platform.
            </p>
            <p className="lp-footer-tech">
              Built with .NET 10, Blazor Server, EF Core &amp; PostgreSQL. Runs
              in Docker on any OS.
            </p>
          </div>

          <div className="lp-footer-col">
            <h4>Platform</h4>
            <a href="#features">Dashboard</a>
            <a href="#features">Employees</a>
            <a href="#features">Attendance</a>
            <a href="#features">Leave</a>
            <a href="#metrics">Reports</a>
          </div>

          <div className="lp-footer-col">
            <h4>Resources</h4>
            <a href="/login">Sign in</a>
            <a href="/signup">Create account</a>
            <a
              href="https://github.com/StackOne-Tec/ukuu-hr-csharp"
              target="_blank"
              rel="noreferrer"
            >
              GitHub
            </a>
            <a href="#deploy">Docker</a>
            <a href="#deploy">Health status</a>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <span>© 2025 Ukuu HR. All rights reserved.</span>
          <span className="lp-footer-status">
            <span className="lp-footer-status-dot" />
            All systems operational
          </span>
        </div>
      </div>
    </footer>
  )
}
