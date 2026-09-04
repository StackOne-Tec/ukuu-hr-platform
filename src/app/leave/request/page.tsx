import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getLeave, getEmployees } from "@/lib/queries";
import LeaveRequestForm from "@/components/leave/LeaveRequestForm";

export const metadata: Metadata = { title: "New Leave Request · Ukuu HR" };

export default async function LeaveRequestPage() {
  const [leaveRes, empRes] = await Promise.all([getLeave(), getEmployees()]);
  return (
    <AdminShell activeKey="leave">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Leave · new request</div>
          <h1 className="bk-admin-h1">New Leave Request</h1>
          <p className="bk-admin-sub">Submit a request — it enters the approval workflow.</p>
        </div>
      </div>
      <LeaveRequestForm
        types={leaveRes.data.types}
        employees={empRes.data.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
      />
    </AdminShell>
  );
}