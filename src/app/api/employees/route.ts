import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const org = await currentOrg();
    // Tenant isolation: an update must reference a record owned by the session's organization.
    if (body.id) {
      const existing = await db.employee.findUnique({ where: { id: body.id } });
      if (!existing || existing.organizationId !== (org?.id ?? null)) {
        return NextResponse.json({ ok: false, error: "Employee not found" }, { status: 404 });
      }
    }
    const data = {
      organizationId: org?.id ?? null,
      employeeCode: body.employeeCode || `UKU-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email,
      phone: body.phone ?? null,
      position: body.position,
      departmentId: body.departmentId ?? null,
      employmentType: body.employmentType ?? "Full-time",
      status: body.status ?? "Active",
      hireDate: body.hireDate ? new Date(body.hireDate) : new Date(),
      salary: Number(body.salary ?? 0),
      basicSalary: Number(body.basicSalary ?? body.salary ?? 0),
      nrc: body.nrc ?? null,
      tpin: body.tpin ?? null,
      bankName: body.bankName ?? null,
      bankAccountNumber: body.bankAccountNumber ?? null,
      bankBranch: body.bankBranch ?? null,
      gender: body.gender ?? null,
      maritalStatus: body.maritalStatus ?? null,
      dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
      address: body.address ?? null,
      emergencyContact: body.emergencyContact ?? null,
    };
    const employee = body.id
      ? await db.employee.update({ where: { id: body.id }, data })
      : await db.employee.create({ data });
    await db.auditLog
      .create({
        data: {
          organizationId: org?.id ?? null,
          userName: "Administrator",
          action: body.id ? "Employee.Update" : "Employee.Create",
          entityType: "Employee",
          entityId: employee.id,
          details: `${employee.firstName} ${employee.lastName} (${employee.employeeCode})`,
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true, id: employee.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed to save employee" }, { status: 500 });
  }
}