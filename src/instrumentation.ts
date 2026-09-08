/**
 * Next.js server bootstrap hook — runs once when the server starts (dev,
 * `next start`, and the standalone production server).
 *
 * All database bootstrap logic (Render hostname self-heal, schema
 * migrations, fresh-deployment provisioning) lives in
 * ./instrumentation-register and is loaded ONLY in the Node.js runtime —
 * never in the Edge runtime, where node: modules are unavailable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootstrapDatabase } = await import("./instrumentation-register");
    await bootstrapDatabase();
  }
}
