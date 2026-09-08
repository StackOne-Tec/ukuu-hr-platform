"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Lock, ShieldAlert } from "lucide-react"

/* ---------- self-contained styling (brand-matched, no external css) ---------- */
const STYLES = `
.rp-root { min-height: 100dvh; display: grid; place-items: center; background: #f7f5fc;
  font-family: 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif; color: #1a1a2e; padding: 24px; }
.rp-card { width: 100%; max-width: 440px; background: #fff; border: 1px solid #ece8f4;
  border-radius: 18px; padding: 36px 32px; box-shadow: 0 24px 60px -30px rgba(123,47,190,.25); }
.rp-brand { display: flex; align-items: center; gap: 10px; margin-bottom: 26px; }
.rp-logo { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center;
  background: linear-gradient(135deg, #7b2fbe, #6a24a8); color: #fff; }
.rp-brand-name { font-weight: 800; font-size: 15px; letter-spacing: .04em; }
.rp-brand-sub { font-size: 11px; color: #8b87a0; margin-top: 1px; }
.rp-icon { width: 54px; height: 54px; border-radius: 50%; display: grid; place-items: center;
  margin: 0 auto 16px; }
.rp-icon-ok { background: #e8f7ee; color: #17954c; }
.rp-icon-bad { background: #fdeeee; color: #c23b3b; }
.rp-icon-key { background: #f1e8fc; color: #7b2fbe; }
.rp-h { text-align: center; font-size: 21px; font-weight: 800; margin: 0 0 8px; }
.rp-sub { text-align: center; font-size: 13.5px; line-height: 1.65; color: #565166; margin: 0 0 22px; }
.rp-sub strong { color: #1a1a2e; }
.rp-label { display: block; font-size: 12.5px; font-weight: 700; color: #3d3953; margin: 0 0 7px; }
.rp-field { position: relative; margin-bottom: 16px; }
.rp-input { width: 100%; box-sizing: border-box; padding: 12px 42px 12px 14px; font-size: 14px;
  border: 1.5px solid #e4dff0; border-radius: 11px; background: #fbfaff; color: #1a1a2e; outline: none;
  transition: border-color .15s, box-shadow .15s; }
.rp-input:focus { border-color: #7b2fbe; box-shadow: 0 0 0 3.5px rgba(123,47,190,.14); background: #fff; }
.rp-eye { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); border: 0;
  background: transparent; color: #8b87a0; cursor: pointer; padding: 6px; border-radius: 7px;
  display: grid; place-items: center; }
.rp-eye:hover { color: #7b2fbe; background: #f4effc; }
.rp-meter { height: 5px; border-radius: 99px; background: #ece8f4; overflow: hidden; margin: -6px 0 14px; }
.rp-meter > div { height: 100%; border-radius: 99px; transition: width .25s, background .25s; }
.rp-hint { font-size: 11.5px; color: #8b87a0; margin: -8px 0 14px 2px; }
.rp-btn { width: 100%; padding: 13px 16px; border: 0; border-radius: 11px; cursor: pointer;
  background: linear-gradient(135deg, #7b2fbe, #6a24a8); color: #fff; font-size: 14.5px; font-weight: 700;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 10px 26px -12px rgba(123,47,190,.55); transition: transform .12s, filter .15s; }
.rp-btn:hover:not(:disabled) { filter: brightness(1.06); transform: translateY(-1px); }
.rp-btn:disabled { opacity: .6; cursor: not-allowed; }
.rp-back { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 18px;
  font-size: 13px; font-weight: 600; color: #7b2fbe; text-decoration: none; }
.rp-back:hover { text-decoration: underline; }
.rp-error { background: #fdeeee; border: 1px solid #f2caca; color: #a33030; font-size: 13px;
  line-height: 1.55; border-radius: 10px; padding: 11px 14px; margin-bottom: 16px; }
.rp-spin { animation: rp-rotate 1s linear infinite; }
@keyframes rp-rotate { to { transform: rotate(360deg); } }
.rp-check { text-align: center; margin-top: 14px; font-size: 12.5px; color: #8b87a0; }
`

function score(pw: string): { score: number; label: string; color: string } {
  let s = 0
  if (pw.length >= 8) s++
  if (pw.length >= 12) s++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  const table = [
    { label: "Too short", color: "#d5d0e3" },
    { label: "Weak", color: "#e0a03c" },
    { label: "Okay", color: "#d9c13b" },
    { label: "Good", color: "#8bbf4a" },
    { label: "Strong", color: "#17954c" },
    { label: "Excellent", color: "#0f7a3d" },
  ]
  const idx = pw.length === 0 ? 0 : Math.max(1, s)
  return { score: (idx / 5) * 100, ...table[idx] }
}

type Phase = "verifying" | "invalid" | "ready" | "success"

function ResetForm() {
  const params = useSearchParams()
  const token = (params.get("token") ?? "").trim()

  const [phase, setPhase] = useState<Phase>("verifying")
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPw, setShowPw] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token }),
      }).catch(() => null)
      const data = (await res?.json().catch(() => null)) as { ok?: boolean; email?: string } | null
      if (cancelled) return
      if (res?.ok && data?.ok) {
        setEmail(data.email ?? "")
        setPhase("ready")
      } else {
        setPhase("invalid")
      }
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault()
      if (submitting) return
      setError("")
      if (password.length < 8) {
        setError("New password must be at least 8 characters.")
        return
      }
      if (password !== confirm) {
        setError("Both passwords must match.")
        return
      }
      setSubmitting(true)
      try {
        const res = await fetch("/api/auth/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "set", token, password }),
        })
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
        if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Something went wrong. Please try again.")
        setPhase("success")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.")
      } finally {
        setSubmitting(false)
      }
    },
    [submitting, password, confirm, token]
  )

  const meter = score(password)

  useEffect(() => {
    if (phase !== "success") return
    const t = window.setTimeout(() => {
      window.location.href = "/login"
    }, 2200)
    return () => window.clearTimeout(t)
  }, [phase])

  return (
    <div className="rp-root">
      <style>{STYLES}</style>
      <div className="rp-card">
        <div className="rp-brand">
          <div className="rp-logo"><span style={{ fontWeight: 800, fontSize: 15 }}>U</span></div>
          <div>
            <div className="rp-brand-name">UKUU HR</div>
            <div className="rp-brand-sub">HRMS Platform</div>
          </div>
        </div>

        {phase === "verifying" && (
          <>
            <div className="rp-icon rp-icon-key" style={{ background: "#f1e8fc" }}>
              <Loader2 size={24} className="rp-spin" color="#7b2fbe" />
            </div>
            <h1 className="rp-h">Checking your reset link…</h1>
            <p className="rp-sub">Verifying that this password reset link is still valid.</p>
          </>
        )}

        {phase === "invalid" && (
          <>
            <div className="rp-icon rp-icon-bad"><ShieldAlert size={26} /></div>
            <h1 className="rp-h">Link no longer valid</h1>
            <p className="rp-sub">
              This reset link is invalid, has already been used, or expired after 30 minutes.
              Request a fresh link and try again.
            </p>
            <a className="rp-btn" href="/login?mode=forgot" style={{ textDecoration: "none" }}>
              Request a new reset link
            </a>
            <a className="rp-back" href="/login">Back to sign in</a>
          </>
        )}

        {phase === "ready" && (
          <>
            <div className="rp-icon rp-icon-key"><KeyRound size={24} /></div>
            <h1 className="rp-h">Set a new password</h1>
            <p className="rp-sub">
              Resetting the password for <strong>{email}</strong>. Choose something you haven&apos;t
              used before — it takes effect immediately.
            </p>
            {error && <div className="rp-error">{error}</div>}
            <form onSubmit={onSubmit} noValidate>
              <label className="rp-label" htmlFor="rp-pw">New password</label>
              <div className="rp-field">
                <input
                  id="rp-pw"
                  className="rp-input"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  autoFocus
                  required
                />
                <button type="button" className="rp-eye" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password visibility">
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              <div className="rp-meter"><div style={{ width: `${meter.score}%`, background: meter.color }} /></div>
              {password.length > 0 && <div className="rp-hint">Strength: {meter.label}</div>}

              <label className="rp-label" htmlFor="rp-pw2">Confirm new password</label>
              <div className="rp-field">
                <input
                  id="rp-pw2"
                  className="rp-input"
                  type={showPw ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter the same password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button className="rp-btn" type="submit" disabled={submitting}>
                {submitting ? <Loader2 size={16} className="rp-spin" /> : <Lock size={15} />}
                {submitting ? "Resetting…" : "Reset password"}
              </button>
            </form>
          </>
        )}

        {phase === "success" && (
          <>
            <div className="rp-icon rp-icon-ok"><CheckCircle2 size={26} /></div>
            <h1 className="rp-h">Password updated</h1>
            <p className="rp-sub">
              Your password has been reset for <strong>{email}</strong>.
              Redirecting you to sign in with your new password…
            </p>
            <a className="rp-btn" href="/login" style={{ textDecoration: "none" }}>Go to sign in</a>
            <p className="rp-check">All other sessions stay signed in.</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="rp-root">
          <div className="rp-card" style={{ textAlign: "center", color: "#8b87a0", fontSize: 14 }}>
            Loading…
          </div>
        </div>
      }
    >
      <ResetForm />
    </Suspense>
  )
}
