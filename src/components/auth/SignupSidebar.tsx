"use client"

import { useEffect, useRef, useState } from "react"
import { UkuuLogoMark } from "@/components/landing/Header"

/** Hand-drawn squiggle underline for the word "unified". */
function Squiggle() {
  return (
    <svg viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <path
        d="M0 5 Q 50 8 100 5"
        stroke="#a38cf3"
        strokeWidth="2.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M0 7.2 Q 50 9.4 100 7.2"
        stroke="#c4b5fd"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  )
}

const TESTIMONIALS = [
  {
    quote:
      "The onboarding wizard alone saved us a week. New hires are added with banking and statutory details in 4 steps — payroll preview included.",
    initials: "U",
    name: "Ukuu HR",
    role: "HRMS Platform",
  },
  {
    quote:
      "Attendance syncs from our biometric devices every morning. Overtime and shift coverage now calculate themselves before HR even opens the dashboard.",
    initials: "M",
    name: "Mwangi & Co.",
    role: "Logistics · Nairobi",
  },
  {
    quote:
      "Payroll across three countries used to take a spreadsheet week. Now statutory deductions and filings generate per country in one run.",
    initials: "A",
    name: "Acacia Group",
    role: "Manufacturing · Lusaka",
  },
]

const STATS = [
  { value: 7, suffix: "", label: "User roles" },
  { value: 13, suffix: "", label: "Workspace modules" },
  { value: 3, suffix: "", label: "Country payrolls" },
  { value: 99.9, suffix: "%", label: "Uptime SLA", decimals: 1 },
]

function useCountUp(target: number, decimals = 0, duration = 900) {
  const [value, setValue] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(target * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])
  return value.toFixed(decimals)
}

function StatCard({ value, suffix, label, decimals }: { value: number; suffix: string; label: string; decimals?: number }) {
  const shown = useCountUp(value, decimals ?? 0)
  return (
    <div className="sg-stat">
      <div className="sg-stat-num">
        {shown}
        {suffix}
      </div>
      <div className="sg-stat-label">{label}</div>
    </div>
  )
}

/** Left dark-indigo branding sidebar of the signup page. */
export function SignupSidebar() {
  const [active, setActive] = useState(0)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timer.current = setInterval(() => {
      setActive((i) => (i + 1) % TESTIMONIALS.length)
    }, 6500)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [])

  const t = TESTIMONIALS[active]

  return (
    <aside className="sg-side" aria-label="Why Ukuu HR">
      <a href="/" className="sg-logo" aria-label="Ukuu HR home">
        <span className="sg-logo-badge">
          <UkuuLogoMark size={26} white />
        </span>
        <span>
          <span className="sg-logo-name">UKUU HR</span>
          <span className="sg-logo-sub">HRMS Platform</span>
        </span>
      </a>

      <button type="button" className="sg-cta" onClick={() => {
        document.getElementById("sg-first-field")?.scrollIntoView({ behavior: "smooth", block: "center" })
      }}>
        <span className="sg-cta-dot" />
        CREATE YOUR WORKSPACE · FREE TO START
      </button>

      <div>
        <h1 className="sg-headline">
          Your workforce, <span className="sg-squiggle">unified<Squiggle /></span> in
          one platform.
        </h1>
        <p className="sg-sub">
          Get a complete HR platform — employees, attendance, leave, payroll, and
          statutory compliance. Set up your organization in minutes, not weeks.
        </p>
      </div>

      <div className="sg-stats">
        {STATS.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>

      <div className="sg-quote-wrap">
        <figure className="sg-quote" aria-live="polite">
          <span className="sg-quote-mark" aria-hidden="true">&ldquo;</span>
          <div className="sg-quote-body">
            <blockquote className="sg-quote-text" key={active}>
              {t.quote}
            </blockquote>
            <figcaption className="sg-quote-author">
              <span className="sg-quote-avatar">{t.initials}</span>
              <span>
                <span className="sg-quote-name">{t.name}</span>
                <span className="sg-quote-role" style={{ display: "block" }}>{t.role}</span>
              </span>
            </figcaption>
          </div>
        </figure>

        <div className="sg-dots" role="tablist" aria-label="Testimonials">
          {TESTIMONIALS.map((q, i) => (
            <button
              key={q.name}
              type="button"
              className={`sg-dot${i === active ? " sg-dot--active" : ""}`}
              aria-label={`Show testimonial ${i + 1}: ${q.name}`}
              aria-current={i === active}
              onClick={() => {
                setActive(i)
                if (timer.current) clearInterval(timer.current)
              }}
            />
          ))}
        </div>
      </div>
    </aside>
  )
}
