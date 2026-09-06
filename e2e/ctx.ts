import { Pool } from "pg";
import { makeContext, RUN_PREFIX, runCleanup, type RunHandle } from "./runner";

/**
 * Shared test context: a pg pool + unique run namespace.
 *
 * The app's DATABASE_URL points at the shared Render PostgreSQL, so the suite
 * is strictly non-destructive: fixtures are created with e2e-prefixed
 * identifiers and only rows matching this run's namespace are deleted
 * (global-setup clears stale runs, global-teardown clears this one).
 */
export const ctx: RunHandle = makeContext();
export { RUN_PREFIX };
export type { RunHandle };
