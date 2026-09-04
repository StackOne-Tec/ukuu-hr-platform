import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.id && body.status) {
      await db.leaveRequest.update({
        where: { id: body.id },
        data: { status: body.status, reviewedAt: new Date(), reviewedBy: "Administrator" },
      });
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
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}