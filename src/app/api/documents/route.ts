import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const org = await currentOrg();
    const created = await db.employeeDocument.create({
      data: {
        organizationId: org?.id ?? null,
        title: body.title,
        category: body.category ?? "Contract",
        fileName: body.fileName ?? `${body.title.toLowerCase().replace(/\s+/g, "-")}.pdf`,
        fileType: "application/pdf",
      },
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Failed" }, { status: 500 });
  }
}