import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getDevices } from "@/lib/queries";
import { Plus, FlaskConical } from "lucide-react";

export const metadata: Metadata = { title: "Devices · Ukuu HR" };

const PILL: Record<string, string> = { Online: "active", Offline: "inactive", Error: "gold" };

const VENDORS = ["Hikvision", "ZKTeco", "Suprema", "Dahua", "Anviz", "Matrix", "eSSL"];

export default async function DevicesPage() {
  const res = await getDevices();
  const devices = res.data;
  const online = devices.filter((d) => d.status === "Online").length;

  return (
    <AdminShell activeKey="devices">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">FR-001 · Third-party device integration</div>
          <h1 className="bk-admin-h1">Devices</h1>
          <p className="bk-admin-sub">{online} of {devices.length} device(s) connected · REST / CSV / SDK / TCP</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/devices/diagnostics" className="bk-btn bk-btn-secondary"><FlaskConical size={16} /> Diagnostics</Link>
          <Link href="/devices/add" className="bk-btn bk-btn-primary"><Plus size={16} /> Add Device</Link>
        </div>
      </div>

      {/* vendor matrix */}
      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-header"><h3>Vendor support matrix</h3></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, padding: 20 }}>
          {VENDORS.map((v) => {
            const count = devices.filter((d) => d.vendor === v).length;
            return (
              <div key={v} style={{ padding: "12px 14px", borderRadius: 12, background: "var(--bk-muted)", border: "1px solid var(--bk-line)", textAlign: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{v}</div>
                <div className="bk-muted-text" style={{ marginTop: 4 }}>{count > 0 ? `${count} connected` : "REST + CSV"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Registered devices</h3></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Device</th><th>Vendor</th><th>Model</th><th>IP Address</th><th>Mode</th><th>Last Sync</th><th>Status</th></tr>
          </thead>
          <tbody>
            {devices.length === 0 && <tr><td colSpan={7} className="bk-admin-empty">No devices registered yet.</td></tr>}
            {devices.map((d) => (
              <tr key={d.id}>
                <td style={{ fontWeight: 600 }}>{d.name}</td>
                <td><span className="bk-admin-pill info">{d.vendor}</span></td>
                <td className="bk-mono" style={{ color: "var(--bk-ink-3)" }}>{d.model}</td>
                <td className="bk-mono">{d.ipAddress}</td>
                <td><span className="bk-admin-pill probation" style={{ textTransform: "none" }}>{d.integrationMode}</span></td>
                <td>{d.lastSyncAt ? new Date(d.lastSyncAt).toLocaleString("en", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Never"}</td>
                <td><span className={`bk-admin-pill ${PILL[d.status] ?? "info"}`}>{d.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}