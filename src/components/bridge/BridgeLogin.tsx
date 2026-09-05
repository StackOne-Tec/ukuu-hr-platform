"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Building,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UkuuLogoMark } from "@/components/landing/Header";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type Banner = { kind: "success" | "error"; text: string } | null;

type BridgeLoginRes = {
  ok: boolean;
  error?: string;
  token?: string;
  expiresAt?: string;
  account?: { name: string; email: string; role: string };
  organization?: { id: string; name: string; slug: string; plan: string };
  subscription?: {
    plan: string;
    status: string;
    valid: boolean;
    expiresAt: string | null;
    reason: string | null;
  };
  dashboard?: { allowed: boolean };
};

/**
 * Ukuu HR — Access Sync Bridge · Gateway Login
 * The desktop app's authentication window. The sign-in card mirrors the cloud
 * application's auth experience exactly — same EMAIL ADDRESS / PASSWORD fields,
 * same validation, same theming — so the credentials you use on the cloud work
 * here too (POST /api/v1/bridge/login applies the same demo-auth rules as the
 * cloud sign-in).
 */
export default function BridgeLogin() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  /* restore a remembered bridge email, like the cloud remembers yours */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("ukuu_bridge_email");
      if (saved) setEmail(saved);
      emailRef.current?.focus();
    } catch {
      /* ignore */
    }
  }, []);

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (loading || done) return;
      setBanner(null);

      /* identical validation copy to the cloud sign-in */
      const e: Record<string, string> = {};
      if (!EMAIL_RE.test(email.trim())) {
        e.email = "Enter a valid work email address.";
      }
      if (password.length < 6) {
        e.password = "Password must be at least 6 characters.";
      }
      setErrors(e);
      if (Object.keys(e).length > 0) return;

      setLoading(true);
      try {
        const res = await fetch("/api/v1/bridge/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const data = (await res.json().catch(() => null)) as BridgeLoginRes | null;

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Unable to sign in right now. Please try again.");
        }

        /* persist the Bridge session (the native app keeps it on disk) */
        try {
          const store = remember ? localStorage : sessionStorage;
          store.setItem(
            "ukuu_bridge_session",
            JSON.stringify({
              token: data.token,
              expiresAt: data.expiresAt,
              account: data.account,
              organization: data.organization,
              subscription: data.subscription,
            })
          );
          if (remember) localStorage.setItem("ukuu_bridge_email", email.trim());
          else localStorage.removeItem("ukuu_bridge_email");
        } catch {
          /* storage unavailable — ignore */
        }

        setDone(true);
        setBanner({
          kind: "success",
          text: `Authenticated${data.account?.name ? ` — welcome, ${data.account.name}` : ""}! Opening workspace…`,
        });
        window.setTimeout(() => router.push("/bridge/dashboard"), 1200);
      } catch (err) {
        setBanner({
          kind: "error",
          text: err instanceof Error ? err.message : "Something went wrong.",
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, done, email, password, remember, router]
  );

  const onSso = useCallback(
    (kind: "sso" | "fido2") => {
      toast({
        title: kind === "sso" ? "Cloud SSO isn't configured yet" : "FIDO2 keys aren't enrolled",
        description:
          kind === "sso"
            ? "Enterprise SSO (Okta / Azure AD / SAML) needs an IdP setup in this demo — use your cloud credentials."
            : "WebAuthn / YubiKey enrollment is handled by your cloud administrator in this demo.",
      });
    },
    [toast]
  );

  const onForgot = useCallback(() => {
    toast({
      title: "Password recovery",
      description: "Use the same Forgot password flow as the cloud app — a reset link is sent to your email.",
    });
  }, [toast]);

  return (
    <div className="br-root font-br-sans flex min-h-dvh select-none flex-col justify-between bg-br-surface-container-lowest text-br-on-surface">
      {/* ── window titlebar ── */}
      <header className="flex h-[2.375rem] w-full items-center justify-between bg-br-surface-container-lowest/90 px-4 backdrop-blur-xl">
        <div className="flex w-48 items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#ff5f56] shadow-sm" />
            <span className="inline-block h-3 w-3 rounded-full bg-[#ffbd2e] shadow-sm" />
            <span className="inline-block h-3 w-3 rounded-full bg-[#27c93f] shadow-sm" />
          </div>
          <span className="ml-1 font-br-mono text-br-code-mono-sm uppercase tracking-wider text-br-outline">
            ukuu-bridge
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-br-mono text-br-code-mono font-medium text-br-on-surface">
            Ukuu HR — Access Sync Bridge v3.4.2
          </span>
          <div className="flex items-center gap-1 rounded-full bg-br-surface-container-low px-2 py-0.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]" />
            <span className="font-br-mono text-br-code-mono-sm font-medium text-[#10b981]">
              Daemon Active
            </span>
          </div>
        </div>

        <div className="flex w-48 items-center justify-end">
          <span className="font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
            v3.4.2-rel
          </span>
        </div>
      </header>

      {/* ── auth stage — cloud-matching sign-in card ── */}
      <main className="flex flex-1 items-center justify-center bg-br-surface-container-lowest p-5">
        <div className="relative flex w-full flex-col items-center justify-center py-8">
          {/* ambient atmospheric glows */}
          <div className="pointer-events-none absolute -left-20 -top-12 h-96 w-96 rounded-full bg-br-primary-container/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-20 h-[32rem] w-[32rem] rounded-full bg-br-secondary-container/15 blur-[100px]" />

          <div className="relative w-full max-w-[460px]">
            <div className="au-card" style={{ width: "100%" }}>
              {/* brand lockup — same identity as the cloud app */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 20 }}>
                <a href="/login" className="au-logo" aria-label="Ukuu HR home">
                  <span className="au-logo-badge">
                    <UkuuLogoMark size={26} white />
                  </span>
                  <span>
                    <span className="au-logo-name">UKUU HR</span>
                    <span className="au-logo-sub">Access Sync Bridge</span>
                  </span>
                </a>
                <span className="au-status">
                  <span className="au-status-dot" />
                  All systems operational
                </span>
              </div>

              {/* gateway connectivity pill */}
              <div className="flex items-center justify-between rounded-full bg-br-surface-container-low px-3 py-1 shadow-inner" style={{ marginBottom: 22 }}>
                <div className="flex items-center gap-1">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-br-tertiary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-br-primary" />
                  </span>
                  <span className="font-br-mono text-br-code-mono-sm text-br-on-surface">
                    Cloud Gateway: Connected (us-east-1)
                  </span>
                </div>
                <div className="flex items-center gap-0.5 font-br-mono text-br-code-mono-sm text-br-tertiary">
                  <Zap size={12} />
                  <span>24ms</span>
                </div>
              </div>

              {/* heading — same structure as the cloud card */}
              <p className="au-kicker">SIGN IN</p>
              <h2 className="au-card-h">Sign in to the Bridge</h2>
              <p className="au-card-sub">
                Authenticate this device with the same credentials you use on the cloud app.
              </p>

              {banner && (
                <div className={`au-banner au-banner--${banner.kind}`} role="status" aria-live="polite">
                  {banner.kind === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                  <span>{banner.text}</span>
                </div>
              )}

              <form onSubmit={onSubmit} noValidate>
                {/* email address — identical to the cloud field */}
                <div className="au-field au-field--first">
                  <div className="au-lrow">
                    <label className="au-label" htmlFor="br-email">
                      EMAIL ADDRESS
                    </label>
                  </div>
                  <div className="au-inputwrap">
                    <span className="au-lead-icon">
                      <Mail size={18} strokeWidth={1.9} />
                    </span>
                    <input
                      ref={emailRef}
                      id="br-email"
                      className={`au-input au-input--plainer${errors.email ? " au-invalid" : ""}`}
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={Boolean(errors.email)}
                      aria-describedby={errors.email ? "br-email-err" : undefined}
                    />
                  </div>
                  {errors.email && (
                    <p className="au-err" id="br-email-err" role="alert">
                      <AlertCircle size={13.5} />
                      {errors.email}
                    </p>
                  )}
                </div>

                {/* password — identical to the cloud field */}
                <div className="au-field">
                  <div className="au-lrow">
                    <label className="au-label" htmlFor="br-password">
                      PASSWORD
                    </label>
                    <button type="button" className="au-link-inline" onClick={onForgot}>
                      Forgot?
                    </button>
                  </div>
                  <div className="au-inputwrap">
                    <span className="au-lead-icon">
                      <Lock size={18} strokeWidth={1.9} />
                    </span>
                    <input
                      id="br-password"
                      className={`au-input${errors.password ? " au-invalid" : ""}`}
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      aria-invalid={Boolean(errors.password)}
                      aria-describedby={errors.password ? "br-password-err" : undefined}
                    />
                    <button
                      type="button"
                      className="au-trail"
                      onClick={() => setShowPw((v) => !v)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      title={showPw ? "Hide password" : "Show password"}
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="au-err" id="br-password-err" role="alert">
                      <AlertCircle size={13.5} />
                      {errors.password}
                    </p>
                  )}
                </div>

                {/* remember me — cloud wording (bridge sessions last 30 days) */}
                <label className="au-checkrow">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                  />
                  <span className="au-check">
                    <Check size={13} strokeWidth={3.2} />
                  </span>
                  <span className="au-check-label">Remember me for 30 days</span>
                </label>

                <button type="submit" className="au-btn-primary" disabled={loading || done}>
                  {loading ? (
                    <>
                      <Loader2 size={17} className="au-spinner" />
                      Authenticating…
                    </>
                  ) : (
                    <>
                      Sign In to Bridge Daemon
                      <ArrowRight size={17} strokeWidth={2.4} />
                    </>
                  )}
                </button>
              </form>

              {/* secure sign-in options */}
              <div className="au-divider">
                <span className="au-divider-text">OR SECURE SIGN-IN WITH</span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  disabled={loading || done}
                  className="au-btn-google"
                  onClick={() => onSso("sso")}
                  style={{ justifyContent: "flex-start", padding: "0 16px" }}
                >
                  <Building size={18} strokeWidth={1.9} />
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span style={{ fontWeight: 700 }}>Cloud SSO</span>
                    <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.75 }}>Okta · Azure AD · SAML</span>
                  </span>
                </button>
                <button
                  type="button"
                  disabled={loading || done}
                  className="au-btn-google"
                  onClick={() => onSso("fido2")}
                  style={{ justifyContent: "flex-start", padding: "0 16px" }}
                >
                  <KeyRound size={18} strokeWidth={1.9} />
                  <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 1 }}>
                    <span style={{ fontWeight: 700 }}>FIDO2 / Key</span>
                    <span style={{ fontSize: 10.5, fontWeight: 500, opacity: 0.75 }}>WebAuthn · YubiKey</span>
                  </span>
                </button>
              </div>

              {/* security footnote */}
              <div
                className="au-cardfoot"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" }}
              >
                <ShieldCheck size={12.5} />
                End-to-end encrypted with TLS 1.3 · Local audit log enabled
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── status bar footer ── */}
      <footer className="flex h-8 w-full items-center justify-between bg-br-surface-container-lowest/95 px-4 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <span className="font-br-sans text-br-label-caps uppercase text-br-outline">Local Daemon:</span>
            <span className="font-br-mono text-br-code-mono-sm text-br-on-surface">127.0.0.1:4370</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-br-sans text-br-label-caps uppercase text-br-outline">Encryption:</span>
            <span className="font-br-mono text-br-code-mono-sm text-br-tertiary">TLS 1.3 AES-256</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
            <span className="font-br-sans text-br-label-caps uppercase text-br-outline">Ukuu Cloud Gateway:</span>
            <span className="font-br-mono text-br-code-mono-sm font-semibold text-[#10b981]">Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}