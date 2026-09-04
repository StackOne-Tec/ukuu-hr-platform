import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getDevices } from "@/lib/queries";

export const metadata: Metadata = { title: "Hikvision · Ukuu HR" };

export default async function HikvisionPage() {
  const res = await getDevices();
  const devices = res.data.filter((d) => d.vendor === "Hikvision");

  return (
    <AdminShell activeKey="devices">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Devices · Hikvision ISAPI</div>
          <h1 className="bk-admin-h1">Hikvision Integration</h1>
          <p className="bk-admin-sub">ISAPI protocol client, background sync and event processing.</p>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        <div className="bk-admin-kpi-card">
          <div className="bk-admin-kpi-value">{devices.length}</div>
          <div className="bk-admin-kpi-label">Hikvision devices</div>
        </div>
        <div className="bk-admin-kpi-card">
          <div className="bk-admin-kpi-value" style={{ color: "var(--bk-accent-3)" }}>{devices.filter((d) => d.status === "Online").length}</div>
          <div className="bk-admin-kpi-label">Online</div>
        </div>
        <div className="bk-admin-kpi-card">
          <div className="bk-admin-kpi-value">214</div>
          <div className="bk-admin-kpi-label">Events synced today</div>
        </div>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Registered Hikvision devices</h3></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Device</th><th>Model</th><th>IP</th><th>Last sync</th><th>Status</th></tr>
          </thead>
          <tbody>
            {devices.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No Hikvision devices registered.</td></tr>}
            {devices.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td className="bk-mono">{d.model}</td>
                <td className="bk-mono">{d.ipAddress}</td>
                <td>{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : "Never"}</td>
                <td><span className={`bk-admin-pill ${d.status === "Online" ? "active" : "inactive"}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}