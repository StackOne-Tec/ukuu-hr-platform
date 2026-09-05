import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getAttendance, getClockEvents, getDeviceImports } from "@/lib/queries";
import { Clock, Timer, RefreshCw, CloudDownload } from "lucide-react";

export const metadata: Metadata = { title: "Attendance · Ukuu HR" };

const PILL: Record<string, string> = {
  Present: "active", Late: "gold", Absent: "inactive", OnLeave: "info", Remote: "probation",
};

export default async function AttendancePage() {
  const [attRes, clockRes, impRes] = await Promise.all([getAttendance(), getClockEvents(), getDeviceImports()]);
  const rows = attRes.data;
  const events = clockRes.data;
  const imports = impRes.data;

  const statusCount = (s: string) => rows.filter((r) => r.status === s).length;
  const present = statusCount("Present") + statusCount("Late");
  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <AdminShell activeKey="attendance">
      <div className="bk-admin-section-header" data-tour="page-attendance">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Time &amp; Attendance · live operations</div>
          <h1 className="bk-admin-h1">Attendance</h1>
          <p className="bk-admin-sub">{new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })} · Shift-aware status, updated live</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/attendance/logs" className="bk-btn bk-btn-secondary"><RefreshCw size={16} /> Logs</Link>
          <Link href="/attendance/import" className="bk-btn bk-btn-secondary"><CloudDownload size={16} /> Import Records</Link>
          <Link href="/clock" className="bk-btn bk-btn-primary" data-tour="attendance-clock"><Timer size={16} /> Clock In / Out</Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="bk-admin-kpi-grid">
        {[
          { label: "Present", value: present, tint: "green", sub: "checked in today" },
          { label: "Late arrivals", value: statusCount("Late"), tint: "gold", sub: "beyond grace period" },
          { label: "On leave", value: statusCount("OnLeave"), tint: "pink", sub: "approved leave" },
          { label: "Total hours", value: `${totalHours}h`, tint: "gold", sub: "worked today" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}><Clock size={20} strokeWidth={1.9} /></div></div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
            <div className="bk-admin-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* status filter chips */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
        {["All", "Present", "Late", "Absent", "OnLeave", "Remote"].map((s) => (
          <button key={s} type="button" className="bk-admin-pill" style={{
            cursor: "pointer", border: "1px solid var(--bk-line)", background: s === "All" ? "var(--bk-accent)" : "var(--bk-bg-strong)",
            color: s === "All" ? "#fff" : "var(--bk-ink-2)",
          }}>
            {s} {s !== "All" && `(${statusCount(s)})`}
          </button>
        ))}
      </div>

      {/* live events strip */}
      <div className="bk-admin-card" style={{ marginBottom: 24 }} data-tour="attendance-live">
        <div className="bk-admin-card-header">
          <h3>Live clock events</h3>
          <span className="bk-admin-pill active" style={{ textTransform: "none" }}>● LIVE</span>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "16px 24px" }}>
          {events.length === 0 && <div className="bk-muted-text">No clock events yet today.</div>}
          {events.slice(0, 8).map((c) => (
            <div key={c.id} style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 12, background: "var(--bk-muted)", fontSize: 12 }}>
              <span className="bk-mono" style={{ fontWeight: 700 }}>{c.employeeCode}</span>
              <div style={{ color: "var(--bk-ink-3)", marginTop: 2 }}>
                {c.eventType} · {c.eventTime ? new Date(c.eventTime).toTimeString().slice(0, 5) : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* imported device records — pulled straight from live terminals */}
      {imports.length > 0 && (
        <div className="bk-admin-card" style={{ marginBottom: 24 }}>
          <div className="bk-admin-card-header">
            <div>
              <h3>Device imports</h3>
              <p>Records pulled straight from live terminals via Import Records</p>
            </div>
            <Link href="/attendance/import" className="bk-btn-text"><CloudDownload size={13} style={{ verticalAlign: -2, marginRight: 4 }} />Import more</Link>
          </div>
          <table className="bk-admin-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Check In</th>
                <th>Check Out</th>
                <th>Hours</th>
                <th>Status</th>
                <th>Device</th>
              </tr>
            </thead>
            <tbody>
              {imports.map((r) => (
                <tr key={r.id}>
                  <td style={{ fontWeight: 600 }}>{r.employeeName}</td>
                  <td className="bk-mono" style={{ fontWeight: 700 }}>{r.date}</td>
                  <td className="bk-mono" style={{ fontWeight: 700 }}>{r.checkIn}</td>
                  <td className="bk-mono" style={{ fontWeight: 700 }}>{r.checkOut}</td>
                  <td style={{ fontWeight: 700 }}>{r.hours}h</td>
                  <td><span className={`bk-admin-pill ${PILL[r.status] ?? "active"}`}>{r.status}</span></td>
                  <td className="bk-muted-text">{r.device}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* today's attendance table */}
      <div className="bk-admin-card" data-tour="attendance-table">
        <div className="bk-admin-card-header">
          <div>
            <h3>Today&rsquo;s attendance</h3>
            <p>{rows.length} employee(s) recorded</p>
          </div>
          <Link href="/attendance/logs" className="bk-btn-text">View full list</Link>
        </div>
        <table className="bk-admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Shift</th>
              <th>Check In</th>
              <th>Check Out</th>
              <th>Hours</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="bk-admin-empty">No attendance records for today yet.</td></tr>}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="bk-admin-avatar">{r.employeeName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                    <span style={{ fontWeight: 600 }}>{r.employeeName}</span>
                  </span>
                </td>
                <td><span style={{ color: "var(--bk-ink-2)", fontWeight: 600 }}>● &nbsp;{r.shiftName}</span></td>
                <td className="bk-mono" style={{ fontWeight: 700 }}>{r.checkIn}</td>
                <td className="bk-mono" style={{ fontWeight: 700 }}>{r.checkOut}</td>
                <td style={{ fontWeight: 700 }}>{r.hours}h</td>
                <td><span className={`bk-admin-pill ${PILL[r.status] ?? "active"}`}>{r.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}