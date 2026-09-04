"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";

export default function LeaveRequestForm({
  types,
  employees,
}: {
  types: { id: string; name: string; daysPerYear: number }[];
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ employeeId: "", type: "Annual", startDate: "", endDate: "", reason: "" });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const days = (() => {
    if (!form.startDate || !form.endDate) return 0;
    const d = Math.round((new Date(form.endDate).getTime() - new Date(form.startDate).getTime()) / 86400000) + 1;
    return Math.max(1, d);
  })();

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) router.push("/leave");
      else alert(json.error ?? "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-admin-card" style={{ maxWidth: 640 }}>
      <div className="bk-admin-card-content">
        <div className="bk-field">
          <label className="bk-label">Employee</label>
          <select className="bk-input" value={form.employeeId} onChange={(e) => set("employeeId", e.target.value)}>
            <option value="">Select employee…</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
        </div>
        <div className="bk-field">
          <label className="bk-label">Leave Type</label>
          <select className="bk-input" value={form.type} onChange={(e) => set("type", e.target.value)}>
            {types.map((t) => <option key={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div className="bk-field">
            <label className="bk-label">Start Date</label>
            <input type="date" className="bk-input" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </div>
          <div className="bk-field">
            <label className="bk-label">End Date</label>
            <input type="date" className="bk-input" value={form.endDate} onChange={(e) => set("endDate", e.target.value)} />
          </div>
        </div>
        <div className="bk-field">
          <label className="bk-label">Reason</label>
          <textarea className="bk-input" value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Optional context for approvers…" />
        </div>
        <div className="bk-admin-stat-box" style={{ marginBottom: 20 }}>
          <div className="bk-admin-stat-box-label">Days requested</div>
          <div className="bk-admin-stat-box-value">{days}d</div>
        </div>
        <button type="button" className="bk-btn bk-btn-primary" onClick={save} disabled={saving || !form.employeeId || !form.startDate || !form.endDate} style={{ width: "100%" }}>
          <Send size={16} /> {saving ? "Submitting…" : "Submit Request"}
        </button>
      </div>
    </div>
  );
}