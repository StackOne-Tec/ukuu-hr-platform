"use client";

import { useState } from "react";
import { Building2, Users, Gift, Fingerprint, Plus, Loader2, Trash2, AlertCircle, CheckCircle2, TicketPercent } from "lucide-react";

type Org = { id: string; name: string; slug: string; plan: string; employees: number; users: number };
type AcctUser = { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null; createdAt: string | null; orgName: string };
type Coupon = { id: string; code: string; discountPercent: number; plan: string; status: string; expiresAt: string | null; description: string; createdAt: string | null };

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
      <div className="bk-admin-section-header">
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
          { icon: TicketPercent, tint: "gold", value: String(data.activeCouponCount), label: "Active Coupons", sub: `${data.couponCount} total issued` },
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
      <div className="bk-admin-card">
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

function CouponsPanel({ coupons }: { coupons: Coupon[] }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState("");
  const [plan, setPlan] = useState("");
  const [expires, setExpires] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (saving) return;
    setBanner(null);
    const e: Record<string, string> = {};
    if (!code.trim()) e.code = "Enter a coupon code.";
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
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? "Unable to create the coupon.");
      setBanner({ kind: "success", text: `Coupon ${code.trim().toUpperCase()} created.` });
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
          <h3>Coupons</h3>
          <p>{coupons.length} coupon(s) · {coupons.filter((c) => c.status === "Active").length} active</p>
        </div>
        <button type="button" className="bk-btn bk-btn-primary" onClick={() => setOpen((o) => !o)}>
          {open ? null : <Plus size={15} />} {open ? "Close" : "New Coupon"}
        </button>
      </div>

      {banner && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 20px 12px", padding: "10px 12px", borderRadius: 8, fontSize: 13, background: banner.kind === "success" ? "rgba(20,163,127,.08)" : "rgba(220,38,38,.06)", color: banner.kind === "success" ? "#0e8a68" : "#DC2626" }}>
          {banner.kind === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          <span>{banner.text}</span>
        </div>
      )}

      {open && (
        <form onSubmit={submit} noValidate style={{ margin: "0 20px 16px", padding: 16, background: "var(--bk-muted)", borderRadius: 12, display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, fontWeight: 600 }}>
              Code
              <input placeholder="LAUNCH20" value={code} onChange={(ev) => setCode(ev.target.value)} aria-invalid={Boolean(errors.code)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
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
              <input placeholder="e.g. Founder promo — 20% off annual" value={description} onChange={(ev) => setDescription(ev.target.value)} style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--bk-line)", fontSize: 13 }} />
            </label>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button type="submit" className="bk-btn bk-btn-primary" disabled={saving}>
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Gift size={15} />}
              {saving ? "Creating…" : "Create Coupon"}
            </button>
          </div>
        </form>
      )}

      <div>
        {coupons.length === 0 && <div className="bk-admin-empty">No coupons yet — create the first one to offer a discount.</div>}
        {coupons.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderBottom: "1px solid var(--bk-line)" }}>
            <span className="bk-mono" style={{ fontWeight: 700, fontSize: 13 }}>{c.code}</span>
            <span className="bk-admin-pill pending" style={{ textTransform: "none" }}>{c.discountPercent}% off</span>
            {c.plan !== "All plans" && <span className="bk-muted-text">{c.plan}</span>}
            <span style={{ flex: 1 }} />
            <span className="bk-muted-text">{dateOnly(c.expiresAt)}</span>
            <span className={`bk-admin-pill ${c.status === "Active" ? "active" : "inactive"}`} style={{ textTransform: "none" }}>{c.status}</span>
            <button type="button" onClick={() => void remove(c.id)} title="Delete coupon" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--bk-ink-3)" }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── organizations ───────────────────────── */

function OrganizationsPanel({ orgs }: { orgs: Org[] }) {
  return (
    <div className="bk-admin-card">
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
