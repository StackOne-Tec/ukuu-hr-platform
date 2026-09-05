import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";

export const dynamic = "force-dynamic";

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const optionalText = (value: unknown): string | null => text(value) || null;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const required = [
      ["firstName", "First name"],
      ["lastName", "Last name"],
      ["email", "Email"],
      ["position", "Position / job title"],
    ] as const;
    const missing = required.find(([key]) => !text(body[key]));
    if (missing) {
      return NextResponse.json({ ok: false, error: `${missing[1]} is required` }, { status: 400 });
    }

    const hireDate = body.hireDate ? new Date(body.hireDate) : new Date();
    if (Number.isNaN(hireDate.getTime())) {
      return NextResponse.json({ ok: false, error: "Please enter a valid hire date" }, { status: 400 });
    }
    const dateOfBirth = body.dateOfBirth ? new Date(body.dateOfBirth) : null;
    if (dateOfBirth && Number.isNaN(dateOfBirth.getTime())) {
      return NextResponse.json({ ok: false, error: "Please enter a valid date of birth" }, { status: 400 });
    }

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
      employeeCode: text(body.employeeCode) || `UKU-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      firstName: text(body.firstName),
      lastName: text(body.lastName),
      email: text(body.email),
      phone: optionalText(body.phone),
      position: text(body.position),
      // An unselected HTML <select> submits ""; nullable foreign keys must receive null.
      departmentId: optionalText(body.departmentId),
      employmentType: text(body.employmentType) || "Full-time",
      status: text(body.status) || "Active",
      hireDate,
      salary: Number.isFinite(Number(body.salary)) ? Number(body.salary) : 0,
      basicSalary: Number.isFinite(Number(body.basicSalary ?? body.salary)) ? Number(body.basicSalary ?? body.salary) : 0,
      nrc: optionalText(body.nrc),
      tpin: optionalText(body.tpin),
      bankName: optionalText(body.bankName),
      bankAccountNumber: optionalText(body.bankAccountNumber),
      bankBranch: optionalText(body.bankBranch),
      gender: optionalText(body.gender),
      maritalStatus: optionalText(body.maritalStatus),
      dateOfBirth,
      address: optionalText(body.address),
      emergencyContact: optionalText(body.emergencyContact),
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