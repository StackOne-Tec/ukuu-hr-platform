import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg } from "@/lib/session";

export const dynamic = "force-dynamic";

const DB_DOWN = "The database is temporarily unreachable. Please try again in a moment.";

/*
 * GET /api/notifications — recent in-app notifications + unread count.
 * POST /api/notifications — mark all notifications as read.
 */
export async function GET() {
  try {
    const org = await currentOrg();
    if (!org?.id) return NextResponse.json({ ok: true, unread: 0, items: [] });

    const [items, unread] = await Promise.all([
      db.notification.findMany({
        where: { organizationId: org.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.notification.count({ where: { organizationId: org.id, read: false } }),
    ]);

    return NextResponse.json({
      ok: true,
      unread,
      items: items.map((n) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        read: n.read,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch {
    return NextResponse.json({ ok: true, unread: 0, items: [], dbDown: true, error: DB_DOWN });
  }
}

export async function POST() {
  try {
    const org = await currentOrg();
    if (org?.id) {
      await db.notification.updateMany({ where: { organizationId: org.id, read: false }, data: { read: true } });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, error: DB_DOWN }, { status: 503 });
  }
}