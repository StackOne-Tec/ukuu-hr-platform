import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateApiKey, apiErrorMessage, scopeAllows } from "@/lib/apikey";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const auth = await authenticateApiKey(req);
    if (!auth) {
      return NextResponse.json({ ok: false, error: "Missing or invalid API key." }, { status: 401 });
    }
    if (!scopeAllows(auth.key.scopes, "payroll")) {
      return NextResponse.json({ ok: false, error: "This API key does not include the payroll scope." }, { status: 403 });
    }

    const runs = await db.payrollRun.findMany({
      where: { organizationId: auth.organizationId },
      include: { items: true },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      take: 12,
    });

    const money = (n: number) => Math.round(n * 100) / 100;
    return NextResponse.json({
      ok: true,
      count: runs.length,
      runs: runs.map((r) => ({
        id: r.id,
        period: `${r.periodYear}-${String(r.periodMonth).padStart(2, "0")}`,
        status: r.status,
        employees: r.items.length,
        totalGross: money(r.items.reduce((s, i) => s + i.gross, 0)),
        totalNet: money(r.items.reduce((s, i) => s + i.net, 0)),
        totalPaye: money(r.items.reduce((s, i) => s + i.paye, 0)),
        approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      })),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: apiErrorMessage(e, "API temporarily unavailable.") }, { status: 503 });
  }
}