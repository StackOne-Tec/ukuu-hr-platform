import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getEmployees } from "@/lib/queries";
import OvertimeForm from "@/components/overtime/OvertimeForm";

export const metadata: Metadata = { title: "Add Overtime · Ukuu HR" };

export default async function AddOvertimePage() {
  const res = await getEmployees();
  return (
    <AdminShell activeKey="overtime">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Overtime · new record</div>
          <h1 className="bk-admin-h1">Add Overtime</h1>
          <p className="bk-admin-sub">Record overtime hours for classification and approval.</p>
        </div>
      </div>
      <OvertimeForm employees={res.data.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))} />
    </AdminShell>
  );
}