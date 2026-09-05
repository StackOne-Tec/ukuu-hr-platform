import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createNotification } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.id && body.status) {
      const prev = await db.leaveRequest.findUnique({ where: { id: body.id } });
      await db.leaveRequest.update({
        where: { id: body.id },
        data: { status: body.status, reviewedAt: new Date(), reviewedBy: "Administrator" },
      });
      await db.auditLog
        .create({
          data: {
            organizationId: prev?.organizationId ?? null,
            userName: "Administrator",
            action: body.status === "Approved" ? "Leave.Approve" : "Leave.Reject",
            entityType: "LeaveRequest",
            entityId: body.id,
            details: `${body.status} (${prev?.type ?? "?"}, ${prev?.daysUsed ?? "?"} day(s) from ${prev?.startDate ? new Date(prev.startDate).toISOString().slice(0, 10) : "?"})`,
          },
        })
        .catch(() => {});
      return NextResponse.json({ ok: true });
    }
    // create new leave request
    const org = await db.organization.findFirst({ where: { slug: "ukuuhr-demo" } });
    const start = new Date(body.startDate);
    const end = new Date(body.endDate);
    const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
    const created = await db.leaveRequest.create({
      data: {
        organizationId: org?.id ?? null,
        employeeId: body.employeeId,
        type: body.type,
        startDate: start,
        endDate: end,
        daysUsed: Math.max(1, days),
        status: "Pending",
        reason: body.reason ?? null,
      },
    });
    const emp = await db.employee
      .findUnique({ where: { id: body.employeeId }, select: { firstName: true, lastName: true } })
      .catch(() => null);
    await createNotification({
      organizationId: org?.id ?? null,
      title: "Leave request pending approval",
      message: `${emp ? `${emp.firstName} ${emp.lastName}` : "An employee"} requested ${Math.max(1, days)} day(s) of ${body.type} starting ${start.toISOString().slice(0, 10)}.`,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}