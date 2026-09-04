"use client"

import { MIcon } from "./icons"

export function UkuuLogoMark({ size = 32, white = false }: { size?: number; white?: boolean }) {
  return (
    <img
      src={white ? "/ukuu-brand-white.png" : "/ukuu-brand-mark.png"}
      alt=""
      width={size}
      height={size}
      aria-hidden="true"
      style={{ flexShrink: 0, objectFit: "contain", borderRadius: size * 0.22, display: "block" }}
    />
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
