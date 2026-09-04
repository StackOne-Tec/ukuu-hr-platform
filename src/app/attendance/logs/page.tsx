import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getAttendanceLogs } from "@/lib/queries";

export const metadata: Metadata = { title: "Attendance Logs · Ukuu HR" };

const PILL: Record<string, string> = {
  Present: "active", Late: "gold", Absent: "inactive", OnLeave: "info", Remote: "probation",
};

export default async function AttendanceLogsPage() {
  const res = await getAttendanceLogs();
  const rows = res.data;

  return (
    <AdminShell activeKey="attendance">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Time &amp; Attendance · records</div>
          <h1 className="bk-admin-h1">Attendance Logs</h1>
          <p className="bk-admin-sub">Every clock event, corrected and audited. {rows.length} recent record(s).</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/attendance/search" className="bk-btn bk-btn-secondary">Advanced Search</Link>
          <Link href="/attendance/absence-late" className="bk-btn bk-btn-secondary">Absence &amp; Late Report</Link>
          <Link href="/clock" className="bk-btn bk-btn-primary">Clock In / Out</Link>
        </div>
      </div>

      <div className="bk-admin-card">
        <table className="bk-admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Date</th>
              <th>Shift</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Hours</th>
              <th>Source</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="bk-admin-empty">No attendance records found.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                <td>{r.date ? new Date(r.date).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td><span style={{ color: "var(--bk-ink-2)" }}>● {r.shiftName}</span></td>
                <td className="bk-mono">{r.checkIn}</td>
                <td className="bk-mono">{r.checkOut}</td>
                <td style={{ fontWeight: 700 }}>{r.hours}h</td>
                <td><span className="bk-admin-pill info">{r.source}</span></td>
                <td><span className={`bk-admin-pill ${PILL[r.status] ?? "active"}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}