import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { currentOrg, requireVerifiedEmail } from "@/lib/session";
import { generateApiKey, hashApiKey, lastFour, maskApiKey, scopesToLabels } from "@/lib/apikey";
import { dbErrorMessage, logDbError } from "@/lib/db-error";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Ctx) {
  const gate = await requireVerifiedEmail();
  if (!gate.verified) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  try {
    const { id } = await params;
    const existing = await db.apiKey.findUnique({ where: { id } });
    const org = await currentOrg();
    // Tenant isolation: only the owning organization may rotate its keys.
    if (!existing || existing.organizationId !== (org?.id ?? null)) {
      return NextResponse.json({ ok: false, error: "API key not found" }, { status: 404 });
    }

    const key = generateApiKey();
    const rotated = await db.apiKey.update({
      where: { id },
      data: {
        keyHash: hashApiKey(key),
        lastFour: lastFour(key),
        rotatedAt: new Date(),
        isActive: true,
        lastUsedAt: null,
      },
    });
    await db.auditLog
      .create({
        data: {
          organizationId: rotated.organizationId ?? null,
          userName: "Administrator",
          action: "ApiKey.Rotate",
          entityType: "ApiKey",
          entityId: rotated.id,
          details: rotated.name,
        },
      })
      .catch(() => {});
    return NextResponse.json({
      ok: true,
      id: rotated.id,
      name: rotated.name,
      masked: maskApiKey(key),
      // full key returned exactly once — never persisted
      key,
      scopes: rotated.scopes,
      scopeLabels: scopesToLabels(rotated.scopes),
      rotatedAt: rotated.rotatedAt?.toISOString() ?? null,
    });
  } catch (e) {
    logDbError(e, "settings.api-keys.rotate");
    return NextResponse.json({ ok: false, error: dbErrorMessage(e), dbDown: true }, { status: 503 });
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const gate = await requireVerifiedEmail();
  if (!gate.verified) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }
  try {
    const { id } = await params;
    const existing = await db.apiKey.findUnique({ where: { id } });
    const org = await currentOrg();
    // Tenant isolation: only the owning organization may revoke its keys.
    if (!existing || existing.organizationId !== (org?.id ?? null)) {
      return NextResponse.json({ ok: false, error: "API key not found" }, { status: 404 });
    }
    await db.apiKey.update({ where: { id }, data: { isActive: false } });
    await db.auditLog
      .create({
        data: {
          organizationId: existing.organizationId ?? null,
          userName: "Administrator",
          action: "ApiKey.Delete",
          entityType: "ApiKey",
          entityId: existing.id,
          details: existing.name,
        },
      })
      .catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    logDbError(e, "settings.api-keys.delete");
    return NextResponse.json({ ok: false, error: dbErrorMessage(e), dbDown: true }, { status: 503 });
  }
}