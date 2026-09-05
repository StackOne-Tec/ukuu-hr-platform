"use client";

import { useEffect, useRef, useState } from "react";
import { KeyRound, Loader2, CheckCircle2, AlertCircle, LogOut, ShieldCheck, Sparkles } from "lucide-react";

type Props = {
  /** Called once the workspace is unlocked so the parent can re-render the app. */
  onActivated?: () => void;
  /** When true, renders a brief branded loading state instead of the form. */
  checking?: boolean;
};

/**
 * Full-screen subscription gate. Shown when the signed-in user's workspace has
 * no active license — they redeem an access code (issued from the admin portal)
 * to unlock the app.
 */
export default function AccessGate({ onActivated, checking = false }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [done, setDone] = useState(false);
  const [plan, setPlan] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!checking && !done) {
      const t = window.setTimeout(() => inputRef.current?.focus(), 350);
      return () => window.clearTimeout(t);
    }
  }, [checking, done]);

  const signOut = () => {
    try {
      localStorage.removeItem("ukuu_session");
      sessionStorage.removeItem("ukuu_session");
    } catch {
      /* ignore */
    }
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    window.location.assign("/login");
  };

  const redeem = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (redeeming || done || !code.trim()) return;
    setRedeeming(true);
    setError(null);
    try {
      const res = await fetch("/api/license/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; plan?: string } | null;
      if (!res.ok || !data?.ok) {
        setError(data?.error ?? "We couldn't activate your workspace. Please try again.");
        return;
      }
      setPlan(data.plan ?? null);
      setDone(true);
      window.setTimeout(() => onActivated?.(), 1300);
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setRedeeming(false);
    }
  };

  /* ── shared backdrop ── */
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        display: "grid",
        placeItems: "center",
        overflowY: "auto",
        padding: 24,
        background: "radial-gradient(1200px 800px at 15% -10%, rgba(123,47,190,.35), transparent 60%), radial-gradient(1000px 700px at 110% 110%, rgba(167,139,250,.25), transparent 55%), linear-gradient(160deg, #1C0F3E 0%, #2D1B69 45%, #4A1E8F 100%)",
        color: "#fff",
        fontFamily: "var(--font-jakarta), system-ui, sans-serif",
      }}
    >
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: .5, backgroundImage: "radial-gradient(rgba(255,255,255,.06) 1px, transparent 1px)", backgroundSize: "26px 26px" }} />
      <div style={{ position: "relative", width: "100%", maxWidth: 460 }}>
        {/* brand */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 34 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg,#7B2FBE,#A78BFA)", display: "grid", placeItems: "center", boxShadow: "0 8px 24px rgba(123,47,190,.45)" }}>
            <KeyRound size={20} strokeWidth={2} />
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, letterSpacing: ".02em" }}>UKUU HR</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,.6)", fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase" }}>HRMS Platform</div>
          </div>
        </div>

        {checking ? (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <Loader2 size={28} className="spin" style={{ animation: "spin 1s linear infinite", color: "#C4B5FD" }} />
            <div style={{ marginTop: 16, fontSize: 14, color: "rgba(255,255,255,.75)", fontWeight: 600 }}>Checking your subscription…</div>
          </div>
        ) : done ? (
          /* ── success ── */
          <div style={{ textAlign: "center", padding: "28px 0" }}>
            <span style={{ width: 72, height: 72, margin: "0 auto", borderRadius: "50%", background: "rgba(52,211,153,.16)", border: "2px solid rgba(52,211,153,.6)", display: "grid", placeItems: "center" }}>
              <CheckCircle2 size={38} strokeWidth={2} style={{ color: "#34D399" }} />
            </span>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "22px 0 8px", color: "#fff" }}>Workspace activated</h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,.72)", margin: 0, lineHeight: 1.6 }}>
              Your {plan ? <strong style={{ color: "#F0C257" }}>{plan}</strong> : null} subscription is live.
              <br />Taking you into your workspace…
            </p>
          </div>
        ) : (
          /* ── locked: access code form ── */
          <div style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.14)", borderRadius: 22, padding: "34px 30px", backdropFilter: "blur(14px)", boxShadow: "0 24px 70px rgba(10,4,25,.5)" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase", color: "#F0C257", background: "rgba(240,194,87,.12)", border: "1px solid rgba(240,194,87,.28)", padding: "6px 12px", borderRadius: 999 }}>
              <ShieldCheck size={13} /> Subscription required
            </span>
            <h1 style={{ fontSize: 23, fontWeight: 800, margin: "18px 0 8px", color: "#fff", letterSpacing: "-.01em" }}>Activate your workspace</h1>
            <p style={{ fontSize: 13.5, color: "rgba(255,255,255,.72)", margin: 0, lineHeight: 1.65 }}>
              Your workspace is on hold. Enter the <strong style={{ color: "#fff" }}>access code</strong> issued by your account administrator to continue.
            </p>

            {error && (
              <div role="alert" style={{ display: "flex", gap: 9, alignItems: "flex-start", marginTop: 18, padding: "11px 13px", borderRadius: 11, background: "rgba(248,113,113,.12)", border: "1px solid rgba(248,113,113,.35)", color: "#FECACA", fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={redeem} noValidate style={{ marginTop: 20 }}>
              <label htmlFor="access-code" style={{ display: "block", fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.8)", marginBottom: 8, letterSpacing: ".04em" }}>
                ACCESS CODE
              </label>
              <input
                id="access-code"
                ref={inputRef}
                value={code}
                onChange={(ev) => setCode(ev.target.value.toUpperCase())}
                placeholder="XXXX-XXXX-XXXX"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={40}
                aria-invalid={Boolean(error)}
                style={{
                  width: "100%", boxSizing: "border-box", padding: "14px 16px", borderRadius: 12,
                  background: "rgba(13,7,30,.55)", border: error ? "1.5px solid rgba(248,113,113,.7)" : "1.5px solid rgba(255,255,255,.2)",
                  color: "#fff", fontSize: 17, fontWeight: 700, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                  letterSpacing: ".14em", textTransform: "uppercase", outline: "none", transition: "border-color .15s ease",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(167,139,250,.9)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = error ? "rgba(248,113,113,.7)" : "rgba(255,255,255,.2)")}
              />
              <button
                type="submit"
                disabled={redeeming || !code.trim()}
                style={{
                  width: "100%", marginTop: 14, padding: "14px 0", borderRadius: 12, border: "none", cursor: "pointer",
                  background: "linear-gradient(135deg,#7B2FBE,#6A24A8)", color: "#fff", fontSize: 14.5, fontWeight: 800,
                  display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "opacity .15s ease",
                  opacity: redeeming || !code.trim() ? .55 : 1,
                }}
              >
                {redeeming ? (
                  <><Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> Activating…</>
                ) : (
                  <><Sparkles size={17} /> Activate workspace</>
                )}
              </button>
            </form>

            <div style={{ marginTop: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12, color: "rgba(255,255,255,.55)" }}>
              <span>Codes are issued by your account administrator.</span>
              <button type="button" onClick={signOut} style={{ background: "none", border: "none", color: "rgba(255,255,255,.7)", cursor: "pointer", fontSize: 12, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 5, padding: 0 }}>
                <LogOut size={13} /> Sign out
              </button>
            </div>
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 11.5, color: "rgba(255,255,255,.45)", marginTop: 26 }}>
          Ukuu HR · secure, isolated workspace access
        </p>
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}