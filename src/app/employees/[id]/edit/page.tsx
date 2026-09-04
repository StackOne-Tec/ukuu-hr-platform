import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import EmployeeForm from "@/components/employees/EmployeeForm";
import { getEmployeeDetail, getSettings } from "@/lib/queries";

export const metadata: Metadata = { title: "Edit Employee · Ukuu HR" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [empRes, settingsRes] = await Promise.all([getEmployeeDetail(id), getSettings()]);
  const e = empRes.data;
  if (!e) notFound();

  return (
    <AdminShell activeKey="employees">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">People · Edit record</div>
          <h1 className="bk-admin-h1">{e.firstName} {e.lastName}</h1>
          <p className="bk-admin-sub">{e.position}</p>
        </div>
      </div>
      <EmployeeForm
        departments={settingsRes.data.departments}
        initialData={{
          id: e.id,
          employeeCode: e.code,
          firstName: e.firstName,
          lastName: e.lastName,
          email: e.email,
          phone: e.phone,
          position: e.position,
          status: e.status,
          hireDate: e.hireDate ? e.hireDate.slice(0, 10) : "",
          salary: e.salary,
          basicSalary: e.basicSalary,
          nrc: e.nrc,
          tpin: e.tpin,
          bankName: e.bankName,
          bankAccountNumber: e.bankAccountNumber,
          bankBranch: e.bankBranch,
          gender: e.gender,
          maritalStatus: e.maritalStatus,
          dateOfBirth: e.dateOfBirth ? e.dateOfBirth.slice(0, 10) : "",
          address: e.address,
          emergencyContact: e.emergencyContact,
        }}
      />
    </AdminShell>
  );
}