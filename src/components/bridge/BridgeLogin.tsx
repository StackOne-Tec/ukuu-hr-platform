"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Badge,
  BadgeCheck,
  Building,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
 * The desktop app's authentication window: macOS chrome, daemon status
 * bars and the bridge sign-in card. Submits to POST /api/v1/bridge/login
 * (the cloud sign-in flow the native Bridge client uses) and stores the
 * returned session token before handing off to the workspace.
 */
export default function BridgeLogin() {
  const router = useRouter();
  const { toast } = useToast();

  const [organization] = useState("ukuuhr-demo.ukuuhr.com");
  const [email, setEmail] = useState("admin@ukuuhr.demo");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(true);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<Banner>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (loading || done) return;
      setBanner(null);

      const e: Record<string, string> = {};
      if (!EMAIL_RE.test(email.trim())) {
        e.email = "Enter a valid administrator email address.";
      }
      if (!password) {
        e.password = "Enter your bridge security key.";
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
          text: `Daemon authenticated${data.account?.name ? ` — welcome, ${data.account.name}` : ""}! Opening workspace…`,
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
            ? "Enterprise SSO (Okta / Azure AD / SAML) needs an IdP setup in this demo — use your bridge credentials."
            : "WebAuthn / YubiKey enrollment is handled by your cloud administrator in this demo.",
      });
    },
    [toast]
  );

  const onForgot = useCallback(() => {
    toast({
      title: "Bridge key recovery",
      description:
        "Security-key resets are issued by your cloud administrator — contact your workspace admin.",
    });
  }, [toast]);

  const inputCls =
    "w-full bg-transparent py-2 pl-10 pr-3 font-br-sans text-br-body-md text-br-on-surface placeholder:text-br-outline focus:outline-none";
  const fieldShell =
    "relative flex items-center rounded-sm bg-br-surface-container-lowest shadow-inner transition-colors focus-within:bg-br-surface-container-low";

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

      {/* ── auth stage ── */}
      <main className="flex flex-1 items-center justify-center bg-br-surface-container-lowest p-5">
        <div className="relative flex w-full flex-col items-center justify-center py-8">
          {/* ambient atmospheric glows */}
          <div className="pointer-events-none absolute -left-20 -top-12 h-96 w-96 rounded-full bg-br-primary-container/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -right-20 h-[32rem] w-[32rem] rounded-full bg-br-secondary-container/15 blur-[100px]" />

          {/* main login card panel */}
          <div className="relative flex w-full max-w-lg flex-col gap-5 rounded-lg bg-br-surface/90 p-8 shadow-2xl backdrop-blur-2xl">
            {/* gateway connectivity pill */}
            <div className="flex items-center justify-between rounded-full bg-br-surface-container-low px-3 py-1 shadow-inner">
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

            {/* brand & identity matrix */}
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="relative flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-br-primary-container to-br-secondary-container shadow-xl shadow-br-primary-container/20">
                <Fingerprint size={32} className="text-br-on-primary" />
                <div className="absolute -bottom-1 -right-1 rounded bg-br-surface-container-lowest p-0.5">
                  <RefreshCw size={12} className="text-br-tertiary" />
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span className="font-br-sans text-br-headline-md tracking-tight text-br-on-surface">
                  UKUU HR
                </span>
                <span className="rounded bg-br-primary/10 px-1 py-0.5 font-br-mono text-br-code-mono-sm uppercase text-br-primary">
                  PRO V3.4
                </span>
              </div>
              <p className="font-br-sans text-br-label-caps uppercase tracking-wider text-br-tertiary">
                Enterprise Access Sync Bridge
              </p>
            </div>

            {/* heading block */}
            <div className="flex flex-col gap-0.5 text-center">
              <h1 className="font-br-sans text-br-headline-sm text-br-on-surface">
                Bridge Gateway Login
              </h1>
              <p className="mx-auto max-w-sm font-br-sans text-br-body-sm text-br-on-surface-variant">
                Authenticate local daemon session with your organization cloud credentials.
              </p>
            </div>

            {banner && (
              <div
                role="status"
                aria-live="polite"
                className={`flex items-start gap-2 rounded-sm px-3 py-2 font-br-sans text-br-body-sm ${
                  banner.kind === "error"
                    ? "border border-br-error/30 bg-br-error-container/20 text-br-error"
                    : "border border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]"
                }`}
              >
                {banner.kind === "error" ? (
                  <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
                ) : (
                  <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
                )}
                <span>{banner.text}</span>
              </div>
            )}

            {/* credentials form */}
            <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
              {/* organization field */}
              <div className="flex flex-col gap-0.5">
                <label
                  htmlFor="br-org"
                  className="flex items-center justify-between font-br-sans text-br-label-caps uppercase text-br-on-surface-variant"
                >
                  <span>Organization Workspace</span>
                  <span className="font-br-mono text-br-code-mono-sm normal-case tracking-normal text-br-tertiary">
                    Node #084-SEC
                  </span>
                </label>
                <div className={fieldShell}>
                  <Building2 size={14} className="pointer-events-none absolute left-3 text-br-on-surface-variant" />
                  <input
                    id="br-org"
                    className={inputCls}
                    type="text"
                    spellCheck={false}
                    value={organization}
                    readOnly
                    aria-label="Organization workspace"
                  />
                  <span className="pr-3 font-br-mono text-br-code-mono-sm uppercase text-br-primary">
                    Active
                  </span>
                </div>
              </div>

              {/* admin email field */}
              <div className="flex flex-col gap-0.5">
                <label
                  htmlFor="br-email"
                  className="font-br-sans text-br-label-caps uppercase text-br-on-surface-variant"
                >
                  Administrator Identity
                </label>
                <div className={fieldShell}>
                  <Badge size={14} className="pointer-events-none absolute left-3 text-br-on-surface-variant" />
                  <input
                    id="br-email"
                    className={`${inputCls} pr-10`}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="admin@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    aria-invalid={Boolean(errors.email)}
                    aria-describedby={errors.email ? "br-email-err" : undefined}
                  />
                  <div className="absolute right-3 flex items-center text-br-primary" title="Identity Verified">
                    <BadgeCheck size={14} />
                  </div>
                </div>
                {errors.email && (
                  <p className="mt-1 flex items-center gap-1 font-br-sans text-br-body-sm text-br-error" id="br-email-err" role="alert">
                    <AlertCircle size={12.5} />
                    {errors.email}
                  </p>
                )}
              </div>

              {/* bridge password field */}
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="br-password"
                    className="font-br-sans text-br-label-caps uppercase text-br-on-surface-variant"
                  >
                    Bridge Security Key / Password
                  </label>
                  <button
                    type="button"
                    className="font-br-mono text-br-code-mono-sm text-br-tertiary hover:underline"
                    onClick={onForgot}
                  >
                    Forgot Bridge Key?
                  </button>
                </div>
                <div className={fieldShell}>
                  <Lock size={14} className="pointer-events-none absolute left-3 text-br-on-surface-variant" />
                  <input
                    id="br-password"
                    className={`${inputCls} pr-10`}
                    type={showPw ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter security key"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={Boolean(errors.password)}
                    aria-describedby={errors.password ? "br-password-err" : undefined}
                  />
                  <button
                    type="button"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    title={showPw ? "Hide password" : "Show password"}
                    className="absolute right-3 flex items-center text-br-on-surface-variant transition-colors hover:text-br-on-surface"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 flex items-center gap-1 font-br-sans text-br-body-sm text-br-error" id="br-password-err" role="alert">
                    <AlertCircle size={12.5} />
                    {errors.password}
                  </p>
                )}
              </div>

              {/* remember daemon & session retention */}
              <div className="flex items-center justify-between py-0.5">
                <label className="flex cursor-pointer select-none items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="peer sr-only"
                    />
                    <div className="flex h-4 w-4 items-center justify-center rounded bg-br-surface-container-lowest shadow-inner transition-colors peer-checked:bg-br-primary">
                      <Check
                        size={12}
                        strokeWidth={3.5}
                        className="text-br-on-primary opacity-0 transition-opacity peer-checked:opacity-100"
                      />
                    </div>
                  </div>
                  <span className="font-br-sans text-br-body-sm text-br-on-surface">Remember Daemon Token</span>
                </label>
                <div className="flex items-center gap-0.5 text-br-on-surface-variant">
                  <Clock3 size={14} />
                  <span className="font-br-mono text-br-code-mono-sm">Session: 30 Days</span>
                </div>
              </div>

              {/* primary action */}
              <button
                type="submit"
                disabled={loading || done}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-sm bg-gradient-to-r from-br-primary-container via-br-primary-container to-br-secondary-container px-5 py-2 font-br-sans text-br-headline-sm text-br-on-primary shadow-lg shadow-br-primary-container/25 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-75 disabled:hover:brightness-100"
              >
                {loading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  <>
                    <span>Sign In to Bridge Daemon</span>
                    <ArrowRight size={20} />
                  </>
                )}
                {loading && <span>Authenticating…</span>}
              </button>
            </form>

            {/* visual separator */}
            <div className="relative flex items-center justify-center">
              <div className="h-px w-full bg-br-surface-variant" />
              <span className="absolute bg-br-surface px-4 font-br-sans text-br-label-caps uppercase tracking-wider text-br-outline">
                or secure sign-in with
              </span>
            </div>

            {/* SSO & hardware key matrix */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={loading || done}
                className="group flex flex-col items-start rounded-sm bg-br-surface-container-low p-3 text-left shadow-sm transition-all hover:bg-br-surface-container disabled:opacity-70"
                onClick={() => onSso("sso")}
              >
                <div className="mb-0.5 flex w-full items-center justify-between">
                  <Building size={22} className="text-br-secondary transition-colors group-hover:text-br-primary" />
                  <ArrowUpRight size={12} className="text-br-on-surface-variant transition-transform group-hover:translate-x-0.5" />
                </div>
                <span className="font-br-sans text-br-headline-sm text-br-on-surface transition-colors group-hover:text-br-primary">
                  Cloud SSO
                </span>
                <span className="mt-0.5 font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                  Okta / Azure AD / SAML
                </span>
              </button>

              <button
                type="button"
                disabled={loading || done}
                className="group flex flex-col items-start rounded-sm bg-br-surface-container-low p-3 text-left shadow-sm transition-all hover:bg-br-surface-container disabled:opacity-70"
                onClick={() => onSso("fido2")}
              >
                <div className="mb-0.5 flex w-full items-center justify-between">
                  <KeyRound size={22} className="text-br-tertiary transition-colors group-hover:text-br-primary" />
                  <ArrowUpRight size={12} className="text-br-on-surface-variant transition-transform group-hover:translate-x-0.5" />
                </div>
                <span className="font-br-sans text-br-headline-sm text-br-on-surface transition-colors group-hover:text-br-primary">
                  FIDO2 / Key
                </span>
                <span className="mt-0.5 font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                  WebAuthn / YubiKey
                </span>
              </button>
            </div>

            {/* security & compliance micro-footnote */}
            <div className="flex items-center justify-center gap-1 pt-1 text-center text-br-on-surface-variant">
              <ShieldCheck size={12} className="text-br-primary" />
              <span className="font-br-mono text-br-code-mono-sm">
                End-to-end encrypted with TLS 1.3 • Local audit log enabled
              </span>
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