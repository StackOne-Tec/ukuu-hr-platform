import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getDashboardData } from "@/lib/queries";
import { Users, CircleCheck, CalendarDays, Timer, Download, UserPlus, TrendingUp, TrendingDown } from "lucide-react";
import "../admin.css";

export const metadata: Metadata = {
  title: "Workspace Overview · UkuuHR",
  description: "UkuuHR workspace dashboard — employees, attendance, leave, overtime and device status at a glance.",
};

const RATE_PILL: Record<string, string> = { Standard: "pending", Weekend: "info", PublicHoliday: "gold" };

export default async function DashboardPage() {
  const res = await getDashboardData();
  const d = res.data;

  return (
    <AdminShell activeKey="dashboard">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">
            {(() => {
              const h = new Date().getHours();
              return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
            })()}
            , Chungu · All systems operational
          </div>
          <h1 className="bk-admin-h1">Workspace Overview</h1>
          <p className="bk-admin-sub">Here&rsquo;s what&rsquo;s happening across {d.orgName} today.</p>
        </div>
        <div className="bk-admin-actions">
          <button type="button" className="bk-btn bk-btn-secondary"><Download size={16} /> Export Report</button>
          <Link href="/employees/add" className="bk-btn bk-btn-primary"><UserPlus size={16} /> Add Employee</Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="bk-admin-kpi-grid">
        {[
          { icon: Users, tint: "blue", value: String(d.totalEmployees), label: "Total Employees", sub: `${d.activeEmployees} active · ${d.onProbation} on probation`, delta: { tone: "up", text: "+12%" } },
          { icon: CircleCheck, tint: "green", value: `${d.attendancePct}%`, label: "Attendance Today", sub: `${d.presentToday} present · ${d.lateToday} late · ${d.onLeaveToday} on leave`, delta: { tone: "up", text: "+4%" } },
          { icon: CalendarDays, tint: "gold", value: String(d.pendingLeave), label: "Pending Leave Requests", sub: `${d.approvedThisMonth} approved this month`, delta: { tone: "down", text: "-2" } },
          { icon: Timer, tint: "pink", value: String(d.pendingOvertime), label: "Pending Overtime", sub: `${d.pendingOvertimeRecords.length} record(s) awaiting approval` },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top">
              <div className={`bk-admin-kpi-icon ${k.tint}`}><k.icon size={22} strokeWidth={1.9} /></div>
              {k.delta && (
                <span className={`bk-admin-kpi-delta ${k.delta.tone}`}>
                  {k.delta.tone === "up" ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {k.delta.text}
                </span>
              )}
            </div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
            <div className="bk-admin-kpi-sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* working hours + device status */}
      <div className="bk-admin-grid-2-even" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card">
          <div className="bk-admin-card-header">
            <div>
              <h3>Working Hours Summary</h3>
              <p>{new Date().toLocaleDateString("en", { month: "long", year: "numeric" })} · Total hours worked this month</p>
            </div>
            <Link href="/reports/generator" className="bk-btn-text">Full Report</Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, padding: "0 20px 20px" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "var(--bk-ink)", letterSpacing: "-0.03em" }}>{d.totalWorkedHours}<span style={{ fontSize: 14, color: "var(--bk-ink-3)" }}>h</span></div>
              <div className="bk-admin-kpi-label">Total Worked</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#d89c11", letterSpacing: "-0.03em" }}>{d.totalOvertimeHours}<span style={{ fontSize: 14, color: "var(--bk-ink-3)" }}>h</span></div>
              <div className="bk-admin-kpi-label">Overtime</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#14a37f", letterSpacing: "-0.03em" }}>{d.avgHoursPerDay}<span style={{ fontSize: 14, color: "var(--bk-ink-3)" }}>h</span></div>
              <div className="bk-admin-kpi-label">Avg/Day</div>
            </div>
          </div>
        </div>

        <div className="bk-admin-card">
          <div className="bk-admin-card-header">
            <div>
              <h3>Device Status</h3>
              <p>{d.onlineDevices} of {d.totalDevices} device(s) connected</p>
            </div>
            <Link href="/devices" className="bk-btn-text">Manage</Link>
          </div>
          <div style={{ padding: "0 20px 20px" }}>
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ flex: 1, background: "rgba(20,163,127,.06)", border: "1px solid rgba(20,163,127,.15)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#14a37f" }}>{d.onlineDevices}</div>
                <div className="bk-admin-kpi-label">Online</div>
              </div>
              <div style={{ flex: 1, background: "rgba(220,38,38,.06)", border: "1px solid rgba(220,38,38,.15)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#DC2626" }}>{d.offlineDevices}</div>
                <div className="bk-admin-kpi-label">Offline</div>
              </div>
              <div style={{ flex: 1, background: "rgba(216,156,17,.06)", border: "1px solid rgba(216,156,17,.15)", borderRadius: 12, padding: 14, textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#d89c11" }}>{d.errorDevices}</div>
                <div className="bk-admin-kpi-label">Error</div>
              </div>
            </div>
            {d.devices.map((dev) => (
              <div key={dev.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bk-muted)", borderRadius: 10, marginBottom: 8 }}>
                <span className="bk-dot" style={{ background: dev.status === "Online" ? "#14a37f" : dev.status === "Error" ? "#d89c11" : "#DC2626" }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{dev.name}</span>
                <span className="bk-muted-text">{dev.vendor}</span>
                <span className="bk-muted-text">{dev.lastSyncAt ? new Date(dev.lastSyncAt).toLocaleString("en", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}</span>
              </div>
            ))}
            {d.devices.length === 0 && <div className="bk-admin-empty">No devices registered yet.</div>}
          </div>
        </div>
      </div>

      {/* overtime pending approval */}
      <div className="bk-admin-card">
        <div className="bk-admin-card-header">
          <div>
            <h3>Overtime Pending Approval</h3>
            <p>{d.pendingOvertime} record(s) awaiting review</p>
          </div>
          <Link href="/overtime" className="bk-btn-text">View All</Link>
        </div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Employee</th><th>Date</th><th>Hours</th><th>Rate</th></tr>
          </thead>
          <tbody>
            {d.pendingOvertimeRecords.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--bk-ink-3)", fontSize: 13 }}>No overtime pending approval.</td></tr>
            )}
            {d.pendingOvertimeRecords.map((o) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.employeeName}</td>
                <td>{o.date}</td>
                <td className="bk-mono" style={{ fontWeight: 700 }}>{o.hours}h</td>
                <td><span className={`bk-admin-pill ${RATE_PILL[o.rateType] ?? "pending"}`}>{o.rateType}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}