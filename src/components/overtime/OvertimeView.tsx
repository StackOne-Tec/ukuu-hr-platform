"use client";

import { useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { Check, X, Plus, BarChart3 } from "lucide-react";

type RecordRow = { id: string; employeeName: string; date: string | null; hours: number; rateType: string; status: string; reason: string };
const PILL: Record<string, string> = { Pending: "pending", Approved: "approved", Rejected: "rejected" };

export default function OvertimeView({ records }: { records: RecordRow[] }) {
  const [rows, setRows] = useState(records);

  const decide = async (id: string, status: "Approved" | "Rejected") => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
    await fetch("/api/overtime", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
  };

  const hoursByRate = (rate: string) => rows.filter((r) => r.rateType === rate && r.status === "Approved").reduce((s, r) => s + r.hours, 0);
  const pending = rows.filter((r) => r.status === "Pending");

  return (
    <AdminShell activeKey="overtime">
      <div className="bk-admin-section-header" data-tour="page-overtime">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Overtime · FR-006 / FR-007</div>
          <h1 className="bk-admin-h1">Overtime</h1>
          <p className="bk-admin-sub">Classification by rate type with approval workflow.</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/overtime/report" className="bk-btn bk-btn-secondary"><BarChart3 size={16} /> Report</Link>
          <Link href="/overtime/add" className="bk-btn bk-btn-primary"><Plus size={16} /> Add Overtime</Link>
        </div>
      </div>

      {/* rate-type cards */}
      <div className="bk-admin-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }} data-tour="overtime-rates">
        {[
          ["Standard", "1.5x", "Weekday overtime", hoursByRate("Standard"), "#7B2FBE"],
          ["Weekend", "2.0x", "Saturday / Sunday", hoursByRate("Weekend"), "#2563EB"],
          ["Public Holiday", "3.0x", "Statutory holidays", hoursByRate("PublicHoliday"), "#d89c11"],
        ].map(([label, rate, hint, hours, color]) => (
          <div key={label as string} className="bk-admin-kpi-card" style={{ borderTop: `3px solid ${color}` }}>
            <div className="bk-admin-kpi-label" style={{ color: color as string }}>{label} · {rate}</div>
            <div className="bk-admin-kpi-value">{hours}h</div>
            <div className="bk-admin-kpi-sub">{hint}</div>
          </div>
        ))}
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header">
          <h3>Overtime records</h3>
          <span className="bk-muted-text">{pending.length} pending approval</span>
        </div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Employee</th><th>Date</th><th>Hours</th><th>Rate</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="bk-admin-empty">No overtime records.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                <td>{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                <td className="bk-mono" style={{ fontWeight: 700 }}>{r.hours}h</td>
                <td>
                  <span className="bk-admin-pill" style={{
                    background: r.rateType === "PublicHoliday" ? "rgba(216,156,17,.12)" : r.rateType === "Weekend" ? "rgba(37,99,235,.1)" : "rgba(123,47,190,.12)",
                    color: r.rateType === "PublicHoliday" ? "#d89c11" : r.rateType === "Weekend" ? "#2563EB" : "#7B2FBE",
                    textTransform: "none",
                  }}>
                    {r.rateType} {r.rateType === "Standard" ? "1.5x" : r.rateType === "Weekend" ? "2.0x" : "3.0x"}
                  </span>
                </td>
                <td><span className={`bk-admin-pill ${PILL[r.status] ?? "pending"}`}>{r.status}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.status === "Pending" ? (
                    <>
                      <button type="button" className="bk-btn bk-btn-secondary" style={{ minHeight: 32, padding: "4px 12px", marginRight: 6 }} onClick={() => decide(r.id, "Approved")}>
                        <Check size={14} />
                      </button>
                      <button type="button" className="bk-btn bk-btn-danger" style={{ minHeight: 32, padding: "4px 12px" }} onClick={() => decide(r.id, "Rejected")}>
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <span className="bk-muted-text">{r.reason}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}