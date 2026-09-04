import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (body.id && body.status) {
      await db.overtimeRecord.update({
        where: { id: body.id },
        data: { status: body.status, reviewedAt: new Date(), reviewedBy: "Administrator" },
      });
      return NextResponse.json({ ok: true });
    }
    const org = await db.organization.findFirst({ where: { slug: "ukuuhr-demo" } });
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
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}