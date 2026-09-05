import "server-only";
import { db } from "@/lib/db";

/**
 * Create an in-app notification for an organization's administrators.
 * Failures are swallowed so notifications never break the triggering action.
 */
export async function createNotification(opts: {
  organizationId: string | null;
  title: string;
  message: string;
}) {
  if (!opts.organizationId) return null;
  return db.notification
    .create({
      data: {
        organizationId: opts.organizationId,
        title: opts.title,
        message: opts.message,
      },
    })
    .catch(() => null);
}