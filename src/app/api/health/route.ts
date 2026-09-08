import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Classify a connection failure into a short, non-sensitive hint so the
 * deployment's database problem is diagnosable from the health endpoint
 * (no hosts, users, or raw driver messages are ever exposed — only a label).
 */
function classify(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const msg = e?.message ?? "";
  const code = e?.code ?? "";
  if (code === "ENOTFOUND" || /getaddrinfo|ENOTFOUND/i.test(msg)) return "dns";
  if (code === "EAI_AGAIN") return "dns-temporary";
  if (code === "ECONNREFUSED") return "refused";
  if (code === "ETIMEDOUT" || /timeout/i.test(msg)) return "timeout";
  if (code === "ECONNRESET") return "reset";
  if (code === "28P01" || /password authentication failed/i.test(msg)) return "auth";
  if (code === "28000" || /no pg_hba/i.test(msg)) return "rejected";
  if (/database .* does not exist/i.test(msg)) return "missing";
  if (/too many connections/i.test(msg)) return "limit";
  return "unreachable";
}

export async function GET() {
  let database = "unavailable";
  let hint: string | undefined;
  try {
    await db.$queryRaw`SELECT 1`;
    database = "connected";
  } catch (err) {
    // Database unreachable: the app itself is still healthy,
    // report database state (with a classified hint) for observability.
    hint = classify(err);
  }
  return NextResponse.json({
    status: "ok",
    database,
    ...(hint ? { databaseHint: hint } : {}),
    timestamp: new Date().toISOString(),
  });
}
