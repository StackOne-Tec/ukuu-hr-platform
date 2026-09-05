"use client";

import { useEffect, useState } from "react";
import { Building2, Users, Gift, Fingerprint, Plus, Loader2, Trash2, AlertCircle, CheckCircle2, TicketPercent, ChevronDown, ChevronUp, KeyRound, Building, CalendarClock, Tag, FileText, X } from "lucide-react";

type Org = { id: string; name: string; slug: string; plan: string; employees: number; users: number };
type AcctUser = { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string | null; orgName: string };
type Coupon = { id: string; code: string; discountPercent: number; plan: string; status: string; expiresAt: string | null; description: string; createdAt: string | null; redeemedAt: string | null; redeemedByOrgName: string | null };

export type PlatformAccountData = {
  orgs: Org[];
  users: AcctUser[];
  coupons: Coupon[];
  orgCount: number;
  userCount: number;
  activeCouponCount: number;
  couponCount: number;
  deviceCount: number;
};

const PLAN_PILL: Record<string, string> = {
  Trial: "info", Free: "info", Starter: "pending", Professional: "active", Business: "active", Enterprise: "gold",
};
const dateOnly = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" }) : "—";
const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export default function PlatformAccountDashboard({ data }: { data: PlatformAccountData }) {
  return (
    <>
      <div className="bk-admin-section-header" data-tour="page-dashboard">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Platform administration · all workspaces</div>
          <h1 className="bk-admin-h1">Account Overview</h1>
          <p className="bk-admin-sub">Registered users, discount coupons and organizations across the platform.</p>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        {[
          { icon: Building2, tint: "blue", value: String(data.orgCount), label: "Organizations", sub: `${data.orgs.filter((o) => o.users > 0).length} with members` },
          { icon: Users, tint: "green", value: String(data.userCount), label: "Registered Users", sub: `${data.users.filter((u) => u.isActive).length} active accounts` },
          { icon: TicketPercent, tint: "gold", value: String(data.activeCouponCount), label: "Active Access Codes", sub: `${data.couponCount} total issued` },
          { icon: Fingerprint, tint: "pink", value: String(data.deviceCount), label: "Devices", sub: "across all workspaces" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top">
              <div className={`bk-admin-kpi-icon ${k.tint}`}><k.icon size={22} strokeWidth={1.9} /></div>
            </div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
            <div className="bk-admin-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* registered users */}
      <div className="bk-admin-card" data-tour="admin-users">
        <div className="bk-admin-card-header">
          <div>
            <h3>Registered Users</h3>
            <p>{data.userCount} account(s) across {data.orgCount} workspace(s)</p>
          </div>
        </div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>User</th><th>Email</th><th>Workspace</th><th>Role</th><th>Status</th><th>Last Login</th></tr>
          </thead>
          <tbody>
            {data.users.length === 0 && (
              <tr><td colSpan={6} className="bk-admin-empty">No registered users yet.</td></tr>
            )}
            {data.users.map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>{u.name}</td>
                <td className="bk-mono" style={{ color: "var(--bk-ink-2)" }}>{u.email}</td>
                <td>{u.orgName}</td>
                <td><span className="bk-admin-pill info" style={{ textTransform: "none" }}>{u.role}</span></td>
                <td>
                  <span className={`bk-admin-pill ${u.isActive ? "active" : "inactive"}`} style={{ textTransform: "none" }}>
                    {u.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="bk-muted-text">{dateTime(u.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bk-admin-grid-2-even">
        <CouponsPanel coupons={data.coupons} />
        <OrganizationsPanel orgs={data.orgs} />
      </div>
    </>
  );
}

/* ───────────────────────── coupons ───────────────────────── */

export function CouponsPanel({ coupons }: { coupons: Coupon[] }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [plan, setPlan] = useState("");
  const [expires, setExpires] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /* close the modal on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (saving) return;
    setBanner(null);
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Enter an access code.";
    const d = Number(discount);
    if (discount === "" || !Number.isInteger(d) || d < 0 || d > 100) e.discount = "Discount must be 0–100.";
    if (expires && Number.isNaN(new Date(expires).getTime())) e.expires = "Enter a valid date.";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSaving(true);
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discountPercent: d,
          plan: plan.trim() || undefined,
          expiresAt: expires || undefined,
          description: description.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Unable to create the access code.");
      setBanner({ kind: "success", text: `Access code ${code.trim().toUpperCase()} created.` });
      setCode(""); setDiscount(""); setPlan(""); setExpires(""); setDescription("");
      setOpen(false);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      setBanner({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch("/api/admin/coupons", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) window.location.reload();
  };

  return (
    <div className="bk-admin-card">
      <div className="bk-admin-card-header">
        <div>
          <h3>Access Codes</h3>
          <p>{coupons.length} access code(s) · {coupons.filter((c) => c.status === "Active" && !c.redeemedAt).length} available — single-use codes that unlock one workspace each.</p>
        </div>
        <button type="button" className="bk-btn bk-btn-primary" data-tour="access-codes-new" onClick={() => setOpen(true)}>
          <Plus size={15} /> New Access Code
        </button>
      </div>

      {banner && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 20px 12px", padding: "10px 12px", borderRadius: 8, fontSize: 13, background: banner.kind === "success" ? "rgba(20,163,127,.08)" : "rgba(220,38,38,.06)", color: banner.kind === "success" ? "#0e8a68" : "#DC2626" }}>
          {banner.kind === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{banner.text}</span>
        </div>
      )}

      {/* New Access Code modal */}
      {open && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, display: "grid", placeItems: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(16,9,31,.55)", backdropFilter: "blur(4px)" }} />
          <div className="bk-admin-card" role="dialog" aria-modal="true" aria-label="New access code" style={{ position: "relative", width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", boxShadow: "0 32px 80px rgba(15,5,30,.4)" }}>
            <div className="bk-admin-card-header">
              <div>
                <h3>New Access Code</h3>
                <p>Create a single-use code to unlock a workspace subscription.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" title="Close" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--bk-line)", background: "transparent", color: "var(--bk-ink-3)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <X size={17} />
              </button>
            </div>
            <form onSubmit={submit} noValidate className="bk-admin-card-content" style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  Access code
                  <input autoFocus placeholder="UKUU-PRO-2026" value={code} onChange={(ev) => setCode(ev.target.value)} aria-invalid={Boolean(errors.code)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
                  {errors.code && <span style={{ color: "#DC2626", fontWeight: 500 }}>{errors.code}</span>}
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  Discount %
                  <input inputMode="numeric" placeholder="20" value={discount} onChange={(ev) => setDiscount(ev.target.value)} aria-invalid={Boolean(errors.discount)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
                  {errors.discount && <span style={{ color: "#DC2626", fontWeight: 500 }}>{errors.discount}</span>}
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  Plan (optional)
                  <input placeholder="Enterprise" value={plan} onChange={(ev) => setPlan(ev.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
                </label>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  Expires (optional)
                  <input type="date" value={expires} onChange={(ev) => setExpires(ev.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
                  {errors.expires && <span style={{ color: "#DC2626", fontWeight: 500 }}>{errors.expires}</span>}
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
                  Description (optional)
                  <input placeholder="e.g. Founder access code — Professional plan" value={description} onChange={(ev) => setDescription(ev.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
                </label>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--bk-ink-3)", lineHeight: 1.5 }}>
                Single-use: the first workspace that redeems this code gets the subscription — it can&rsquo;t be used again.
              </p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
                <button type="button" className="bk-btn bk-btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="bk-btn bk-btn-primary" disabled={saving}>
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />}
                  {saving ? "Creating…" : "Create Access Code"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div data-tour="access-codes-list">
        {coupons.length === 0 && <div className="bk-admin-empty">No access codes yet — create the first one to unlock a workspace.</div>}
        {coupons.map((c) => {
          const expanded = expandedId === c.id;
          const detail = (label: string, value: string) => (
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, padding: "7px 0", borderBottom: "1px solid var(--bk-line)", fontSize: 13 }}>
              <span style={{ width: 150, flexShrink: 0, color: "var(--bk-ink-3)", fontWeight: 600, fontSize: 12 }}>{label}</span>
              <span style={{ fontWeight: 600, color: "var(--bk-ink)" }}>{value}</span>
            </div>
          );
          return (
            <div key={c.id} style={{ borderBottom: "1px solid var(--bk-line)" }}>
              {/* summary row — click to expand usage detail */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => setExpandedId(expanded ? null : c.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpandedId(expanded ? null : c.id); } }}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", cursor: "pointer", background: expanded ? "var(--bk-muted)" : "transparent", transition: "background .15s ease" }}
                title="View usage detail"
              >
                <span className="bk-mono" style={{ fontWeight: 700, fontSize: 13 }}>{c.code}</span>
                <span className="bk-admin-pill pending" style={{ textTransform: "none" }}>{c.discountPercent}% off</span>
                {c.plan !== "All plans" && <span className="bk-muted-text">{c.plan}</span>}
                <span style={{ flex: 1 }} />
                <span className="bk-muted-text">{dateOnly(c.expiresAt)}</span>
                {c.redeemedAt ? (
                  <>
                    <span className="bk-admin-pill inactive" style={{ textTransform: "none" }}>Used</span>
                    <span className="bk-muted-text" style={{ fontSize: 12 }}>{c.redeemedByOrgName ?? "Unknown workspace"}</span>
                  </>
                ) : (
                  <span className={`bk-admin-pill ${c.status === "Active" ? "active" : "inactive"}`} style={{ textTransform: "none" }}>
                    {c.status === "Active" ? "Available" : "Disabled"}
                  </span>
                )}
                <span style={{ color: "var(--bk-ink-3)", display: "grid", placeItems: "center" }}>
                  {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </div>

              {/* usage detail */}
              {expanded && (
                <div style={{ padding: "6px 20px 16px", background: "var(--bk-muted)", borderTop: "1px solid var(--bk-line)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0 6px", fontSize: 12, fontWeight: 800, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--bk-ink-3)" }}>
                    {c.redeemedAt ? <KeyRound size={13} /> : <Tag size={13} />}
                    {c.redeemedAt ? "Redemption" : "Code details"}
                  </div>
                  {c.redeemedAt ? (
                    <>
                      {detail("Redeemed by", c.redeemedByOrgName ?? "Unknown workspace")}
                      {detail("Redeemed at", dateTime(c.redeemedAt))}
                      {detail("Plan granted", c.plan === "All plans" ? "—" : c.plan)}
                    </>
                  ) : (
                    <>
                      {detail("Status", c.status)}
                      {detail("Plan", c.plan === "All plans" ? "Any" : c.plan)}
                    </>
                  )}
                  {detail("Discount", `${c.discountPercent}%`)}
                  {detail("Created", dateTime(c.createdAt))}
                  {detail("Expires", c.expiresAt ? dateOnly(c.expiresAt) : "Never")}
                  {c.description && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "7px 0", fontSize: 13 }}>
                      <span style={{ width: 150, flexShrink: 0, color: "var(--bk-ink-3)", fontWeight: 600, fontSize: 12 }}>Description</span>
                      <span style={{ fontWeight: 600, color: "var(--bk-ink)" }}>{c.description}</span>
                    </div>
                  )}
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap", opacity: .85 }}>
                    <span className="bk-muted-text" style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}><Building size={12} /> Single-use code</span>
                    <span className="bk-muted-text" style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}><CalendarClock size={12} /> {c.redeemedAt ? "Already claimed" : "Unclaimed"}</span>
                    {c.description && <span className="bk-muted-text" style={{ fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5 }}><FileText size={12} /> {c.description.length > 40 ? c.description.slice(0, 40) + "…" : c.description}</span>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ───────────────────────── organizations ───────────────────────── */

function OrganizationsPanel({ orgs }: { orgs: Org[] }) {
  return (
    <div className="bk-admin-card" data-tour="admin-orgs">
      <div className="bk-admin-card-header">
        <div>
          <h3>Organizations</h3>
          <p>{orgs.length} registered workspace(s)</p>
        </div>
      </div>
      <table className="bk-admin-table">
        <thead>
          <tr><th>Organization</th><th>Plan</th><th>Employees</th><th>Users</th></tr>
        </thead>
        <tbody>
          {orgs.length === 0 && <tr><td colSpan={4} className="bk-admin-empty">No organizations yet.</td></tr>}
          {orgs.map((o) => (
            <tr key={o.id}>
              <td style={{ fontWeight: 600 }}>{o.name}</td>
              <td><span className={`bk-admin-pill ${PLAN_PILL[o.plan] ?? "info"}`} style={{ textTransform: "none" }}>{o.plan}</span></td>
              <td className="bk-mono">{o.employees}</td>
              <td className="bk-mono">{o.users}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
