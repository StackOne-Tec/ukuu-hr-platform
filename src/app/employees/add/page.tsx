import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import EmployeeForm from "@/components/employees/EmployeeForm";
import { getSettings } from "@/lib/queries";

export const metadata: Metadata = { title: "Add Employee · Ukuu HR" };

export default async function AddEmployeePage() {
  const res = await getSettings();
  return (
    <AdminShell activeKey="employees">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">People · New record</div>
          <h1 className="bk-admin-h1">Add Employee</h1>
          <p className="bk-admin-sub">Personal → Employment → Banking → Tax &amp; Statutory</p>
        </div>
      </div>
      <EmployeeForm departments={res.data.departments} />
    </AdminShell>
  );
}