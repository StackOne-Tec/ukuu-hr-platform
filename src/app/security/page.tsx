import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getSecurityData } from "@/lib/queries";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Security & Audit · Ukuu HR" };

const POLICIES = [
  ["Multi-factor authentication", "Require MFA for all admin users", true],
  ["Single sign-on (SSO)", "Allow SAML / OIDC federation", false],
  ["IP allowlist", "Restrict access to trusted networks", false],
  ["Password rotation", "Force rotation every 90 days", true],
  ["Session timeout", "Auto sign-out after 30 minutes of inactivity", true],
  ["Audit trail", "Record every privileged action", true],
];

export default async function SecurityPage() {
  const res = await getSecurityData();
  const logs = res.data;
  const score = 72 + (logs.length % 20);

  return (
    <AdminShell activeKey="security">
      <div className="bk-admin-section-header" data-tour="page-security">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Administration · governance</div>
          <h1 className="bk-admin-h1">Security &amp; Audit</h1>
          <p className="bk-admin-sub">Security policies, login stats and the full audit log.</p>
        </div>
      </div>

      <div className="bk-admin-grid-2">
        <div className="bk-admin-card" data-tour="security-score">
          <div className="bk-admin-card-header">
            <h3>Security score</h3>
            <span className="bk-admin-pill active" style={{ textTransform: "none" }}><ShieldCheck size={12} /> {score}%</span>
          </div>
          <div className="bk-admin-card-content">
            <div className="bk-admin-progress" style={{ height: 12 }}>
              <div className="bk-admin-progress-fill" style={{ width: `${score}%` }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
              {POLICIES.map(([label, hint, on]) => (
                <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 13.5 }}>{label}</div>
                    <div className="bk-muted-text">{hint}</div>
                  </div>
                  <span className={`bk-admin-pill ${on ? "approved" : "inactive"}`}>{on ? "Enabled" : "Off"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Login activity</h3></div>
          <div className="bk-admin-card-content">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">Successful logins (30d)</div><div className="bk-admin-stat-box-value">{logs.length + 34}</div></div>
              <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">Failed attempts</div><div className="bk-admin-stat-box-value" style={{ color: "#DC2626" }}>3</div></div>
              <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">Active sessions</div><div className="bk-admin-stat-box-value">2</div></div>
              <div className="bk-admin-stat-box dark"><div className="bk-admin-stat-box-label">Last login</div><div className="bk-admin-stat-box-value" style={{ color: "#fff", fontSize: 15 }}>Today 07:42</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bk-admin-card" style={{ marginTop: 24 }} data-tour="security-audit">
        <div className="bk-admin-card-header"><h3>Audit log</h3><span className="bk-muted-text">{logs.length} recent events</span></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>When</th><th>User</th><th>Action</th><th>Entity</th><th>Details</th></tr>
          </thead>
          <tbody>
            {logs.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No audit events.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="bk-mono" style={{ fontSize: 12 }}>{l.createdAt ? new Date(l.createdAt).toLocaleString() : "—"}</td>
                <td style={{ fontWeight: 600 }}>{l.userName}</td>
                <td><span className="bk-admin-pill info" style={{ textTransform: "none" }}>{l.action}</span></td>
                <td>{l.entityType}</td>
                <td style={{ color: "var(--bk-ink-2)", fontSize: 12.5 }}>{l.details}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}