"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export default function OvertimeForm({ employees }: { employees: { id: string; name: string }[] }) {
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState(1);
  const [rateType, setRateType] = useState("Standard");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/overtime", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, date, hours, rateType, reason }),
      });
      const json = await res.json();
      if (json.ok) router.push("/overtime");
      else alert(json.error ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bk-admin-card" style={{ maxWidth: 560 }}>
      <div className="bk-admin-card-content">
        <div className="bk-field">
          <label className="bk-label">Employee</label>
          <select className="bk-input" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Select employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div className="bk-field">
            <label className="bk-label">Date</label>
            <input type="date" className="bk-input" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="bk-field">
            <label className="bk-label">Hours</label>
            <input type="number" step="0.1" className="bk-input" value={hours} onChange={(e) => setHours(Number(e.target.value))} />
          </div>
        </div>
        <div className="bk-field">
          <label className="bk-label">Rate type</label>
          <select className="bk-input" value={rateType} onChange={(e) => setRateType(e.target.value)}>
            <option value="Standard">Standard (1.5x)</option>
            <option value="Weekend">Weekend (2.0x)</option>
            <option value="PublicHoliday">Public Holiday (3.0x)</option>
          </select>
        </div>
        <div className="bk-field">
          <label className="bk-label">Reason</label>
          <textarea className="bk-input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why was overtime worked?" />
        </div>
        <button type="button" className="bk-btn bk-btn-primary" onClick={save} disabled={saving || !employeeId} style={{ width: "100%" }}>
          <Plus size={16} /> {saving ? "Saving…" : "Create Overtime Record"}
        </button>
      </div>
    </div>
  );
}