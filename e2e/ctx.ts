import { makeContext, RUN_PREFIX, runCleanup, type RunHandle } from "./runner";

/**
 * Shared test context: Firestore (Admin SDK) + a unique run namespace.
 *
 * The app's data lives in Cloud Firestore (Firebase project chat-4f81e), so
 * fixtures are provisioned with the Admin SDK and namespaced under a unique
 * `e2e-<run>` prefix. Cleanup (global-setup / global-teardown) removes only
 * documents and Firebase Auth users belonging to this run's namespace —
 * shared/demo data is never touched.
 */
export const ctx: RunHandle = makeContext();
export { RUN_PREFIX };
export type { RunHandle };