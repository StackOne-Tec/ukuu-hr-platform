"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleCheck,
  Eye,
  EyeOff,
  Globe,
  Briefcase,
  Loader2,
  Lock,
  Mail,
  Moon,
  Phone,
  Sun,
  User,
  Users,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { HOME_HREF } from "@/lib/platform"
import { SignupSidebar } from "./SignupSidebar"
import { GoogleLogo } from "./google-logo"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const COUNTRIES = ["Zambia", "Kenya", "Uganda", "Nigeria", "Tanzania", "South Africa", "Malawi", "Other"]
const INDUSTRIES = ["Technology", "Finance", "Healthcare", "Agriculture", "Manufacturing", "Retail", "Education", "Logistics", "Other"]
const SIZES = ["1–10 employees", "11–50 employees", "51–200 employees", "201–500 employees", "500+ employees"]

function passwordIssues(pw: string): string[] {
  const issues: string[] = []
  if (pw.length < 8) issues.push("at least 8 characters")
  if (!/[A-Z]/.test(pw)) issues.push("an uppercase letter")
  if (!/[a-z]/.test(pw)) issues.push("a lowercase letter")
  if (!/\d/.test(pw)) issues.push("a number")
  return issues
}

type Form = {
  firstName: string
  lastName: string
  email: string
  phone: string
  organization: string
  country: string
  industry: string
  employees: string
  password: string
  confirm: string
  terms: boolean
}

const INITIAL: Form = {
  firstName: "James",
  lastName: "Mwale",
  email: "",
  phone: "",
  organization: "",
  country: "",
  industry: "",
  employees: SIZES[0],
  password: "",
  confirm: "",
  terms: false,
}

/**
 * The UKUU HR "Create your account" page:
 * dark indigo sidebar (stats, testimonial) + long registration form
 * with validation, password rules, country selects and workspace creation.
 */
export default function SignupExperience() {
  const router = useRouter()
  const { toast } = useToast()

  const [form, setForm] = useState<Form>(INITIAL)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [showPw, setShowPw] = useState(false)
  const [banner, setBanner] = useState<{ kind: "success" | "error"; text: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [theme, setTheme] = useState<"light" | "dark">("light")

  const pwIssues = useMemo(() => passwordIssues(form.password), [form.password])
  const pwOk = form.password.length > 0 && pwIssues.length === 0

  useEffect(() => {
    try {
      if (localStorage.getItem("ukuu_theme") === "dark") setTheme("dark")
    } catch {
      /* ignore */
    }
  }, [])

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

  const set = useCallback(<K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    setErrors((e) => {
      if (!(key in e)) return e
      const next = { ...e }
      delete next[key as string]
      return next
    })
  }, [])

  const validate = useCallback((): boolean => {
    const e: Record<string, string> = {}
    if (form.firstName.trim().length < 2) e.firstName = "Enter your first name."
    if (form.lastName.trim().length < 2) e.lastName = "Enter your last name."
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid work email address."
    if (form.organization.trim().length < 2) e.organization = "Enter your organization name."
    if (!form.country) e.country = "Select the country you operate from."
    if (form.password.length === 0) e.password = "Create a password."
    else if (pwIssues.length > 0)
      e.password = `Password needs ${pwIssues.join(", ")}.`
    if (form.confirm !== form.password) e.confirm = "Passwords do not match."
    if (!form.terms) e.terms = "Please accept the Terms of Service to continue."
    setErrors(e)
    if (Object.keys(e).length > 0) {
      const first = document.querySelector<HTMLInputElement>(".sg-input.sg-invalid, .sg-select.sg-invalid")
      first?.focus()
      return false
    }
    return true
  }, [form, pwIssues])

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault()
      if (loading || done) return
      setBanner(null)
      if (!validate()) return

      setLoading(true)
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            organization: form.organization.trim(),
            country: form.country,
            industry: form.industry,
            employees: form.employees,
            password: form.password,
          }),
        })
        const data = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; user?: { name?: string; email?: string }; token?: string }
          | null
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "Something went wrong. Please try again.")
        }

        try {
          sessionStorage.setItem(
            "ukuu_session",
            JSON.stringify({ user: data.user, token: data.token })
          )
        } catch {
          /* ignore */
        }

        setDone(true)
        setBanner({
          kind: "success",
          text: `Welcome aboard${data.user?.name ? `, ${data.user.name}` : ""}! Your workspace is being provisioned…`,
        })
        window.setTimeout(() => router.push("/login?welcome=1"), 1500)
      } catch (err) {
        setBanner({
          kind: "error",
          text: err instanceof Error ? err.message : "Something went wrong.",
        })
      } finally {
        setLoading(false)
      }
    },
    [loading, done, validate, form, router]
  )

  const onGoogle = useCallback(async () => {
    if (googleLoading || loading || done) return
    setGoogleLoading(true)
    await new Promise((r) => setTimeout(r, 750))
    setGoogleLoading(false)
    toast({
      title: "SSO isn't configured yet",
      description: "Google sign-up needs OAuth credentials in this demo — use the form for now.",
    })
  }, [googleLoading, loading, done, toast])

  /* ---------- render ---------- */
  return (
    <div className={`sg-root${theme === "dark" ? " sg-dark" : ""}`}>
      <div className="sg-shell">
        <SignupSidebar />

        <main className="sg-main">
          <div className="sg-topbar">
            <a href={HOME_HREF} className="sg-back">
              <ArrowLeft size={15} strokeWidth={2.2} />
              Back to home
            </a>
            <button
              type="button"
              className="sg-theme-btn"
              onClick={toggleTheme}
              aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
            >
              {theme === "light" ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>

          <div className="sg-col">
            <div className="sg-mobile-head">
              <a href={HOME_HREF} className="sg-logo" aria-label="Ukuu HR home">
                <span className="sg-logo-badge">
                  <User size={20} strokeWidth={2} />
                </span>
                <span>
                  <span className="sg-logo-name">UKUU HR</span>
                  <span className="sg-logo-sub">HRMS Platform</span>
                </span>
              </a>
              <span className="sg-mobile-status">
                <span className="sg-mobile-status-dot" />
                All systems operational
              </span>
            </div>

            <form onSubmit={onSubmit} noValidate>
              {banner && (
                <div className={`sg-banner sg-banner--${banner.kind}`} role="status" aria-live="polite">
                  {banner.kind === "success" ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
                  <span>{banner.text}</span>
                </div>
              )}

              <div>
                <span className="sg-badge">
                  <span className="sg-badge-dot" />
                  GET STARTED FREE
                </span>
                <h2 className="sg-title">Create your account</h2>
                <p className="sg-title-sub">
                  Set up your HR workspace. Already have one?{" "}
                  <a href="/login">Sign in</a>
                </p>
              </div>

              {/* names */}
              <div className="sg-row" style={{ marginTop: 22 }}>
                <div>
                  <label className="sg-label" htmlFor="sg-first">
                    First Name<span className="sg-req">*</span>
                  </label>
                  <div className="sg-inputwrap">
                    <span className="sg-lead">
                      <User size={17} strokeWidth={1.9} />
                    </span>
                    <input
                      id="sg-first"
                      className={`sg-input${errors.firstName ? " sg-invalid" : ""}`}
                      type="text"
                      autoComplete="given-name"
                      placeholder="James"
                      value={form.firstName}
                      onChange={(e) => set("firstName", e.target.value)}
                      aria-invalid={Boolean(errors.firstName)}
                    />
                  </div>
                  {errors.firstName && (
                    <p className="sg-err" role="alert">
                      <AlertCircle size={13} />
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div>
                  <label className="sg-label" htmlFor="sg-last">
                    Last Name<span className="sg-req">*</span>
                  </label>
                  <div className="sg-inputwrap">
                    <span className="sg-lead">
                      <User size={17} strokeWidth={1.9} />
                    </span>
                    <input
                      id="sg-last"
                      className={`sg-input${errors.lastName ? " sg-invalid" : ""}`}
                      type="text"
                      autoComplete="family-name"
                      placeholder="Mwale"
                      value={form.lastName}
                      onChange={(e) => set("lastName", e.target.value)}
                      aria-invalid={Boolean(errors.lastName)}
                    />
                  </div>
                  {errors.lastName && (
                    <p className="sg-err" role="alert">
                      <AlertCircle size={13} />
                      {errors.lastName}
                    </p>
                  )}
                </div>
              </div>

              {/* email + phone */}
              <div className="sg-field" id="sg-first-field">
                <label className="sg-label" htmlFor="sg-email">
                  Work Email<span className="sg-req">*</span>
                </label>
                <div className="sg-inputwrap">
                  <span className="sg-lead">
                    <Mail size={17} strokeWidth={1.9} />
                  </span>
                  <input
                    id="sg-email"
                    className={`sg-input${errors.email ? " sg-invalid" : ""}`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                  />
                </div>
                {errors.email && (
                  <p className="sg-err" role="alert">
                    <AlertCircle size={13} />
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="sg-field">
                <label className="sg-label" htmlFor="sg-phone">
                  Phone Number
                </label>
                <div className="sg-inputwrap">
                  <span className="sg-lead">
                    <Phone size={17} strokeWidth={1.9} />
                  </span>
                  <input
                    id="sg-phone"
                    className="sg-input"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+260 97 123 4567"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </div>
              </div>

              {/* organization */}
              <div className="sg-field">
                <label className="sg-label" htmlFor="sg-org">
                  Organization Name<span className="sg-req">*</span>
                </label>
                <div className="sg-inputwrap">
                  <span className="sg-lead">
                    <Building2 size={17} strokeWidth={1.9} />
                  </span>
                  <input
                    id="sg-org"
                    className={`sg-input${errors.organization ? " sg-invalid" : ""}`}
                    type="text"
                    autoComplete="organization"
                    placeholder="Acme Ltd"
                    value={form.organization}
                    onChange={(e) => set("organization", e.target.value)}
                    aria-invalid={Boolean(errors.organization)}
                  />
                </div>
                {errors.organization && (
                  <p className="sg-err" role="alert">
                    <AlertCircle size={13} />
                    {errors.organization}
                  </p>
                )}
              </div>

              {/* country + industry */}
              <div className="sg-row" style={{ marginTop: 18 }}>
                <div>
                  <label className="sg-label" htmlFor="sg-country">
                    Country<span className="sg-req">*</span>
                  </label>
                  <div className="sg-inputwrap">
                    <span className="sg-lead">
                      <Globe size={17} strokeWidth={1.9} />
                    </span>
                    <select
                      id="sg-country"
                      className={`sg-select${errors.country ? " sg-invalid" : ""}`}
                      value={form.country}
                      onChange={(e) => set("country", e.target.value)}
                      aria-invalid={Boolean(errors.country)}
                    >
                      <option value="">Select country</option>
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <span className="sg-trail" style={{ pointerEvents: "none" }}>
                      <ChevronDown size={16} strokeWidth={2.1} />
                    </span>
                  </div>
                  {errors.country && (
                    <p className="sg-err" role="alert">
                      <AlertCircle size={13} />
                      {errors.country}
                    </p>
                  )}
                </div>
                <div>
                  <label className="sg-label" htmlFor="sg-industry">
                    Industry
                  </label>
                  <div className="sg-inputwrap">
                    <span className="sg-lead">
                      <Briefcase size={17} strokeWidth={1.9} />
                    </span>
                    <select
                      id="sg-industry"
                      className="sg-select"
                      value={form.industry}
                      onChange={(e) => set("industry", e.target.value)}
                    >
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((i) => (
                        <option key={i} value={i}>
                          {i}
                        </option>
                      ))}
                    </select>
                    <span className="sg-trail" style={{ pointerEvents: "none" }}>
                      <ChevronDown size={16} strokeWidth={2.1} />
                    </span>
                  </div>
                </div>
              </div>

              {/* employees */}
              <div className="sg-field">
                <label className="sg-label" htmlFor="sg-size">
                  Number of Employees
                </label>
                <div className="sg-inputwrap">
                  <span className="sg-lead">
                    <Users size={17} strokeWidth={1.9} />
                  </span>
                  <select
                    id="sg-size"
                    className="sg-select"
                    value={form.employees}
                    onChange={(e) => set("employees", e.target.value)}
                  >
                    {SIZES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <span className="sg-trail" style={{ pointerEvents: "none" }}>
                    <ChevronDown size={16} strokeWidth={2.1} />
                  </span>
                </div>
              </div>

              {/* passwords */}
              <div className="sg-field">
                <label className="sg-label" htmlFor="sg-password">
                  Create Password<span className="sg-req">*</span>
                </label>
                <div className="sg-inputwrap">
                  <span className="sg-lead">
                    <Lock size={17} strokeWidth={1.9} />
                  </span>
                  <input
                    id="sg-password"
                    className={`sg-input${errors.password ? " sg-invalid" : ""}`}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby="sg-password-hint"
                  />
                  <button
                    type="button"
                    className="sg-trail"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? "Hide password" : "Show password"}
                    title={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <p
                  className={`sg-hint${pwOk ? " sg-hint--ok" : ""}`}
                  id="sg-password-hint"
                >
                  {pwOk
                    ? "Your password meets all requirements."
                    : "Use at least 8 characters with uppercase, lowercase, and numbers"}
                </p>
                {errors.password && (
                  <p className="sg-err" role="alert">
                    <AlertCircle size={13} />
                    {errors.password}
                  </p>
                )}
              </div>

              <div className="sg-field">
                <label className="sg-label" htmlFor="sg-confirm">
                  Confirm Password<span className="sg-req">*</span>
                </label>
                <div className="sg-inputwrap">
                  <span className="sg-lead">
                    <Lock size={17} strokeWidth={1.9} />
                  </span>
                  <input
                    id="sg-confirm"
                    className={`sg-input${errors.confirm ? " sg-invalid" : ""}`}
                    type={showPw ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="Repeat your password"
                    value={form.confirm}
                    onChange={(e) => set("confirm", e.target.value)}
                    aria-invalid={Boolean(errors.confirm)}
                  />
                </div>
                {errors.confirm && (
                  <p className="sg-err" role="alert">
                    <AlertCircle size={13} />
                    {errors.confirm}
                  </p>
                )}
              </div>

              {/* terms */}
              <label className="sg-terms">
                <input
                  type="checkbox"
                  checked={form.terms}
                  onChange={(e) => set("terms", e.target.checked)}
                />
                <span className="sg-check">
                  <Check size={12} strokeWidth={3.2} />
                </span>
                <span className="sg-terms-label">
                  I agree to the{" "}
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a href="#" onClick={(e) => e.preventDefault()}>
                    Privacy Policy
                  </a>
                  . I understand that my workspace will be set up immediately upon
                  registration.
                </span>
              </label>
              {errors.terms && (
                <p className="sg-err" role="alert">
                  <AlertCircle size={13} />
                  {errors.terms}
                </p>
              )}

              <button type="submit" className="sg-submit" disabled={loading || done}>
                {loading ? (
                  <>
                    <Loader2 size={17} className="sg-spinner" />
                    Creating your workspace…
                  </>
                ) : (
                  <>
                    Create your workspace
                    <ArrowRight size={17} strokeWidth={2.4} />
                  </>
                )}
              </button>

              <div className="sg-divider">
                <span className="sg-divider-text">OR CONTINUE WITH</span>
              </div>

              <button
                type="button"
                className="sg-google"
                onClick={onGoogle}
                disabled={googleLoading || loading || done}
              >
                {googleLoading ? (
                  <Loader2 size={18} className="sg-spinner" />
                ) : (
                  <GoogleLogo size={18} />
                )}
                {googleLoading ? "Redirecting to Google…" : "Continue with Google"}
              </button>

              <div className="sg-benefits">
                <span className="sg-benefit">
                  <CircleCheck size={15} />
                  Free 14-day trial
                </span>
                <span className="sg-benefit">
                  <CircleCheck size={15} />
                  No credit card required
                </span>
                <span className="sg-benefit">
                  <CircleCheck size={15} />
                  Workspace ready in 2 minutes
                </span>
                <span className="sg-benefit">
                  <CircleCheck size={15} />
                  Cancel anytime
                </span>
              </div>

              <p className="sg-foot">
                Already have an account? <a href="/login">Sign in</a>
              </p>
            </form>
          </div>
        </main>
      </div>
    </div>
  )
}
