import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import EmployeeExport from "@/components/employees/EmployeeExport";
import { getEmployees } from "@/lib/queries";
import { Users, Search, UserPlus } from "lucide-react";

export const metadata: Metadata = { title: "Employees · Ukuu HR" };

const STATUS_PILL: Record<string, string> = { Active: "active", Probation: "probation", Inactive: "inactive" };
const AVATAR_CLASS = ["", "green", "blue", "pink", "gold"];

export default async function EmployeesPage() {
  const res = await getEmployees();
  const employees = res.data;

  const total = employees.length;
  const active = employees.filter((e) => e.status === "Active").length;
  const probation = employees.filter((e) => e.status === "Probation").length;
  const deptSet = new Set(employees.map((e) => e.department));

  return (
    <AdminShell activeKey="employees">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">People · {total} on record</div>
          <h1 className="bk-admin-h1">Employees</h1>
          <p className="bk-admin-sub">Search, filter and manage your workforce directory.</p>
        </div>
        <div className="bk-admin-actions">
          <EmployeeExport rows={employees.map((e) => ({ code: e.code, firstName: e.firstName, lastName: e.lastName, department: e.department, position: e.position, hireDate: e.hireDate, status: e.status }))} />
          <Link href="/employees/add" className="bk-btn bk-btn-primary"><UserPlus size={16} /> Add Employee</Link>
        </div>
      </div>

      {/* stats */}
      <div className="bk-admin-kpi-grid" style={{ marginBottom: 24 }}>
        {[
          { label: "Total Employees", value: total, icon: Users, tint: "blue" },
          { label: "Active", value: active, icon: Users, tint: "green" },
          { label: "On Probation", value: probation, icon: Users, tint: "gold" },
          { label: "Departments", value: deptSet.size, icon: Users, tint: "pink" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top">
              <div className={`bk-admin-kpi-icon ${k.tint}`}><k.icon size={20} strokeWidth={1.9} /></div>
            </div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      {/* filter bar */}
      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-content" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ flex: 1, minWidth: 240, position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={16} style={{ position: "absolute", left: 12, color: "var(--bk-ink-3)" }} />
            <input type="search" placeholder="Search by name, code, position…" className="bk-input" style={{ paddingLeft: 38 }} />
          </label>
          <select className="bk-input" style={{ width: 180 }} defaultValue="">
            <option value="">All departments</option>
            {[...deptSet].map((d) => <option key={d}>{d}</option>)}
          </select>
          <select className="bk-input" style={{ width: 160 }} defaultValue="">
            <option value="">All statuses</option>
            <option>Active</option>
            <option>Probation</option>
            <option>Inactive</option>
          </select>
        </div>
      </div>

      {/* directory table */}
      <div className="bk-admin-card">
        <table className="bk-admin-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Code</th>
              <th>Department</th>
              <th>Position</th>
              <th>Hire Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 && (
              <tr><td colSpan={6} className="bk-admin-empty">No employees found. Connect the database and run the seed, or add your first employee.</td></tr>
            )}
            {employees.map((e, i) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/employees/${e.id}`} style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit", textDecoration: "none" }}>
                    <span className={`bk-admin-avatar ${AVATAR_CLASS[i % AVATAR_CLASS.length]}`}>{e.firstName[0]}{e.lastName[0]}</span>
                    <span style={{ fontWeight: 600 }}>{e.firstName} {e.lastName}</span>
                  </Link>
                </td>
                <td className="bk-mono" style={{ color: "var(--bk-ink-3)" }}>{e.code}</td>
                <td><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span className="bk-dot" style={{ background: e.departmentColor }} />{e.department}</span></td>
                <td>{e.position}</td>
                <td>{e.hireDate ? new Date(e.hireDate).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</td>
                <td><span className={`bk-admin-pill ${STATUS_PILL[e.status] ?? "active"}`}>{e.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}