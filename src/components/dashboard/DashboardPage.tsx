"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Users,
  CircleCheck,
  CalendarDays,
  Timer,
  TrendingUp,
  TrendingDown,
  Download,
  UserPlus,
  ChevronsRight,
  Bell,
} from "lucide-react";
import Sidebar from "./Sidebar";

/* ---------------- mock data (mirrors screenshot) ---------------- */

const KPIS = [
  {
    key: "employees",
    icon: Users,
    tint: "lav",
    value: "8",
    label: "Total Employees",
    sub: "7 active · 1 on probation",
    badge: { tone: "up", text: "+12%", icon: TrendingUp },
  },
  {
    key: "attendance",
    icon: CircleCheck,
    tint: "mint",
    value: "0.0%",
    label: "Attendance Today",
    sub: "0 present · 0 late · 0 absent · 0 on leave",
    badge: { tone: "up", text: "+4%", icon: TrendingUp },
  },
  {
    key: "leave",
    icon: CalendarDays,
    tint: "lav",
    value: "2",
    label: "Pending Leave Requests",
    sub: "0 approved this month",
    badge: { tone: "down", text: "-2", icon: TrendingDown },
  },
  {
    key: "overtime",
    icon: Timer,
    tint: "pink",
    value: "5",
    label: "Pending Overtime",
    sub: "5 record(s) awaiting approval",
    dot: true,
  },
];

const OVERTIME_ROWS = [
  { id: 1, name: "Joseph Mwila Phiri", initial: "J", date: "01 Sep", hours: "2.4h", rate: "DOUBLE TIME (2.0x)" },
  { id: 2, name: "Chungu Chama", initial: "C", date: "01 Sep", hours: "2.3h", rate: "DOUBLE TIME (2.0x)" },
  { id: 3, name: "Chungu Chama", initial: "C", date: "26 Aug", hours: "1.2h", rate: "STANDARD (1.5x)" },
  { id: 4, name: "Grace Mwape", initial: "G", date: "20 Aug", hours: "0.9h", rate: "STANDARD (1.5x)" },
  { id: 5, name: "Grace Mwape", initial: "G", date: "14 Aug", hours: "1.6h", rate: "STANDARD (1.5x)" },
];

/* ---------------- theme store (localStorage-backed) ---------------- */

const THEME_KEY = "ukuu-dashboard-theme";
const THEME_EVENT = "ukuu-dashboard-theme-change";

function subscribeTheme(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(THEME_EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(THEME_EVENT, cb);
  };
}

function getThemeSnapshot(): boolean {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark";
  } catch {
    return false;
  }
}

function getThemeServerSnapshot(): boolean {
  return false;
}

/* ---------------- component ---------------- */

export default function DashboardPage() {
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  const themeDark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, getThemeServerSnapshot);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const toggleTheme = () => {
    try {
      window.localStorage.setItem(THEME_KEY, themeDark ? "light" : "dark");
    } catch { /* ignore */ }
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  const showToast = (text: string) => setToast({ id: Date.now(), text });

  const exportReport = () => {
    const header = "Employee,Date,Hours,Rate\n";
    const csv = OVERTIME_ROWS.map((r) => `${r.name},${r.date},${r.hours},"${r.rate}"`).join("\n");
    try {
      const url = URL.createObjectURL(new Blob([header + csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "ukuuhr-overtime-pending.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast("Overtime report exported as CSV");
    } catch {
      showToast("Export failed — please try again");
    }
  };

  return (
    <div className={`db-root${themeDark ? " db-dark" : ""}`}>
      <Sidebar themeDark={themeDark} onToggleTheme={toggleTheme} />

      <div className="db-main">
        {/* header */}
        <header className="db-header">
          <div>
            <p className="db-header-status">
              <span className="db-status-dot" aria-hidden="true" />
              Good morning, Google · All systems operational
            </p>
            <h1>Workspace Overview</h1>
            <p className="db-header-sub">Here&rsquo;s what&rsquo;s happening across UkuuHR Demo Ltd today.</p>
          </div>
          <div className="db-header-actions">
            <button type="button" className="db-btn db-btn-ghost" onClick={exportReport}>
              <Download size={16} strokeWidth={2} aria-hidden="true" />
              Export Report
            </button>
            <button type="button" className="db-btn db-btn-primary" onClick={() => showToast("Add Employee will open the Employees module")}>
              <UserPlus size={16} strokeWidth={2} aria-hidden="true" />
              Add Employee
            </button>
          </div>
        </header>

        {/* content */}
        <main className="db-content">
          {/* KPI row */}
          <section className="db-kpis" aria-label="Key metrics">
            {KPIS.map((kpi) => (
              <article key={kpi.key} className={`db-card db-kpi${kpi.dot ? " has-dot" : ""}`}>
                <span className={`db-kpi-icon db-kpi-icon--${kpi.tint}`}>
                  <kpi.icon size={22} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <p className="db-kpi-value">{kpi.value}</p>
                <p className="db-kpi-label">{kpi.label}</p>
                <p className="db-kpi-sub">{kpi.sub}</p>
                {kpi.badge ? (
                  <span className={`db-kpi-badge db-kpi-badge--${kpi.badge.tone}`}>
                    <kpi.badge.icon size={13} strokeWidth={2.2} aria-hidden="true" />
                    {kpi.badge.text}
                  </span>
                ) : null}
                {kpi.dot ? <span className="db-kpi-dot" aria-label="attention required" role="img" /> : null}
              </article>
            ))}
          </section>

          {/* working hours + device status */}
          <section className="db-duo" aria-label="Attendance summaries">
            <article className="db-card">
              <div className="db-card-head">
                <div>
                  <h2 className="db-card-title">Working Hours Summary</h2>
                  <p className="db-card-sub">September 2026 · Total hours worked this month</p>
                </div>
                <button type="button" className="db-card-link">
                  Full Report <ChevronsRight size={15} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
              <div className="db-hours-body">
                <div className="db-stat">
                  <p className="db-stat-value db-stat-value--ink">63.9h</p>
                  <p className="db-stat-label">Total Worked</p>
                </div>
                <div className="db-stat">
                  <p className="db-stat-value db-stat-value--gold">4.7h</p>
                  <p className="db-stat-label">Overtime</p>
                </div>
                <div className="db-stat">
                  <p className="db-stat-value db-stat-value--green">21.3h</p>
                  <p className="db-stat-label">Avg/Day</p>
                </div>
              </div>
            </article>

            <article className="db-card">
              <div className="db-card-head">
                <div>
                  <h2 className="db-card-title">Device Status</h2>
                  <p className="db-card-sub">1 of 1 device(s) connected</p>
                </div>
                <button type="button" className="db-card-link">
                  Manage <ChevronsRight size={15} strokeWidth={2.2} aria-hidden="true" />
                </button>
              </div>
              <div className="db-device-body">
                <div className="db-dev-box db-dev-box--on">
                  <p className="db-dev-value">1</p>
                  <p className="db-dev-label">Online</p>
                </div>
                <div className="db-dev-box db-dev-box--off">
                  <p className="db-dev-value">0</p>
                  <p className="db-dev-label">Offline</p>
                </div>
                <div className="db-dev-box db-dev-box--err">
                  <p className="db-dev-value">0</p>
                  <p className="db-dev-label">Error</p>
                </div>
              </div>
              <div className="db-device-list">
                <div className="db-device-row">
                  <span className="db-device-name">
                    <span className="db-status-dot" aria-hidden="true" />
                    Main Entrance — Hikvision
                  </span>
                  <span className="db-device-meta">Hikvision · 03 Sep 07:57</span>
                </div>
              </div>
            </article>
          </section>

          {/* today's clock in/out */}
          <section className="db-card db-table-card" aria-label="Today's clock in and out">
            <div className="db-card-head">
              <div>
                <h2 className="db-card-title">Today&rsquo;s Clock In/Out</h2>
                <p className="db-card-sub">03 September 2026 · 0 employee(s) recorded</p>
              </div>
              <button type="button" className="db-card-link">
                View All <ChevronsRight size={15} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
            <table className="db-table">
              <thead className="db-thead">
                <tr>
                  <th style={{ width: "30%" }}>Employee</th>
                  <th className="db-col-status" style={{ width: "20%" }}>Status</th>
                  <th className="db-col-clockin" style={{ width: "18%" }}>Clock In</th>
                  <th className="db-col-clockout" style={{ width: "18%" }}>Clock Out</th>
                  <th className="db-col-hours" style={{ width: "14%" }}>Hours</th>
                </tr>
              </thead>
              <tbody className="db-tbody">
                <tr>
                  <td colSpan={5}>
                    <div className="db-empty">No attendance records for today yet.</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* overtime pending approval */}
          <section className="db-card db-table-card" aria-label="Overtime pending approval">
            <div className="db-card-head">
              <div>
                <h2 className="db-card-title">Overtime Pending Approval</h2>
                <p className="db-card-sub">5 record(s) awaiting review</p>
              </div>
              <button type="button" className="db-card-link">
                View All <ChevronsRight size={15} strokeWidth={2.2} aria-hidden="true" />
              </button>
            </div>
            <table className="db-table">
              <thead className="db-thead">
                <tr>
                  <th style={{ width: "40%" }}>Employee</th>
                  <th className="db-col-date" style={{ width: "18%" }}>Date</th>
                  <th style={{ width: "14%" }}>Hours</th>
                  <th style={{ width: "28%" }}>Rate</th>
                </tr>
              </thead>
              <tbody className="db-tbody">
                {OVERTIME_ROWS.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="db-emp">
                        <span className="db-avatar" aria-hidden="true">{row.initial}</span>
                        <span className="db-emp-name">{row.name}</span>
                      </span>
                    </td>
                    <td className="db-col-date">{row.date}</td>
                    <td className="db-hours-val">{row.hours}</td>
                    <td className="db-num">
                      <span className="db-rate">
                        <i aria-hidden="true" />
                        {row.rate}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </main>
      </div>

      {toast ? (
        <div className="db-toast" role="status" aria-live="polite">
          <span className="db-toast-icon"><Bell size={16} strokeWidth={2} aria-hidden="true" /></span>
          {toast.text}
        </div>
      ) : null}
    </div>
  );
}
