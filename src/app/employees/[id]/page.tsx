import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getEmployeeDetail } from "@/lib/queries";
import { Pencil, Mail, Phone, MapPin } from "lucide-react";

export const metadata: Metadata = { title: "Employee · Ukuu HR" };

const STATUS_PILL: Record<string, string> = { Active: "active", Probation: "probation", Inactive: "inactive" };

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const res = await getEmployeeDetail(id);
  if (!res.data) notFound();
  const e = res.data;

  return (
    <AdminShell activeKey="employees">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">{e.code} · {e.department}</div>
          <h1 className="bk-admin-h1">{e.firstName} {e.lastName}</h1>
          <p className="bk-admin-sub">{e.position}</p>
        </div>
        <div className="bk-admin-actions">
          <Link href={`/employees/${e.id}/edit`} className="bk-btn bk-btn-primary"><Pencil size={16} /> Edit Employee</Link>
        </div>
      </div>

      <div className="bk-admin-grid-2" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Profile</h3><span className={`bk-admin-pill ${STATUS_PILL[e.status] ?? "active"}`}>{e.status}</span></div>
          <div className="bk-admin-card-content" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              ["Employee Code", e.code], ["Department", e.department], ["Employment Type", e.employmentType],
              ["Hire Date", e.hireDate ? new Date(e.hireDate).toLocaleDateString() : "—"], ["Basic Salary", `ZMW ${e.basicSalary.toLocaleString()}`],
              ["Rating", `${e.rating}/5`], ["NRC", e.nrc || "—"], ["TPIN", e.tpin || "—"],
              ["Gender", e.gender || "—"], ["Marital Status", e.maritalStatus || "—"],
              ["Date of Birth", e.dateOfBirth ? new Date(e.dateOfBirth).toLocaleDateString() : "—"], ["Address", e.address || "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="bk-muted-text" style={{ textTransform: "uppercase", letterSpacing: ".04em", fontFamily: "var(--font-mono), monospace", fontSize: 10, fontWeight: 700 }}>{k}</div>
                <div style={{ marginTop: 4, fontWeight: 600, fontSize: 13.5 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="bk-admin-card">
            <div className="bk-admin-card-header"><h3>Contact</h3></div>
            <div className="bk-admin-card-content" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}><Mail size={16} style={{ color: "var(--bk-ink-3)" }} />{e.email}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}><Phone size={16} style={{ color: "var(--bk-ink-3)" }} />{e.phone || "—"}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}><MapPin size={16} style={{ color: "var(--bk-ink-3)" }} />{e.address || "—"}</span>
            </div>
          </div>
          <div className="bk-admin-card">
            <div className="bk-admin-card-header"><h3>Banking</h3></div>
            <div className="bk-admin-card-content" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><div className="bk-muted-text">Bank</div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.bankName || "—"}</div></div>
              <div><div className="bk-muted-text">Account</div><div style={{ fontWeight: 600, fontSize: 13.5 }} className="bk-mono">{e.bankAccountNumber || "—"}</div></div>
              <div><div className="bk-muted-text">Branch</div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{e.bankBranch || "—"}</div></div>
            </div>
          </div>
        </div>
      </div>

      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-header"><h3>Recent Leave</h3><Link href="/leave" className="bk-btn-text">View all</Link></div>
        <table className="bk-admin-table">
          <thead><tr><th>Type</th><th>Start</th><th>End</th><th>Status</th></tr></thead>
          <tbody>
            {e.leaveRequests.length === 0 && <tr><td colSpan={4} className="bk-admin-empty">No leave requests.</td></tr>}
            {e.leaveRequests.map((l) => (
              <tr key={l.id}>
                <td>{l.type}</td>
                <td>{l.startDate ? new Date(l.startDate).toLocaleDateString() : "—"}</td>
                <td>{l.endDate ? new Date(l.endDate).toLocaleDateString() : "—"}</td>
                <td><span className={`bk-admin-pill ${l.status.toLowerCase()}`}>{l.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Recent Attendance</h3><Link href="/attendance" className="bk-btn-text">View all</Link></div>
        <table className="bk-admin-table">
          <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Hours</th><th>Status</th></tr></thead>
          <tbody>
            {e.attendances.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No attendance records.</td></tr>}
            {e.attendances.map((a) => (
              <tr key={a.id}>
                <td>{a.date ? new Date(a.date).toLocaleDateString() : "—"}</td>
                <td>{a.checkIn}</td><td>{a.checkOut}</td>
                <td>{a.hours}h</td>
                <td><span className={`bk-admin-pill ${a.status.toLowerCase() === "late" ? "gold" : a.status.toLowerCase() === "absent" ? "inactive" : a.status.toLowerCase() === "onleave" ? "info" : "active"}`}>{a.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}