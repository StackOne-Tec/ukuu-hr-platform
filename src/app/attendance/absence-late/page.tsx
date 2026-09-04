import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getAttendanceLogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Absence & Late Report · Ukuu HR" };

export default async function AbsenceLateReportPage() {
  const res = await getAttendanceLogs();
  const rows = res.data;
  const byName = new Map<string, { name: string; absent: number; late: number; total: number }>();
  rows.forEach((r) => {
    const cur = byName.get(r.employeeName) ?? { name: r.employeeName, absent: 0, late: 0, total: 0 };
    cur.total++;
    if (r.status === "Absent") cur.absent++;
    if (r.status === "Late") cur.late++;
    byName.set(r.employeeName, cur);
  });
  const summary = [...byName.values()].sort((a, b) => b.late + b.absent - (a.late + a.absent));
  const totalAbsent = summary.reduce((s, x) => s + x.absent, 0);
  const totalLate = summary.reduce((s, x) => s + x.late, 0);

  return (
    <AdminShell activeKey="attendance">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Reporting · FR-010</div>
          <h1 className="bk-admin-h1">Absence &amp; Late Report</h1>
          <p className="bk-admin-sub">Per-employee exception summary — who needs support.</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/attendance/search" className="bk-btn bk-btn-secondary">Search</Link>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        {[
          { label: "Records analysed", value: rows.length, tint: "blue" },
          { label: "Absences", value: totalAbsent, tint: "pink" },
          { label: "Late arrivals", value: totalLate, tint: "gold" },
          { label: "Employees flagged", value: summary.filter((s) => s.late + s.absent > 0).length, tint: "ink" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}>•</div></div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Exceptions by employee</h3><span className="bk-muted-text">Last 30 days</span></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Employee</th><th>Records</th><th>Absences</th><th>Late arrivals</th><th>Score</th></tr>
          </thead>
          <tbody>
            {summary.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No attendance data yet.</td></tr>}
            {summary.map((s) => {
              const score = Math.min(100, Math.round(((s.late * 2 + s.absent * 3) / Math.max(1, s.total)) * 40));
              return (
                <tr key={s.name}>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.total}</td>
                  <td><span className={`bk-admin-pill ${s.absent > 0 ? "inactive" : "active"}`}>{s.absent}</span></td>
                  <td><span className={`bk-admin-pill ${s.late > 0 ? "gold" : "active"}`}>{s.late}</span></td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="bk-admin-progress" style={{ width: 120 }}><div className="bk-admin-progress-fill" style={{ width: `${score}%`, background: score > 60 ? "linear-gradient(90deg,#DC2626,#F87171)" : "linear-gradient(90deg,#14a37f,#2dd4a7)" }} /></div>
                      <span className="bk-mono" style={{ fontSize: 11, fontWeight: 700 }}>{score}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}