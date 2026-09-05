"use client"

import { MIcon } from "./icons"
import { Reveal } from "./Reveal"
import { UkuuLogoMark } from "./Header"

export function Download() {
  return (
    <section className="lp-download" id="download">
      <div className="lp-download-inner">
        <div className="lp-sec-head">
          <Reveal>
            <p className="lp-section-eyebrow lp-section-eyebrow--light">Get Started</p>
            <h2 className="lp-section-title lp-section-title--light">
              Run Ukuu HR anywhere.
            </h2>
            <p className="lp-section-sub lp-section-sub--light">
              Desktop apps, Docker container, or browser PWA — choose what works
              for you.
            </p>
          </Reveal>
        </div>

        <div className="lp-download-grid">
          <Reveal className="lp-dl-card" delay={0}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                marginBottom: 18,
              }}
            >
              <div className="lp-dl-icon">
                <MIcon name="desktop_windows" size={26} />
              </div>
              <span className="lp-dl-verified">
                <MIcon name="verified" size={14} />
                Ad-hoc signed · Self-contained
              </span>
            </div>
            <h3>Windows</h3>
            <p>Windows 10+ · 64-bit — Self-contained .exe</p>
            <a
              className="lp-dl-btn"
              href="https://github.com/StackOne-Tec/ukuu-hr-csharp/releases/download/v3.4.2/UkuuHr-Windows-x64.exe"
              target="_blank"
              rel="noreferrer"
            >
              <MIcon name="download" size={17} />
              Download .exe
            </a>
            <p className="lp-dl-note">
              ~48 MB · .exe file. SmartScreen may warn on first run — click
              &ldquo;More info&rdquo; then &ldquo;Run anyway&rdquo;.
            </p>
          </Reveal>

          <Reveal className="lp-dl-card" delay={80}>
            <div className="lp-dl-icon">
              <MIcon name="laptop_mac" size={26} />
            </div>
            <h3>macOS</h3>
            <p>macOS 11+ · Apple Silicon (M1/M2/M3) — Drag-to-install .dmg</p>
            <a
              className="lp-dl-btn"
              href="https://github.com/StackOne-Tec/ukuu-hr-csharp/releases/download/v3.4.2/UkuuHr-macOS-arm64.dmg"
              target="_blank"
              rel="noreferrer"
            >
              <MIcon name="download" size={17} />
              Download .dmg (Apple Silicon)
            </a>
            <a
              className="lp-dl-btn lp-dl-btn--sub"
              href="https://github.com/StackOne-Tec/ukuu-hr-csharp/releases/download/v3.4.1/UkuuHr-macOS-x64.dmg"
              target="_blank"
              rel="noreferrer"
            >
              <MIcon name="download" size={17} />
              Intel (x64) .dmg
            </a>
            <p className="lp-dl-note">
              Intel (x64) ships with the v3.4.1 release — Codemagic publishes
              Apple Silicon builds.
            </p>
            <p className="lp-dl-note">
              Open the .dmg → drag UkuuHrSync.app to Applications. First launch:
              right-click → Open.
            </p>
          </Reveal>

          <Reveal className="lp-dl-card" delay={160}>
            <div className="lp-dl-icon">
              <MIcon name="container" size={26} />
            </div>
            <h3>Docker</h3>
            <p>Windows, macOS &amp; Linux — Containerized deployment</p>
            <div className="lp-dl-code">
              <span className="lp-cmt"># Clone &amp; run in one go</span>
              {"\n"}
              <span className="lp-term-prompt">$ </span>
              <span className="lp-cmd">git clone https://github.com/StackOne-Tec/ukuu-hr-csharp.git</span>
              {"\n"}
              <span className="lp-term-prompt">$ </span>
              <span className="lp-cmd">cd ukuu-hr-csharp</span>
              {"\n"}
              <span className="lp-term-prompt">$ </span>
              <span className="lp-cmd">docker compose up</span>
            </div>
            <a className="lp-dl-btn" href="#deploy">
              <MIcon name="deployed_code" size={17} />
              View Docker Guide
            </a>
            <div className="lp-dl-tag">
              <MIcon name="developer_board" size={14} />
              Multi-arch · amd64 + arm64
            </div>
          </Reveal>
        </div>

        <Reveal delay={100} className="lp-preview-banner">
          <div
            style={{
              width: 56,
              height: 56,
              flex: "0 0 auto",
              display: "grid",
              placeItems: "center",
              borderRadius: 16,
              background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)",
              border: "1px solid rgba(255,255,255,0.14)",
              boxShadow: "0 12px 28px -10px rgba(109,40,217,0.7)",
            }}
          >
            <UkuuLogoMark size={30} white />
          </div>
          <div className="lp-pwa-text">
            <h4>Meet the Ukuu HR Bridge app</h4>
            <p>
              The companion desktop app for your attendance devices. Sign in
              with the same cloud account, register as many devices as you need,
              then sync or auto-upload punch data straight into your dashboard.
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 12,
              }}
            >
              {[
                "No device limits",
                "Auto-upload scheduling",
                "Same cloud sign-in",
              ].map((t) => (
                <span
                  key={t}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 13px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(243,240,255,0.92)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ color: "#2dd4a7", fontSize: 12 }}>●</span>
                  {t}
                </span>
              ))}
            </div>
          </div>
          <a className="lp-preview-link" href="/bridge/login">
            <MIcon name="login" size={16} />
            Open the Bridge app
          </a>
        </Reveal>

        <Reveal delay={120} className="lp-pwa-banner">
          <div className="lp-pwa-icon">
            <MIcon name="install_desktop" size={26} />
          </div>
          <div className="lp-pwa-text">
            <h4>Prefer a browser-based install?</h4>
            <p>
              Ukuu HR is also a PWA. Open{" "}
              <a href="#cta">the web app</a> in Chrome or Edge, then click the
              install icon in the address bar — works on both Windows and macOS.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

export function Deploy() {
  const features: {
    icon: "health_and_safety" | "restart_alt" | "folder_open" | "dns" | "lock" | "deployed_code"
    title: string
    body: React.ReactNode
  }[] = [
    {
      icon: "health_and_safety",
      title: "Health Checks",
      body: (
        <>
          Built-in <code className="lp-env-code">/health</code> endpoint with
          30-second intervals. Docker auto-restarts unhealthy containers — zero
          downtime.
        </>
      ),
    },
    {
      icon: "restart_alt",
      title: "Auto-Restart",
      body: (
        <>
          <code className="lp-env-code">unless-stopped</code> policy ensures
          recovery from crashes. Container persists across host reboots
          automatically.
        </>
      ),
    },
    {
      icon: "folder_open",
      title: "Persistent Volumes",
      body: (
        <>
          Database and app data stored in named Docker volumes. Survive
          container rebuilds — no data loss on{" "}
          <code className="lp-env-code">docker compose up --build</code>.
        </>
      ),
    },
    {
      icon: "dns",
      title: "PostgreSQL Ready",
      body: (
        <>
          Set <code className="lp-env-code">POSTGRES_CONNECTION_STRING</code>{" "}
          for production Postgres. Falls back to SQLite for quick local runs —
          no extra setup.
        </>
      ),
    },
    {
      icon: "lock",
      title: "Secure by Default",
      body: (
        <>
          Cookie auth, AES-256 encryption, HTTPS support. Set{" "}
          <code className="lp-env-code">UKUU_ENCRYPTION_KEY</code> and{" "}
          <code className="lp-env-code">RESEND_API_KEY</code> for production.
        </>
      ),
    },
    {
      icon: "deployed_code",
      title: "Cloud Compatible",
      body: (
        <>
          Deploy to Render, Fly.io, Railway, or any Docker-capable host.{" "}
          <code className="lp-env-code">PORT</code> env var for cloud port
          binding. Zero vendor lock-in.
        </>
      ),
    },
  ]

  const envRows = [
    {
      v: "POSTGRES_CONNECTION_STRING",
      d: "PostgreSQL ADO.NET connection string (production)",
    },
    { v: "DATABASE_URL", d: "Alternative — Render-style postgres:// URL" },
    { v: "SEED_DEMO_DATA", d: "true for first-run demo; false for production" },
    { v: "UKUU_ENCRYPTION_KEY", d: "AES-256-CBC master key for secrets encryption" },
    { v: "RESEND_API_KEY", d: "Resend.com API key for transactional email" },
    { v: "PORT", d: "HTTP port override (default 8080)" },
  ]

  return (
    <section className="lp-deploy" id="deploy">
      <div className="lp-deploy-inner">
        <div className="lp-sec-head">
          <Reveal>
            <p className="lp-section-eyebrow lp-section-eyebrow--light">
              Containerized Deployment
            </p>
            <h2 className="lp-section-title lp-section-title--light">
              Ship with Docker. Scale with confidence.
            </h2>
            <p className="lp-section-sub lp-section-sub--light">
              One command to build and run. Multi-arch images for amd64 and
              arm64. Production-ready with health checks, auto-restart, and
              persistent volumes.
            </p>
          </Reveal>
        </div>

        <Reveal className="lp-terminal">
          <div className="lp-terminal-head">
            <span className="lp-terminal-dot lp-terminal-dot--r" />
            <span className="lp-terminal-dot lp-terminal-dot--y" />
            <span className="lp-terminal-dot lp-terminal-dot--g" />
            <span className="lp-terminal-title">terminal — ukuu-hr deployment</span>
          </div>
          <div className="lp-terminal-body">
            <span className="lp-term-line">
              <span className="lp-term-cmt"># Clone the repository</span>
            </span>
            <span className="lp-term-line">
              <span className="lp-term-prompt">$ </span>git clone
              https://github.com/StackOne-Tec/ukuu-hr-csharp.git
            </span>
            <span className="lp-term-line">
              <span className="lp-term-prompt">$ </span>cd ukuu-hr-csharp
            </span>
            <span className="lp-term-line">
              <span className="lp-term-cmt">
                # Build &amp; run with Docker Compose (foreground)
              </span>
            </span>
            <span className="lp-term-line">
              <span className="lp-term-prompt">$ </span>docker compose up
            </span>
            <span className="lp-term-line">
              <span className="lp-term-ok">✔ </span>Container ukuu-hr{" "}
              <span className="lp-term-ok">Started</span>
            </span>
            <span className="lp-term-line">
              <span className="lp-term-ok">✔ </span>Health check passed{" "}
              http://localhost:8080/health
            </span>
            <span className="lp-term-line">
              <span className="lp-term-cmt">
                # Or run detached with production Postgres
              </span>
            </span>
            <span className="lp-term-line">
              <span className="lp-term-prompt">$ </span>docker compose up -d
            </span>
            <span className="lp-term-line">
              <span className="lp-term-prompt">$ </span>docker compose logs -f
              ukuu-hr
            </span>
            <span className="lp-term-line">
              <span className="lp-term-info">
                info: UkuuHr.Web[0] Now listening on: http://+:8080
              </span>
            </span>
            <span className="lp-term-line">
              <span className="lp-term-prompt">$ </span>
              <span className="lp-term-caret" />
            </span>
          </div>
        </Reveal>

        <div className="lp-deploy-tags">
          <span className="lp-deploy-tag lp-deploy-tag--hl">
            <MIcon name="container" size={15} />
            Docker Compose
          </span>
          <span className="lp-deploy-tag">
            <MIcon name="memory" size={15} />
            linux/amd64
          </span>
          <span className="lp-deploy-tag">
            <MIcon name="developer_board" size={15} />
            linux/arm64
          </span>
          <span className="lp-deploy-tag">
            <MIcon name="code" size={15} />
            .NET 10
          </span>
        </div>

        <div className="lp-deploy-features">
          {features.map((f, i) => (
            <Reveal key={f.title} className="lp-deploy-feature" delay={i * 60}>
              <div className="lp-deploy-feature-icon">
                <MIcon name={f.icon} size={20} />
              </div>
              <h4>{f.title}</h4>
              <p>{f.body}</p>
            </Reveal>
          ))}
        </div>

        <Reveal className="lp-env-table-wrap">
          <table className="lp-env-table">
            <thead>
              <tr>
                <th scope="col">Variable</th>
                <th scope="col">Description</th>
              </tr>
            </thead>
            <tbody>
              {envRows.map((r) => (
                <tr key={r.v}>
                  <td>
                    <code>{r.v}</code>
                  </td>
                  <td>{r.d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </section>
  )
}
