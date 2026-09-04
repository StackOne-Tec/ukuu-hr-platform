import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const org = await db.organization.findFirst({ where: { slug: "ukuuhr-demo" } });
    const created = await db.attendanceDevice.create({
      data: {
        organizationId: org?.id ?? null,
        name: body.name,
        vendor: body.vendor ?? "Hikvision",
        model: body.model ?? null,
        ipAddress: body.ipAddress ?? null,
        port: Number(body.port ?? 80),
        integrationMode: body.integrationMode ?? "REST",
        status: "Online",
        autoSyncEnabled: Boolean(body.autoSyncEnabled),
        syncIntervalMinutes: Number(body.syncIntervalMinutes ?? 30),
      },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}