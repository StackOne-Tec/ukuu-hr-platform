"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Plus } from "lucide-react";

type ShiftRow = { id: string; name: string; type: string; startTime: string; endTime: string; color: string; isActive: boolean };
type AssignmentRow = { id: string; employeeName: string; shiftName: string; shiftStart: string; shiftEnd: string; isPrimary: boolean; effectiveFrom: string | null };
type Tolerance = { lateMinutes: number; earlyDepartureMinutes: number; halfDayMinutes: number; absentMinutes: number; gracePeriodMinutes: number };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function ShiftsView({
  data,
  employees,
  departments,
}: {
  data: { shifts: ShiftRow[]; assignments: AssignmentRow[]; deptAssignments: { id: string; departmentId: string; shiftName: string; dayMask: number }[]; tolerance: Tolerance };
  employees: { id: string; name: string; department: string }[];
  departments: string[];
}) {
  const [tab, setTab] = useState("shifts");
  const { shifts, assignments, deptAssignments, tolerance } = data;

  const TABS = [
    ["shifts", `Shifts (${shifts.length})`],
    ["assignments", `Assignments (${assignments.length})`],
    ["tolerance", "Tolerance"],
    ["coverage", "Weekly Coverage"],
  ];

  return (
    <AdminShell activeKey="shifts">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Scheduling · FR-004 / FR-005</div>
          <h1 className="bk-admin-h1">Shifts &amp; Scheduling</h1>
          <p className="bk-admin-sub">Fixed, rotating, flexible and overnight shifts with tolerance policy.</p>
        </div>
        <div className="bk-admin-actions">
          <button type="button" className="bk-btn bk-btn-primary"><Plus size={16} /> New Shift</button>
        </div>
      </div>

      {/* tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--bk-line)", marginBottom: 20 }}>
        {TABS.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setTab(key)} style={{
            padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
            fontSize: 13, fontWeight: 700, color: tab === key ? "var(--bk-accent)" : "var(--bk-ink-3)",
            borderBottom: tab === key ? "2px solid var(--bk-accent)" : "2px solid transparent", marginBottom: -1,
          }}>
            {label}
          </button>
        ))}
      </div>

      {tab === "shifts" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Shift templates</h3></div>
          <table className="bk-admin-table">
            <thead><tr><th>Shift</th><th>Type</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
            <tbody>
              {shifts.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No shifts defined.</td></tr>}
              {shifts.map((s) => (
                <tr key={s.id}>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontWeight: 600 }}><span className="bk-dot" style={{ background: s.color }} />{s.name}</span></td>
                  <td><span className="bk-admin-pill info">{s.type}</span></td>
                  <td className="bk-mono">{s.startTime}</td>
                  <td className="bk-mono">{s.endTime}</td>
                  <td><span className={`bk-admin-pill ${s.isActive ? "active" : "inactive"}`}>{s.isActive ? "Active" : "Inactive"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "assignments" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Employee × shift assignments</h3></div>
          <table className="bk-admin-table">
            <thead><tr><th>Employee</th><th>Shift</th><th>Hours</th><th>Primary</th><th>Effective</th></tr></thead>
            <tbody>
              {assignments.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No assignments yet.</td></tr>}
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.employeeName}</td>
                  <td><span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><span className="bk-dot" style={{ background: "#7B2FBE" }} />{a.shiftName}</span></td>
                  <td className="bk-mono">{a.shiftStart} – {a.shiftEnd}</td>
                  <td><span className={`bk-admin-pill ${a.isPrimary ? "approved" : "info"}`}>{a.isPrimary ? "Primary" : "Secondary"}</span></td>
                  <td>{a.effectiveFrom ? new Date(a.effectiveFrom).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "tolerance" && (
        <div className="bk-admin-grid-2-even">
          {[
            ["Late threshold", tolerance.lateMinutes, "minutes", "Beyond this, check-in is flagged Late"],
            ["Early-departure threshold", tolerance.earlyDepartureMinutes, "minutes", "Beyond this, check-out is flagged Early"],
            ["Half-day threshold", tolerance.halfDayMinutes, "minutes", "Attendance under this counts as half day"],
            ["Absent threshold", tolerance.absentMinutes, "minutes", "No punch beyond this counts as Absent"],
            ["Grace period", tolerance.gracePeriodMinutes, "minutes", "Clock-in allowed before shift start"],
          ].map(([label, value, unit, hint]) => (
            <div key={label as string} className="bk-admin-card">
              <div className="bk-admin-card-content">
                <div className="bk-muted-text" style={{ textTransform: "uppercase", letterSpacing: ".05em", fontSize: 10, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 32, fontWeight: 800, margin: "8px 0 2px" }}>{value} <span style={{ fontSize: 14, color: "var(--bk-ink-3)" }}>{unit}</span></div>
                <div className="bk-muted-text">{hint}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "coverage" && (
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Department × day coverage matrix</h3></div>
          <table className="bk-admin-table">
            <thead>
              <tr><th>Department</th>{DAYS.map((d) => <th key={d} style={{ textAlign: "center" }}>{d}</th>)}</tr>
            </thead>
            <tbody>
              {departments.length === 0 && <tr><td colSpan={8} className="bk-admin-empty">No departments to map.</td></tr>}
              {departments.map((dept) => {
                const deptEmployees = employees.filter((e) => e.department === dept);
                const covered = deptEmployees.length > 0;
                return (
                  <tr key={dept}>
                    <td style={{ fontWeight: 600 }}>{dept} <span className="bk-muted-text">({deptEmployees.length})</span></td>
                    {DAYS.map((_, i) => (
                      <td key={i} style={{ textAlign: "center" }}>
                        <span className={`bk-admin-pill ${covered && i < 5 ? "approved" : "inactive"}`} style={{ textTransform: "none", padding: "2px 8px" }}>
                          {covered && i < 5 ? "●" : "—"}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </AdminShell>
  );
}