"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Search, Download } from "lucide-react";

const PILL: Record<string, string> = {
  Present: "active", Late: "gold", Absent: "inactive", OnLeave: "info", Remote: "probation",
};

type Row = {
  id: string;
  employeeName: string;
  date: string | null;
  status: string;
  checkIn: string;
  checkOut: string;
  hours: number;
  shiftName: string;
  source: string;
};

export default function AttendanceSearch({ initial }: { initial: Row[] }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const perPage = 20;

  const filtered = useMemo(() => {
    return initial.filter((r) => {
      if (q && !r.employeeName.toLowerCase().includes(q.toLowerCase())) return false;
      if (status && r.status !== status) return false;
      if (from && r.date && r.date.slice(0, 10) < from) return false;
      if (to && r.date && r.date.slice(0, 10) > to) return false;
      return true;
    });
  }, [initial, q, status, from, to]);

  const pageRows = filtered.slice(page * perPage, (page + 1) * perPage);
  const pages = Math.max(1, Math.ceil(filtered.length / perPage));

  return (
    <AdminShell activeKey="attendance">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Time &amp; Attendance · FR-009</div>
          <h1 className="bk-admin-h1">Attendance Search</h1>
          <p className="bk-admin-sub">Multi-filter search: employee, status, date range, source.</p>
        </div>
        <div className="bk-admin-actions">
          <button type="button" className="bk-btn bk-btn-secondary" onClick={() => {
            const csv = [["Employee", "Date", "Status", "CheckIn", "CheckOut", "Hours"].join(","),
              ...filtered.map((r) => [r.employeeName, r.date ?? "", r.status, r.checkIn, r.checkOut, r.hours].join(","))].join("\n");
            const a = document.createElement("a");
            a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
            a.download = "attendance-search.csv";
            a.click();
          }}>
            <Download size={16} /> Export CSV
          </button>
        </div>
      </div>

      {/* filter bar */}
      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-content" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ flex: 1, minWidth: 220, position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 12, color: "var(--bk-ink-3)" }} />
            <input className="bk-input" style={{ paddingLeft: 38 }} placeholder="Search by employee name…" value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} />
          </label>
          <select className="bk-input" style={{ width: 150 }} value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>
            <option value="">All statuses</option>
            {["Present", "Late", "Absent", "OnLeave", "Remote"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <input type="date" className="bk-input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="bk-muted-text">→</span>
          <input type="date" className="bk-input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <div className="bk-admin-card">
        <table className="bk-admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && <tr><td colSpan={6} className="bk-admin-empty">No records match your filters.</td></tr>}
            {pageRows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                <td>{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                <td className="bk-mono">{r.checkIn}</td>
                <td className="bk-mono">{r.checkOut}</td>
                <td style={{ fontWeight: 700 }}>{r.hours}h</td>
                <td><span className={`bk-admin-pill ${PILL[r.status] ?? "active"}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="bk-admin-card-header" style={{ justifyContent: "space-between", borderTop: "1px solid var(--bk-line)" }}>
          <span className="bk-muted-text">Showing {page * perPage + 1}–{Math.min((page + 1) * perPage, filtered.length)} of {filtered.length}</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="bk-btn bk-btn-secondary" style={{ minHeight: 36, padding: "6px 14px" }} disabled={page === 0} onClick={() => setPage((p) => p - 1)}>← Prev</button>
            <span className="bk-muted-text" style={{ alignSelf: "center" }}>{page + 1} / {pages}</span>
            <button type="button" className="bk-btn bk-btn-secondary" style={{ minHeight: 36, padding: "6px 14px" }} disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}