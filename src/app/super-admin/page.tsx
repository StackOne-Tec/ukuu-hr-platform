import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getSuperAdminData } from "@/lib/queries";
import { ShieldUser, Building2, Users, Fingerprint, Banknote } from "lucide-react";

export const metadata: Metadata = { title: "Platform Admin · Ukuu HR" };

export default async function SuperAdminPage() {
  const res = await getSuperAdminData();
  const d = res.data;

  return (
    <AdminShell activeKey="super-admin">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Super Admin · platform level</div>
          <h1 className="bk-admin-h1">Platform Admin</h1>
          <p className="bk-admin-sub">Multi-tenant oversight — organizations, users, devices and payroll across the platform.</p>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        {[
          { label: "Organizations", value: d.orgs.length, icon: Building2, tint: "blue" },
          { label: "User accounts", value: d.userCount, icon: Users, tint: "green" },
          { label: "Devices", value: d.deviceCount, icon: Fingerprint, tint: "gold" },
          { label: "Payroll runs", value: d.payrollRunCount, icon: Banknote, tint: "pink" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}><k.icon size={20} strokeWidth={1.9} /></div></div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header">
          <h3>Tenants</h3>
          <span className="bk-admin-pill active" style={{ textTransform: "none" }}><ShieldUser size={12} /> Super Admin scope</span>
        </div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Organization</th><th>Slug</th><th>Plan</th><th>Employees</th><th>Users</th></tr>
          </thead>
          <tbody>
            {d.orgs.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No organizations yet.</td></tr>}
            {d.orgs.map((o) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.name}</td>
                <td className="bk-mono" style={{ color: "var(--bk-ink-3)" }}>{o.slug}</td>
                <td><span className="bk-admin-pill info" style={{ textTransform: "none" }}>{o.plan}</span></td>
                <td className="bk-mono">{o.employees}</td>
                <td className="bk-mono">{o.users}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}