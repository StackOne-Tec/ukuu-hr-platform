"use client";

import AdminShell from "@/components/admin/AdminShell";
import {
  Clock,
  CalendarCheck,
  Layers,
  Users,
  Plus,
  Pencil,
  Trash2,
  FileText,
  SlidersHorizontal,
  LayoutGrid,
  ArrowLeftRight,
  Moon,
  RefreshCcw,
} from "lucide-react";

type ShiftCard = {
  id: string;
  name: string;
  type: string;
  startTime: string;
  endTime: string;
  color: string;
  description: string;
  isActive: boolean;
  plannedHours: number;
  breakMinutes: number;
  weekdays: number[];
  flexRange: string | null;
  rotation: string | null;
  overnight: string | null;
  assignedCount: number;
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const BADGE: Record<string, { label: string; bg: string; color: string }> = {
  Flexible: { label: "FLEXIBLE", bg: "rgba(20,163,127,.12)", color: "#14a37f" },
  Overnight: { label: "OVERNIGHT", bg: "rgba(216,156,17,.14)", color: "#d89c11" },
  Rotating: { label: "ROTATING", bg: "rgba(123,47,190,.12)", color: "#7B2FBE" },
};

export default function ShiftsView({
  data,
}: {
  data: {
    shifts: ShiftCard[];
    assignments: { id: string; employeeName: string; shiftName: string; isPrimary: boolean }[];
    tolerance: { lateMinutes: number; earlyDepartureMinutes: number; halfDayMinutes: number; absentMinutes: number; gracePeriodMinutes: number };
    counts: { totalShifts: number; activeAssignments: number; shiftTypesUsed: number; employeesScheduled: number };
  };
  employees?: { id: string; name: string; department: string }[];
  departments?: string[];
}) {
  const { shifts, assignments, tolerance, counts } = data;

  const shiftIcon = (name: string) => {
    if (/night/i.test(name)) return Moon;
    if (/rotating/i.test(name)) return RefreshCcw;
    if (/flex/i.test(name)) return ArrowLeftRight;
    return Clock;
  };

  const timeLabel = (s: ShiftCard) => `${s.startTime} – ${s.endTime}${s.type === "Overnight" ? " +1" : ""}`;

  const newShift = () => alert("New shift builder — define a fixed, rotating, flexible or overnight shift.");

  return (
    <AdminShell activeKey="shifts">
      {/* metrics row */}
      <div className="bk-admin-kpi-grid" style={{ marginBottom: 28 }}>
        {[
          { icon: Clock, value: String(counts.totalShifts), label: "Total Shifts", tint: "blue" },
          { icon: CalendarCheck, value: String(counts.activeAssignments), label: "Active Assignments", tint: "green" },
          { icon: Layers, value: String(counts.shiftTypesUsed), label: "Shift Types Used", tint: "gold" },
          { icon: Users, value: String(counts.employeesScheduled), label: "Employees Scheduled", tint: "pink" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}><k.icon size={20} strokeWidth={1.9} /></div></div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* page header */}
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Scheduling</div>
          <h1 className="bk-admin-h1">Shift Management</h1>
          <p className="bk-admin-sub">
            {counts.totalShifts} active shifts • {counts.activeAssignments} assignments — Define fixed, rotating, flexible, and overnight shifts for your organization.
          </p>
        </div>
        <div className="bk-admin-actions">
          <button type="button" className="bk-btn bk-btn-primary" onClick={newShift}><Plus size={16} /> New Shift</button>
        </div>
      </div>

      {/* configuration summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 28 }}>
        {[
          { icon: FileText, title: "Assignments", sub: "Manage employee shift assignments and scheduling rosters.", link: `${assignments.length} assignments`, tint: "#7B2FBE" },
          { icon: SlidersHorizontal, title: "Tolerance Policy", sub: "Configure late, early departure, and absent thresholds.", link: "Attendance rules", tint: "#2563EB" },
          { icon: LayoutGrid, title: "Weekly Coverage", sub: "Staffing matrix per shift across each day of the week.", link: "Coverage view", tint: "#14a37f" },
        ].map((c) => (
          <div key={c.title} className="bk-admin-card" style={{ cursor: "pointer", transition: "all .2s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--bk-line-strong)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "var(--bk-shadow)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--bk-line)"; e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "none"; }}
          >
            <div className="bk-admin-card-content">
              <span style={{ width: 42, height: 42, borderRadius: 12, background: `${c.tint}18`, color: c.tint, display: "grid", placeItems: "center", marginBottom: 14 }}>
                <c.icon size={20} strokeWidth={1.9} />
              </span>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{c.title}</div>
              <p style={{ fontSize: 12.5, color: "var(--bk-ink-2)", lineHeight: 1.5, margin: "6px 0 14px" }}>{c.sub}</p>
              <a href="/shifts" className="bk-link" style={{ fontSize: 13 }}>{c.link} →</a>
            </div>
          </div>
        ))}
      </div>

      {/* shift cards grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
        {shifts.length === 0 && <div className="bk-admin-card"><div className="bk-admin-empty">No shifts defined yet — create your first shift.</div></div>}
        {shifts.map((s) => {
          const Icon = shiftIcon(s.name);
          const badge = BADGE[s.type];
          return (
            <div key={s.id} className="bk-admin-card" style={{ borderTop: `3px solid ${s.color}`, display: "flex", flexDirection: "column" }}>
              <div className="bk-admin-card-content" style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}18`, color: s.color, display: "grid", placeItems: "center", flexShrink: 0 }}>
                    <Icon size={21} strokeWidth={1.9} />
                  </span>
                  {badge && (
                    <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", padding: "4px 10px", borderRadius: 999, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  )}
                </div>

                <div style={{ fontWeight: 800, fontSize: 15, marginTop: 14, lineHeight: 1.3 }}>{s.name}</div>
                <div className="bk-mono" style={{ fontSize: 12, color: "var(--bk-ink-3)", marginTop: 2 }}>{timeLabel(s)}</div>
                <p style={{ fontSize: 12.5, color: "var(--bk-ink-2)", lineHeight: 1.5, margin: "8px 0 14px", minHeight: 38 }}>{s.description}</p>

                {/* weekday pills */}
                <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
                  {DAY_LABELS.map((d, i) => {
                    const active = s.weekdays.includes(i + 1);
                    return (
                      <span key={d} style={{
                        flex: 1, textAlign: "center", fontSize: 9.5, fontWeight: 800, padding: "5px 0", borderRadius: 999,
                        background: "var(--bk-muted)", color: active ? "var(--bk-ink)" : "var(--bk-ink-3)", opacity: active ? 1 : 0.45,
                      }}>
                        {d}
                      </span>
                    );
                  })}
                </div>

                {/* metrics */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 14px" }}>
                  <div><div className="bk-muted-text" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em" }}>PLANNED HOURS</div><div style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{s.plannedHours}h</div></div>
                  <div><div className="bk-muted-text" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em" }}>BREAK</div><div style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{s.breakMinutes} min</div></div>
                  <div><div className="bk-muted-text" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em" }}>ASSIGNED</div><div style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{s.assignedCount} employees</div></div>
                  <div>
                    <div className="bk-muted-text" style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: ".06em" }}>{s.flexRange ? "FLEX RANGE" : s.rotation ? "ROTATION" : s.overnight ? "OVERNIGHT" : "TYPE"}</div>
                    <div style={{ fontWeight: 800, fontSize: 14, marginTop: 2 }}>{s.flexRange ?? s.rotation ?? s.overnight ?? s.type}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, padding: "0 24px 20px" }}>
                <button type="button" className="bk-btn bk-btn-secondary" style={{ flex: 1, minHeight: 38, padding: "8px 0", fontSize: 13 }}>
                  <Pencil size={14} /> Edit
                </button>
                <button type="button" className="bk-btn bk-btn-secondary" style={{ flex: 1, minHeight: 38, padding: "8px 0", fontSize: 13, color: "#DC2626" }}>
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </AdminShell>
  );
}