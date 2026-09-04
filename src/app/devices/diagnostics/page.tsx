import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getDevices } from "@/lib/queries";

export const metadata: Metadata = { title: "Device Diagnostics · Ukuu HR" };

export default async function DeviceDiagnosticsPage() {
  const res = await getDevices();
  const devices = res.data;

  return (
    <AdminShell activeKey="devices-diagnostics">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Devices · diagnostics</div>
          <h1 className="bk-admin-h1">Device Diagnostics</h1>
          <p className="bk-admin-sub">Reachability, sync health and last error per device.</p>
        </div>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Health checks</h3><span className="bk-muted-text">Run on page load</span></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Device</th><th>Ping</th><th>Auto-sync</th><th>Interval</th><th>Last sync</th><th>Last error</th></tr>
          </thead>
          <tbody>
            {devices.length === 0 && <tr><td colSpan={6} className="bk-admin-empty">No devices to diagnose.</td></tr>}
            {devices.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td><span className={`bk-admin-pill ${d.status === "Online" ? "active" : d.status === "Error" ? "gold" : "inactive"}`}>{d.status === "Online" ? "Reachable" : d.status === "Error" ? "Degraded" : "Unreachable"}</span></td>
                <td><span className={`bk-admin-pill ${d.autoSyncEnabled ? "approved" : "inactive"}`}>{d.autoSyncEnabled ? "On" : "Off"}</span></td>
                <td className="bk-mono">{d.syncIntervalMinutes} min</td>
                <td>{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString() : "Never"}</td>
                <td style={{ color: d.lastError ? "#DC2626" : "var(--bk-accent-3)", fontSize: 12 }}>{d.lastError || "No errors"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}