"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { Plus } from "lucide-react";

export default function AddDevicePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "", vendor: "Hikvision", model: "", ipAddress: "", port: 80,
    integrationMode: "REST", autoSyncEnabled: true, syncIntervalMinutes: 30,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) router.push("/devices");
      else alert(json.error ?? "Failed to add device");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminShell activeKey="devices">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Devices · new device</div>
          <h1 className="bk-admin-h1">Add Device</h1>
          <p className="bk-admin-sub">Register an attendance device to start syncing clock events.</p>
        </div>
      </div>
      <div className="bk-admin-card" style={{ maxWidth: 620 }}>
        <div className="bk-admin-card-content">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
            <div className="bk-field">
              <label className="bk-label">Device name *</label>
              <input className="bk-input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Main Entrance" />
            </div>
            <div className="bk-field">
              <label className="bk-label">Vendor</label>
              <select className="bk-input" value={form.vendor} onChange={(e) => set("vendor", e.target.value)}>
                {["Hikvision", "ZKTeco", "Suprema", "Dahua", "Anviz", "Matrix", "eSSL"].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="bk-field">
              <label className="bk-label">Model</label>
              <input className="bk-input" value={form.model} onChange={(e) => set("model", e.target.value)} placeholder="DS-K1T671" />
            </div>
            <div className="bk-field">
              <label className="bk-label">IP address</label>
              <input className="bk-input" value={form.ipAddress} onChange={(e) => set("ipAddress", e.target.value)} placeholder="192.168.1.50" />
            </div>
            <div className="bk-field">
              <label className="bk-label">Integration mode</label>
              <select className="bk-input" value={form.integrationMode} onChange={(e) => set("integrationMode", e.target.value)}>
                {["REST", "CSV", "SDK", "TCP"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="bk-field">
              <label className="bk-label">Sync interval (minutes)</label>
              <input type="number" className="bk-input" value={form.syncIntervalMinutes} onChange={(e) => set("syncIntervalMinutes", Number(e.target.value))} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
            <input type="checkbox" checked={form.autoSyncEnabled} onChange={(e) => set("autoSyncEnabled", e.target.checked)} />
            Auto-sync clock events
          </label>
          <button type="button" className="bk-btn bk-btn-primary" onClick={save} disabled={saving || !form.name} style={{ width: "100%" }}>
            <Plus size={16} /> {saving ? "Registering…" : "Register Device"}
          </button>
        </div>
      </div>
    </AdminShell>
  );
}