"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Building2, MapPin, CalendarDays, Bell, Users, KeyRound, Save } from "lucide-react";

type SettingsData = {
  org: { id: string; name: string; email: string; country: string; currency: string; plan: string } | null;
  branches: { id: string; name: string; city: string; address: string; isHeadOffice: boolean }[];
  users: { id: string; name: string; email: string; role: string; isActive: boolean; lastLoginAt: string | null }[];
  leaveTypes: { id: string; name: string; daysPerYear: number; color: string }[];
  notifications: { id: string; title: string; message: string; read: boolean; createdAt: string | null }[];
  license: { code: string; plan: string; status: string; expiresAt: string | null } | null;
  employeeCount: number;
  departments: { id: string; name: string }[];
};

const TABS = [
  ["org", "Organization", Building2],
  ["branches", "Branches", MapPin],
  ["leave-types", "Leave Types", CalendarDays],
  ["notifications", "Notifications", Bell],
  ["users", "User Management", Users],
  ["api-keys", "API Keys", KeyRound],
] as const;

export default function SettingsView({ data }: { data: SettingsData }) {
  const [tab, setTab] = useState("org");
  const [saved, setSaved] = useState(false);

  return (
    <AdminShell activeKey="settings">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Administration · configuration</div>
          <h1 className="bk-admin-h1">Settings</h1>
          <p className="bk-admin-sub">Profile, organization, payroll config, notifications and users.</p>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--bk-line)", marginBottom: 20, flexWrap: "wrap" }}>
        {TABS.map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            padding: "10px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6,
            color: tab === key ? "var(--bk-accent)" : "var(--bk-ink-3)",
            borderBottom: tab === key ? "2px solid var(--bk-accent)" : "2px solid transparent", marginBottom: -1,
          }}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {tab === "org" && (
        <div className="bk-admin-card" style={{ maxWidth: 640 }}>
          <div className="bk-admin-card-header"><h3>Organization</h3><span className="bk-admin-pill active">{data.org?.plan ?? "Trial"}</span></div>
          <div className="bk-admin-card-content">
            <div className="bk-field"><label className="bk-label">Organization name</label><input className="bk-input" defaultValue={data.org?.name ?? ""} /></div>
            <div className="bk-field"><label className="bk-label">Contact email</label><input className="bk-input" defaultValue={data.org?.email ?? ""} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
              <div className="bk-field"><label className="bk-label">Country</label><input className="bk-input" defaultValue={data.org?.country ?? "Zambia"} /></div>
              <div className="bk-field"><label className="bk-label">Currency</label><input className="bk-input" defaultValue={data.org?.currency ?? "ZMW"} /></div>
            </div>
            <div className="bk-admin-stat-box" style={{ marginBottom: 18 }}>
              <div className="bk-admin-stat-box-label">Workforce</div>
              <div className="bk-admin-stat-box-value">{data.employeeCount} employees · {data.departments.length} departments</div>
            </div>
            <button type="button" className="bk-btn bk-btn-primary" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>
              <Save size={16} /> {saved ? "Saved ✓" : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {tab === "branches" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Branches &amp; locations</h3></div>
          <table className="bk-admin-table">
            <thead><tr><th>Branch</th><th>City</th><th>Address</th><th>Type</th></tr></thead>
            <tbody>
              {data.branches.length === 0 && <tr><td colSpan={4} className="bk-admin-empty">No branches yet.</td></tr>}
              {data.branches.map((b) => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600 }}>{b.name}</td>
                  <td>{b.city}</td>
                  <td>{b.address}</td>
                  <td><span className={`bk-admin-pill ${b.isHeadOffice ? "approved" : "info"}`}>{b.isHeadOffice ? "Head Office" : "Branch"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "leave-types" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Leave types</h3></div>
          <table className="bk-admin-table">
            <thead><tr><th>Type</th><th>Days / year</th><th>Color</th></tr></thead>
            <tbody>
              {data.leaveTypes.map((t) => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 600 }}>{t.name}</td>
                  <td className="bk-mono">{t.daysPerYear}d</td>
                  <td><span className="bk-dot" style={{ background: t.color, width: 14, height: 14 }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "notifications" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Notification feed</h3></div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {data.notifications.length === 0 && <div className="bk-admin-empty">No notifications.</div>}
            {data.notifications.map((n) => (
              <div key={n.id} style={{ display: "flex", gap: 12, padding: "16px 24px", borderBottom: "1px solid var(--bk-line)", alignItems: "flex-start" }}>
                <span className="bk-dot" style={{ background: n.read ? "var(--bk-ink-3)" : "#7B2FBE", marginTop: 5 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</div>
                  <div style={{ fontSize: 12.5, color: "var(--bk-ink-2)", marginTop: 2 }}>{n.message}</div>
                </div>
                <span className="bk-muted-text">{n.createdAt ? new Date(n.createdAt).toLocaleDateString() : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>User accounts</h3></div>
          <table className="bk-admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th></tr></thead>
            <tbody>
              {data.users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}</td>
                  <td>{u.email}</td>
                  <td><span className="bk-admin-pill info" style={{ textTransform: "none" }}>{u.role}</span></td>
                  <td>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "Never"}</td>
                  <td><span className={`bk-admin-pill ${u.isActive ? "approved" : "inactive"}`}>{u.isActive ? "Active" : "Disabled"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "api-keys" && (
        <div className="bk-admin-card" style={{ maxWidth: 640 }}>
          <div className="bk-admin-card-header"><h3>API keys</h3></div>
          <div className="bk-admin-card-content">
            <div className="bk-field">
              <label className="bk-label">Scoped API key</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="bk-input bk-mono" readOnly value="ukuu_live_••••••••••••••••••••••••" style={{ flex: 1 }} />
                <button type="button" className="bk-btn bk-btn-secondary">Regenerate</button>
              </div>
              <div className="bk-muted-text" style={{ marginTop: 8 }}>
                Scopes: Read/Write Employees · Attendance · Payroll · LeaveManagement · DeviceManagement · FullAccess
              </div>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  );
}