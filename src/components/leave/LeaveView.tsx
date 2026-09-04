"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { CalendarPlus, Check, X } from "lucide-react";

type LeaveRequestRow = {
  id: string;
  employeeName: string;
  type: string;
  startDate: string | null;
  endDate: string | null;
  days: number;
  status: string;
  reason: string;
};
type LeaveTypeRow = { id: string; name: string; daysPerYear: number; color: string };
type HolidayRow = { id: string; name: string; date: string | null; country: string };

const PILL: Record<string, string> = { Pending: "pending", Approved: "approved", Rejected: "rejected" };

export default function LeaveView({ requests, types, holidays }: { requests: LeaveRequestRow[]; types: LeaveTypeRow[]; holidays: HolidayRow[] }) {
  const [tab, setTab] = useState("pending");

  const visible = useMemo(() => {
    if (tab === "all") return requests;
    return requests.filter((r) => r.status.toLowerCase() === tab);
  }, [requests, tab]);

  const counts: Record<string, number> = {
    pending: requests.filter((r) => r.status === "Pending").length,
    approved: requests.filter((r) => r.status === "Approved").length,
    rejected: requests.filter((r) => r.status === "Rejected").length,
  };

  const decide = async (id: string, status: "Approved" | "Rejected") => {
    await fetch("/api/leave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    window.location.reload();
  };

  return (
    <AdminShell activeKey="leave">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Leave · approval workflow</div>
          <h1 className="bk-admin-h1">Leave Management</h1>
          <p className="bk-admin-sub">Approve or reject requests, track balances and public holidays.</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/holidays" className="bk-btn bk-btn-secondary">Public Holidays</Link>
          <Link href="/leave/request" className="bk-btn bk-btn-primary"><CalendarPlus size={16} /> New Request</Link>
        </div>
      </div>

      {/* leave types */}
      <div className="bk-admin-kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        {types.map((t) => (
          <div key={t.id} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><span className="bk-dot" style={{ background: t.color, width: 12, height: 12 }} /></div>
            <div className="bk-admin-kpi-value" style={{ fontSize: 24 }}>{t.daysPerYear} days</div>
            <div className="bk-admin-kpi-label">{t.name} / year</div>
          </div>
        ))}
        <div className="bk-admin-kpi-card" style={{ borderStyle: "dashed" }}>
          <div className="bk-admin-kpi-value" style={{ fontSize: 24 }}>{holidays.length}</div>
          <div className="bk-admin-kpi-label">Public holidays</div>
          <div className="bk-admin-kpi-sub">{holidays.filter((h) => h.date && new Date(h.date) >= new Date()).length} upcoming</div>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--bk-line)", marginBottom: 20 }}>
        {[
          ["pending", `Pending (${counts.pending})`],
          ["approved", `Approved (${counts.approved})`],
          ["rejected", `Rejected (${counts.rejected})`],
          ["all", "All"],
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, color: tab === key ? "var(--bk-accent)" : "var(--bk-ink-3)",
            borderBottom: tab === key ? "2px solid var(--bk-accent)" : "2px solid transparent", marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      <div className="bk-admin-card">
        <table className="bk-admin-table">
          <thead>
            <tr><th>Employee</th><th>Type</th><th>Start</th><th>End</th><th>Days</th><th>Status</th><th style={{ textAlign: "right" }}>Actions</th></tr>
          </thead>
          <tbody>
            {visible.length === 0 && <tr><td colSpan={7} className="bk-admin-empty">No {tab} leave requests.</td></tr>}
            {visible.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                <td><span className="bk-admin-pill info">{r.type}</span></td>
                <td>{r.startDate ? new Date(r.startDate).toLocaleDateString() : "—"}</td>
                <td>{r.endDate ? new Date(r.endDate).toLocaleDateString() : "—"}</td>
                <td className="bk-mono">{r.days}d</td>
                <td><span className={`bk-admin-pill ${PILL[r.status] ?? "pending"}`}>{r.status}</span></td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  {r.status === "Pending" ? (
                    <>
                      <button type="button" className="bk-btn bk-btn-secondary" style={{ minHeight: 32, padding: "4px 12px", marginRight: 6 }} onClick={() => decide(r.id, "Approved")}>
                        <Check size={14} /> Approve
                      </button>
                      <button type="button" className="bk-btn bk-btn-danger" style={{ minHeight: 32, padding: "4px 12px" }} onClick={() => decide(r.id, "Rejected")}>
                        <X size={14} /> Reject
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