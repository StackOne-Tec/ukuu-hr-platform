import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getBillingData } from "@/lib/queries";
import { CreditCard, Check, Sparkles } from "lucide-react";

export const metadata: Metadata = { title: "Billing · Ukuu HR" };

const PLANS = [
  { name: "Starter", price: "$29", seats: 10, features: ["Up to 10 employees", "Attendance tracking", "Email support"] },
  { name: "Professional", price: "$79", seats: 100, features: ["Up to 100 employees", "Full payroll (ZRA 2025)", "Device integrations", "Priority support"], highlight: true },
  { name: "Enterprise", price: "Custom", seats: "Unlimited", features: ["Unlimited employees", "SSO & audit", "Dedicated manager", "On-prem option"] },
];

export default async function BillingPage() {
  const res = await getBillingData();
  const b = res.data;

  return (
    <AdminShell activeKey="billing">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Account · subscription</div>
          <h1 className="bk-admin-h1">Billing</h1>
          <p className="bk-admin-sub">License, usage and plan comparison.</p>
        </div>
      </div>

      {/* license hero */}
      <div style={{
        borderRadius: 20, padding: 36, marginBottom: 32, position: "relative", overflow: "hidden",
        background: "linear-gradient(135deg,#2D1B69 0%,#7B2FBE 55%,#A78BFA 130%)", color: "#fff",
      }}>
        <div style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", right: -120, top: -160, background: "radial-gradient(circle, rgba(240,194,87,.4), transparent 70%)" }} />
        <div style={{ position: "relative" }}>
          <span className="bk-admin-pill" style={{ background: "rgba(240,194,87,.2)", color: "#F0C257", textTransform: "none" }}>
            <Sparkles size={12} /> {b.plan} plan
          </span>
          <h2 style={{ fontSize: 26, fontWeight: 800, margin: "16px 0 6px", color: "#fff" }}>UkuuHR Demo Ltd</h2>
          <p style={{ color: "rgba(255,255,255,.75)", fontSize: 14, margin: 0 }}>
            License <span className="bk-mono">{b.licenseCode}</span> · {b.users} user(s) · {b.employees} employee(s) · expires {b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : "—"}
          </p>
          <button type="button" className="bk-btn" style={{ marginTop: 22, background: "#F0C257", color: "#25163F", fontWeight: 800 }}>
            <CreditCard size={16} /> Manage Subscription
          </button>
        </div>
      </div>

      {/* plan comparison */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        {PLANS.map((p) => (
          <div key={p.name} className="bk-admin-card" style={p.highlight ? { border: "2px solid #7B2FBE", position: "relative" } : undefined}>
            {p.highlight && (
              <span style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "linear-gradient(135deg,#7B2FBE,#6A24A8)", color: "#fff", fontSize: 10.5, fontWeight: 800, letterSpacing: ".08em", padding: "4px 12px", borderRadius: 999, textTransform: "uppercase" }}>
                Current plan
              </span>
            )}
            <div className="bk-admin-card-content">
              <div style={{ fontWeight: 800, fontSize: 15 }}>{p.name}</div>
              <div style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 2px" }}>{p.price}<span style={{ fontSize: 13, color: "var(--bk-ink-3)", fontWeight: 600 }}>/mo</span></div>
              <div className="bk-muted-text">{p.seats} seats</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "18px 0" }}>
                {p.features.map((f) => (
                  <span key={f} style={{ fontSize: 12.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
                    <Check size={14} style={{ color: "var(--bk-accent-3)" }} /> {f}
                  </span>
                ))}
              </div>
              <button type="button" className={`bk-btn ${p.highlight ? "bk-btn-primary" : "bk-btn-secondary"}`} style={{ width: "100%" }}>
                {p.highlight ? "Active" : `Upgrade to ${p.name}`}
              </button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}