"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Moon,
  Sun,
  User,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { IS_ADMIN_PLATFORM } from "@/lib/platform"
import { BrandLogo, StatusBadge, BrandPanel } from "./BrandPanel"
import { GoogleLogo } from "./google-logo"

type Mode = "signin" | "signup" | "forgot"
type Banner = { kind: "success" | "error"; text: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function passwordScore(pw: string): number {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) score++
  return Math.max(1, score)
}

function isSafeReturn(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//") && url !== "/login"
}

/**
 * The full UKUU HR authentication experience:
 * split-screen brand panel + auth card with sign-in, sign-up and
 * password-recovery flows (mock backend), theme toggle, Google SSO stub.
 */
export default function AuthExperience() {
  const params = useSearchParams()
  const router = useRouter()
  const { toast } = useToast()

  const returnUrl = useMemo(() => {
    const raw = params.get("ReturnUrl") ?? params.get("returnUrl") ?? ""
    return isSafeReturn(raw) ? raw : ""
  }, [params])

  const initialMode = useMemo<Mode>(() => {
    const m = params.get("mode")
    if (m === "signup") return "signup"
    if (m === "forgot") return "forgot"
    return "signin"
  }, [params])

  const [mode, setMode] = useState<Mode>(initialMode)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [terms, setTerms] = useState(false)

  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState<Banner>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [done, setDone] = useState(false)

  const emailRef = useRef<HTMLInputElement>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  /* restore remembered preferences */
  useEffect(() => {
    try {
      const remembered = localStorage.getItem("ukuu_remember")
      if (remembered !== null) setRemember(remembered === "1")
      if (remembered === "1") {
        const saved = localStorage.getItem("ukuu_email")
        if (saved) setEmail(saved)
      }
      if (localStorage.getItem("ukuu_theme") === "dark") setTheme("dark")
    } catch {
      /* storage unavailable — ignore */
    }
  }, [])

  /* re-sync when arriving with a different ?mode= */
  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  /* the full signup experience now lives at /signup */
  useEffect(() => {
    if (initialMode === "signup") router.replace("/signup")
  }, [initialMode, router])

  /* welcome banner after successful registration */
  useEffect(() => {
    if (params.get("welcome") === "1") {
      setBanner({
        kind: "success",
        text: "Workspace created successfully — sign in to continue.",
      })
    }
  }, [params])

  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light"
      try {
        localStorage.setItem("ukuu_theme", next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const switchMode = useCallback(
    (next: Mode) => {
      setMode(next)
      setErrors({})
      setBanner(null)
      setShowPw(false)
      requestAnimationFrame(() => {
        if (next === "signup") nameRef.current?.focus()
        else emailRef.current?.focus()
      })
    },
    []
  )

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (mode === "signup" && name.trim().length < 2) {
      e.name = "Enter your full name (at least 2 characters)."
    }
    if (!EMAIL_RE.test(email.trim())) {
      e.email =
        mode === "forgot"
          ? "Enter the email linked to your account."
          : "Enter a valid work email address."
    }
    if (mode !== "forgot" && password.length < 6) {
      e.password = "Password must be at least 6 characters."
    }
    if (mode === "signup" && !terms) {
      e.terms = "Please accept the Terms of Service to continue."
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }, [mode, name, email, password, terms])

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault()
      if (loading || done) return
      setBanner(null)
      if (!validate()) return

      const endpoint =
        mode === "signin"
          ? "/api/auth/login"
          : mode === "signup"
            ? "/api/auth/register"
            : "/api/auth/forgot"

      const payload =
        mode === "signin"
          ? { email: email.trim(), password, remember }
          : mode === "signup"
            ? { name: name.trim(), email: email.trim(), password }
            : { email: email.trim() }

      setLoading(true)
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; message?: string; user?: { name?: string; email?: string }; token?: string }
          | null

        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Something went wrong. Please try again.")
        }

        if (mode === "forgot") {
          setDone(true)
          setBanner({ kind: "success", text: data.message ?? "Reset link sent." })
          return
        }

        /* persist the mock session */
        try {
          const store = remember ? localStorage : sessionStorage
          store.setItem(
            "ukuu_session",
            JSON.stringify({ user: data.user, token: data.token })
          )
          localStorage.setItem("ukuu_remember", remember ? "1" : "0")
          if (remember) localStorage.setItem("ukuu_email", email.trim())
          else localStorage.removeItem("ukuu_email")
        } catch {
          /* ignore */
        }

        setDone(true)
        setBanner({
          kind: "success",
          text:
            mode === "signin"
              ? `Welcome back${data.user?.name ? `, ${data.user.name}` : ""}! Redirecting to your workspace…`
              : `Your workspace is ready. Redirecting…`,
        })
        const dest = returnUrl || (IS_ADMIN_PLATFORM ? "/dashboard" : "/")
        window.setTimeout(() => router.push(dest), 1100)
      } catch (err) {
        setBanner({
          kind: "error",
          text: err instanceof Error ? err.message : "Something went wrong.",
        })
      } finally {
        setLoading(false)
      }
    },
    [loading, done, validate, mode, email, password, remember, name, returnUrl, router]
  )

  const onGoogle = useCallback(async () => {
    if (googleLoading || loading || done) return
    setGoogleLoading(true)
    await new Promise((r) => setTimeout(r, 750))
    setGoogleLoading(false)
    toast({
      title: "SSO isn't configured yet",
      description:
        "Google sign-in needs OAuth credentials in this demo — use your email for now.",
    })
  }, [googleLoading, loading, done, toast])

  const score = passwordScore(password)

  /* ---------- render ---------- */
  return (
    <div className={`au-root${theme === "dark" ? " au-dark" : ""}`}>
      <div className="au-shell">
        <BrandPanel />

        <main className="au-main">
          <div className="au-topbar">
            <a href="/" className="au-back">
              <ArrowLeft size={16} strokeWidth={2.2} />
              Back to home
            </a>
            <button
              type="button"
              className="au-theme-btn"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <Sun size={19} /> : <Moon size={19} />}
            </button>
          </div>

          <section style={{ width: "100%", display: "grid", justifyItems: "center" }}>
            <div className="au-mobile-brand">
              <BrandLogo />
              <StatusBadge />
            </div>

            <div className="au-card" key={done && mode === "forgot" ? "done" : mode}>
              <div className="au-swap">
                {done && mode === "forgot" ? (
                  <ForgotDone email={email.trim()} onBack={() => switchMode("signin")} />
                ) : (
                  <form onSubmit={onSubmit} noValidate>
                    {banner && (
                      <div
                        className={`au-banner au-banner--${banner.kind}`}
                        role="status"
                        aria-live="polite"
                      >
                        {banner.kind === "success" ? (
                          <CheckCircle2 size={17} />
                        ) : (
                          <AlertCircle size={17} />
                        )}
                        <span>{banner.text}</span>
                      </div>
                    )}

                    {mode === "signin" && (
                      <>
                        <p className="au-kicker">SIGN IN</p>
                        <h2 className="au-card-h">Welcome back</h2>
                        <p className="au-card-sub">
                          Sign in to your Ukuu HR workspace to continue.
                        </p>
                      </>
                    )}

                    {mode === "signup" && (
                      <>
                        <p className="au-kicker">CREATE ACCOUNT</p>
                        <h2 className="au-card-h">Get started with Ukuu</h2>
                        <p className="au-card-sub">
                          Create your workspace in minutes — no credit card
                          required.
                        </p>
                      </>
                    )}

                    {mode === "forgot" && (
                      <>
                        <p className="au-kicker">RESET PASSWORD</p>
                        <h2 className="au-card-h">Forgot your password?</h2>
                        <p className="au-card-sub">
                          Enter your email and we&apos;ll send you a reset link.
                        </p>
                      </>
                    )}

                    {mode === "signup" && (
                      <div className={`au-field${mode === "signup" ? " au-field--first" : ""}`}>
                        <div className="au-lrow">
                          <label className="au-label" htmlFor="au-name">
                            FULL NAME
                          </label>
                        </div>
                        <div className="au-inputwrap">
                          <span className="au-lead-icon">
                            <User size={18} strokeWidth={1.9} />
                          </span>
                          <input
                            ref={nameRef}
                            id="au-name"
                            className={`au-input au-input--plainer${errors.name ? " au-invalid" : ""}`}
                            type="text"
                            autoComplete="name"
                            placeholder="Amara Okafor"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            aria-invalid={Boolean(errors.name)}
                            aria-describedby={errors.name ? "au-name-err" : undefined}
                          />
                        </div>
                        {errors.name && (
                          <p className="au-err" id="au-name-err" role="alert">
                            <AlertCircle size={13.5} />
                            {errors.name}
                          </p>
                        )}
                      </div>
                    )}

                    <div
                      className={`au-field${mode === "signup" ? "" : " au-field--first"}`}
                    >
                      <div className="au-lrow">
                        <label className="au-label" htmlFor="au-email">
                          EMAIL ADDRESS
                        </label>
                      </div>
                      <div className="au-inputwrap">
                        <span className="au-lead-icon">
                          <Mail size={18} strokeWidth={1.9} />
                        </span>
                        <input
                          ref={emailRef}
                          id="au-email"
                          className={`au-input au-input--plainer${errors.email ? " au-invalid" : ""}`}
                          type="email"
                          inputMode="email"
                          autoComplete="email"
                          placeholder="you@company.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          aria-invalid={Boolean(errors.email)}
                          aria-describedby={errors.email ? "au-email-err" : undefined}
                        />
                      </div>
                      {errors.email && (
                        <p className="au-err" id="au-email-err" role="alert">
                          <AlertCircle size={13.5} />
                          {errors.email}
                        </p>
                      )}
                    </div>

                    {mode !== "forgot" && (
                      <div className="au-field">
                        <div className="au-lrow">
                          <label className="au-label" htmlFor="au-password">
                            PASSWORD
                          </label>
                          {mode === "signin" && (
                            <button
                              type="button"
                              className="au-link-inline"
                              onClick={() => switchMode("forgot")}
                            >
                              Forgot?
                            </button>
                          )}
                        </div>
                        <div className="au-inputwrap">
                          <span className="au-lead-icon">
                            <Lock size={18} strokeWidth={1.9} />
                          </span>
                          <input
                            id="au-password"
                            className={`au-input${errors.password ? " au-invalid" : ""}`}
                            type={showPw ? "text" : "password"}
                            autoComplete={
                              mode === "signin" ? "current-password" : "new-password"
                            }
                            placeholder={mode === "signin" ? "••••••••" : "Create a password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            aria-invalid={Boolean(errors.password)}
                            aria-describedby={errors.password ? "au-password-err" : undefined}
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

                        {mode === "signup" && password.length > 0 && (
                          <div className={`au-strength au-strength--${score}`}>
                            <div className="au-strength-bars">
                              <span className="au-strength-bar" />
                              <span className="au-strength-bar" />
                              <span className="au-strength-bar" />
                            </div>
                            <span className="au-strength-label">
                              {score <= 1 ? "Weak" : score === 2 ? "Fair" : "Strong"} password
                            </span>
                          </div>
                        )}

                        {errors.password && (
                          <p className="au-err" id="au-password-err" role="alert">
                            <AlertCircle size={13.5} />
                            {errors.password}
                          </p>
                        )}
                      </div>
                    )}

                    {mode === "signin" && (
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
                    )}

                    {mode === "signup" && (
                      <label className="au-checkrow">
                        <input
                          type="checkbox"
                          checked={terms}
                          onChange={(e) => setTerms(e.target.checked)}
                        />
                        <span className="au-check">
                          <Check size={13} strokeWidth={3.2} />
                        </span>
                        <span className="au-check-label">
                          I agree to the{" "}
                          <a href="#" onClick={(e) => e.preventDefault()}>
                            Terms of Service
                          </a>{" "}
                          and{" "}
                          <a href="#" onClick={(e) => e.preventDefault()}>
                            Privacy Policy
                          </a>
                        </span>
                      </label>
                    )}
                    {errors.terms && (
                      <p className="au-err" id="au-terms-err" role="alert">
                        <AlertCircle size={13.5} />
                        {errors.terms}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="au-btn-primary"
                      disabled={loading || done}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={17} className="au-spinner" />
                          {mode === "signin"
                            ? "Signing in…"
                            : mode === "signup"
                              ? "Creating workspace…"
                              : "Sending link…"}
                        </>
                      ) : (
                        <>
                          {mode === "signin"
                            ? "Sign In to Dashboard"
                            : mode === "signup"
                              ? "Create Account"
                              : "Send Reset Link"}
                          <ArrowRight size={17} strokeWidth={2.4} />
                        </>
                      )}
                    </button>

                    <div className="au-divider">
                      <span className="au-divider-text">OR CONTINUE WITH</span>
                    </div>

                    <button
                      type="button"
                      className="au-btn-google"
                      onClick={onGoogle}
                      disabled={googleLoading || loading || done}
                    >
                      {googleLoading ? (
                        <Loader2 size={18} className="au-spinner" />
                      ) : (
                        <GoogleLogo size={18} />
                      )}
                      {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
                    </button>

                    <p className="au-cardfoot">
                      {mode === "signin" && (
                        <>
                          Don&apos;t have an account?
                          <a className="au-foot-link" href="/signup">
                            Create an account
                          </a>
                        </>
                      )}
                      {mode === "signup" && (
                        <>
                          Already have an account?
                          <button
                            type="button"
                            className="au-foot-link"
                            onClick={() => switchMode("signin")}
                          >
                            Sign in
                          </button>
                        </>
                      )}
                      {mode === "forgot" && (
                        <>
                          Remembered your password?
                          <button
                            type="button"
                            className="au-foot-link"
                            onClick={() => switchMode("signin")}
                          >
                            Back to sign in
                          </button>
                        </>
                      )}
                    </p>
                  </form>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}

/* ---------- forgot-password success state ---------- */
function ForgotDone({ email, onBack }: { email: string; onBack: () => void }) {
  return (
    <div className="au-done">
      <div className="au-done-icon">
        <CheckCircle2 size={30} strokeWidth={1.8} />
      </div>
      <h2 className="au-done-h">Check your inbox</h2>
      <p className="au-done-sub">
        If an account exists for{" "}
        <strong style={{ color: "inherit", fontWeight: 700 }}>{email}</strong>, a
        password reset link is on its way. It expires in 30 minutes.
      </p>
      <button type="button" className="au-btn-secondary" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={2.2} />
        Back to sign in
      </button>
    </div>
  )
}
