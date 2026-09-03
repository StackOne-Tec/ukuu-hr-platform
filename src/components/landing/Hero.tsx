"use client"

import { MIcon } from "./icons"
import { UkuuLogoMark } from "./Header"

function DashboardMock() {
  // Mini stylised app dashboard that stands in for the demo reel preview
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(135deg, #0E0620 0%, #1A0D42 50%, #2D1B69 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 22,
      }}
    >
      <div style={{ opacity: 0.75 }}>
        <UkuuLogoMark size={72} />
      </div>
      <div
        style={{
          display: "flex",
          gap: 14,
          flexWrap: "wrap",
          justifyContent: "center",
          padding: "0 32px",
          maxWidth: 760,
        }}
      >
        {[
          { label: "Employees", val: "248", color: "#A78BFA" },
          { label: "Present today", val: "231", color: "#14a37f" },
          { label: "On leave", val: "11", color: "#d89c11" },
          { label: "Open roles", val: "6", color: "#e85d75" },
        ].map((k) => (
          <div
            key={k.label}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: "14px 22px",
              minWidth: 128,
              textAlign: "left",
            }}
          >
            <div style={{ fontSize: 24, fontWeight: 800, color: k.color, letterSpacing: "-0.02em" }}>
              {k.val}
            </div>
            <div style={{ fontSize: 11.5, color: "rgba(243,240,255,0.55)", marginTop: 4 }}>
              {k.label}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 4,
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          height: 54,
        }}
      >
        {[38, 52, 30, 46, 22, 40, 54, 34, 48, 26, 44, 32, 50, 28, 42, 36, 24, 46].map(
          (h, i) => (
            <div
              key={i}
              style={{
                width: 12,
                borderRadius: 4,
                height: "100%",
                display: "flex",
                alignItems: "flex-end",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: `${(h / 54) * 100}%`,
                  borderRadius: 4,
                  background:
                    i % 3 === 0
                      ? "linear-gradient(180deg, #A78BFA, #7B2FBE)"
                      : "rgba(167,139,250,0.25)",
                }}
              />
            </div>
          )
        )}
      </div>
    </div>
  )
}

export function Hero() {
  const scrollVideo = () => {
    const frame = document.getElementById("lpVideoFrame")
    frame?.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  return (
    <section className="lp-hero">
      <div className="lp-hero-aurora" aria-hidden="true" />
      <div className="lp-hero-aurora2" aria-hidden="true" />
      <div className="lp-hero-mesh" aria-hidden="true" />

      <div className="lp-hero-content">
        <p className="lp-hero-eyebrow">Remote HR platform · Africa</p>
        <h1 className="lp-hero-h1">
          HR software that
          <br />
          <span className="lp-gradient-text">runs your workforce.</span>
        </h1>
        <p className="lp-hero-sub">
          Onboard, track, approve, and schedule — one platform for the entire
          employee lifecycle. Built for Zambia, Tanzania &amp; Malawi.
        </p>

        <div className="lp-hero-actions">
          <a href="#cta" className="lp-btn-hero-primary">
            <MIcon name="arrow_forward" size={18} />
            Get started free
          </a>
          <button
            type="button"
            className="lp-btn-hero-secondary"
            onClick={scrollVideo}
          >
            <MIcon name="play_circle" size={20} />
            Watch the demo
          </button>
        </div>

        <div className="lp-hero-badges">
          <div className="lp-float-badge">
            <div
              className="lp-float-badge-icon"
              style={{ background: "rgba(20,163,127,0.15)" }}
            >
              <MIcon name="schedule" size={20} className="lp-ico-green" />
            </div>
            <div className="lp-float-badge-text">
              <strong>9 Modules</strong>
              Full HR suite
            </div>
          </div>
          <div className="lp-float-badge">
            <div
              className="lp-float-badge-icon"
              style={{ background: "rgba(123,47,190,0.15)" }}
            >
              <MIcon name="public" size={20} className="lp-ico-lavender" />
            </div>
            <div className="lp-float-badge-text">
              <strong>3 Countries</strong>
              Local compliance
            </div>
          </div>
          <div className="lp-float-badge">
            <div
              className="lp-float-badge-icon"
              style={{ background: "rgba(216,156,17,0.15)" }}
            >
              <MIcon name="verified" size={20} className="lp-ico-gold" />
            </div>
            <div className="lp-float-badge-text">
              <strong>100%</strong>
              Statutory compliance
            </div>
          </div>
        </div>
      </div>

      <div className="lp-hero-preview" id="demo">
        <div className="lp-video" style={{ margin: "0 auto" }}>
          <div className="lp-video-frame" id="lpVideoFrame">
            <DashboardMock />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "radial-gradient(ellipse at center, transparent 55%, rgba(14,6,32,0.55) 100%)",
                pointerEvents: "none",
              }}
            />
          </div>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <button
              type="button"
              aria-label="Play demo"
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                border: "none",
                cursor: "pointer",
                background: "linear-gradient(135deg, #7B2FBE, #A78BFA)",
                boxShadow: "0 12px 40px rgba(123,47,190,0.55)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                transition: "transform 0.25s ease, box-shadow 0.25s ease",
              }}
              className="lp-play-btn"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div className="lp-scroll-hint" aria-hidden="true">
        <div className="lp-scroll-hint-line" />
        <span className="lp-scroll-hint-text">Scroll</span>
      </div>
    </section>
  )
}
