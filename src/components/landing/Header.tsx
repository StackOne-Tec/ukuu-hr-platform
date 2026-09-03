"use client"

import { MIcon } from "./icons"

export function UkuuLogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      {/* connecting arrows (cycle) */}
      <g transform="translate(0, 4.2)">
        <rect x="12" y="1.75" width="8" height="4.5" rx="2.25" />
        <line x1="13.3" y1="4" x2="18.7" y2="4" />
        <rect x="4" y="10.25" width="8" height="4.5" rx="2.25" />
        <line x1="5.3" y1="12.5" x2="10.7" y2="12.5" />
        <path d="M9 2.6 L5.9 6.2" />
        <path d="M6.1 4.9 L5.9 6.2 L7.2 6.5" />
        <path d="M18.1 10.6 L15 14.2" />
        <path d="M15.2 12.9 L15 14.2 L16.3 14.5" />
      </g>
    </svg>
  )
}

export function ThemeToggle() {
  return (
    <button
      type="button"
      className="lp-theme-toggle"
      title="Toggle dark/light mode"
      aria-label="Toggle theme"
    >
      <MIcon name="dark_mode" size={20} />
    </button>
  )
}

export function Header() {
  const navItems = [
    { label: "Demo", href: "#demo" },
    { label: "Features", href: "#features" },
    { label: "Metrics", href: "#metrics" },
    { label: "Workflow", href: "#workflow" },
    { label: "Download", href: "#download" },
    { label: "Deploy", href: "#deploy" },
  ]

  return (
    <header className="lp-header">
      <a href="#" className="lp-logo" aria-label="Ukuu HR home">
        <UkuuLogoMark size={32} />
        <span className="lp-logo-text">
          <span className="lp-logo-name">UKUU HR</span>
          <span className="lp-logo-sub">HRMS Platform</span>
        </span>
      </a>

      <nav className="lp-nav" aria-label="Main navigation">
        {navItems.map((item) => (
          <a key={item.label} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      <div className="lp-header-right">
        <span className="lp-status-text">
          <span className="lp-status-dot" />
          Live
        </span>
        <a className="lp-btn-signin" href="/login">
          Sign in
        </a>
      </div>
    </header>
  )
}
