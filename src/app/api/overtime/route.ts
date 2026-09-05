import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const org = await currentOrg();
    if (body.id && body.status) {
      const prev = await db.overtimeRecord.findUnique({ where: { id: body.id } });
      // Tenant isolation: only the owning organization may review a record.
      if (!prev || prev.organizationId !== (org?.id ?? null)) {
        return NextResponse.json({ ok: false, error: "Overtime record not found" }, { status: 404 });
      }
      await db.overtimeRecord.update({
        where: { id: body.id },
        data: { status: body.status, reviewedAt: new Date(), reviewedBy: "Administrator" },
      });
      await db.auditLog
        .create({
          data: {
            organizationId: prev?.organizationId ?? null,
            userName: "Administrator",
            action: body.status === "Approved" ? "Overtime.Approve" : "Overtime.Reject",
            entityType: "OvertimeRecord",
            entityId: body.id,
            details: `${body.status} (${prev?.hours ?? "?"}h on ${prev?.date ? new Date(prev.date).toISOString().slice(0, 10) : "?"})`,
          },
        })
        .catch(() => {});
      return NextResponse.json({ ok: true });
    }
    const created = await db.overtimeRecord.create({
      data: {
        organizationId: org?.id ?? null,
        employeeId: body.employeeId,
        date: new Date(body.date),
        hours: Number(body.hours),
        rateType: body.rateType ?? "Standard",
        status: "Pending",
        reason: body.reason ?? null,
      },
    });
    const emp = await db.employee
      .findUnique({ where: { id: body.employeeId }, select: { firstName: true, lastName: true } })
      .catch(() => null);
    await createNotification({
      organizationId: org?.id ?? null,
      title: "Overtime pending approval",
      message: `${emp ? `${emp.firstName} ${emp.lastName}` : "An employee"} submitted ${body.hours}h overtime for ${new Date(body.date).toISOString().slice(0, 10)}.`,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}