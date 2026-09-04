"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Download, FileText } from "lucide-react";

type Log = { id: string; employeeName: string; date: string | null; status: string; checkIn: string; checkOut: string; hours: number; shiftName: string; source: string };
type RepData = { departments: { name: string; count: number }[]; statuses: { name: string; count: number }[]; spend: { label: string; total: number; net: number }[]; totalEmployees: number; totalAttendance: number; payrollRuns: number };

export default function ReportGenerator({ data, logs }: { data: RepData; logs: Log[] }) {
  const [reportType, setReportType] = useState("Attendance");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [generated, setGenerated] = useState<Log[] | null>(null);

  const rows = useMemo(() => {
    if (!generated) return null;
    return generated;
  }, [generated]);

  const generate = () => {
    setGenerated(
      logs.filter((r) => {
        if (from && r.date && r.date.slice(0, 10) < from) return false;
        if (to && r.date && r.date.slice(0, 10) > to) return false;
        return true;
      })
    );
  };

  const exportCsv = () => {
    if (!rows) return;
    const csv = [["Employee", "Date", "Status", "CheckIn", "CheckOut", "Hours"].join(","),
      ...rows.map((r) => [r.employeeName, r.date ?? "", r.status, r.checkIn, r.checkOut, r.hours].join(","))].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${reportType.toLowerCase()}-report.csv`;
    a.click();
  };

  return (
    <AdminShell activeKey="reports">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Reporting · generator</div>
          <h1 className="bk-admin-h1">Report Generator</h1>
          <p className="bk-admin-sub">Daily / weekly / monthly / custom reports with CSV export.</p>
        </div>
        <div className="bk-admin-actions">
          {generated && <button type="button" className="bk-btn bk-btn-secondary" onClick={exportCsv}><Download size={16} /> Export CSV</button>}
        </div>
      </div>

      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-content" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <select className="bk-input" style={{ width: 200 }} value={reportType} onChange={(e) => setReportType(e.target.value)}>
            {["Attendance", "Overtime", "Payroll", "Leave"].map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="date" className="bk-input" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="bk-muted-text">→</span>
          <input type="date" className="bk-input" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="button" className="bk-btn bk-btn-primary" onClick={generate}><FileText size={16} /> Generate</button>
        </div>
      </div>

      {rows && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header">
            <h3>{reportType} report</h3>
            <span className="bk-muted-text">{rows.length} row(s) · {from || "all"} → {to || "today"}</span>
          </div>
          <table className="bk-admin-table">
            <thead>
              <tr><th>Employee</th><th>Date</th><th>Shift</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} className="bk-admin-empty">No records in this period.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                  <td>{r.date ? new Date(r.date).toLocaleDateString() : "—"}</td>
                  <td>{r.shiftName}</td>
                  <td className="bk-mono">{r.checkIn}</td>
                  <td className="bk-mono">{r.checkOut}</td>
                  <td className="bk-mono">{r.hours}h</td>
                  <td><span className={`bk-admin-pill ${r.status.toLowerCase() === "present" ? "active" : r.status.toLowerCase() === "late" ? "gold" : r.status.toLowerCase() === "absent" ? "inactive" : "info"}`}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}