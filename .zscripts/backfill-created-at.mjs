#!/usr/bin/env node
/**
 * Backfill `createdAt` on existing Firestore documents.
 *
 * Why: before src/lib/db.ts stamped `createdAt` on every write, documents
 * created through the Firestore proxy had no `createdAt` field. Firestore's
 * `orderBy("createdAt")` silently excludes documents missing that field, so
 * those rows (coupons, organizations, users, …) never appear in admin lists
 * sorted by createdAt. This script fills the gap using Firestore's own
 * server-side `createTime`, which is recorded when the document was created.
 *
 * Usage (from project root):
 *   node --env-file=.env.local --env-file=.env .zscripts/backfill-created-at.mjs
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT.
 * Safe to re-run: documents that already have a createdAt are left untouched.
 */
import { readFileSync } from "node:fs";
import { initializeApp, cert, getApps, getApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

/* Keep in sync with the `tables` map in src/lib/db.ts. */
const COLLECTIONS = [
  "Organization", "ApiKey", "SyncRun", "WebSession", "BridgeSession",
  "UserAccount", "Branch", "Department", "Employee", "Attendance",
  "LeaveType", "LeaveRequest", "LeaveHoliday", "PayrollRun", "PayrollItem",
  "Shift", "EmployeeShiftAssignment", "DepartmentShiftAssignment",
  "AttendanceTolerance", "OvertimeRecord", "AttendanceDevice",
  "UnifiedClockEvent", "HikvisionDevice", "HikvisionClockEvent",
  "EmployeeDocument", "HrPolicy", "HrConversation", "HrMessage", "AuditLog",
  "LicenseCode", "Coupon", "ExpenseRequest", "Notification",
  "PendingRegistration", "JobOpening", "Candidate", "Announcement",
];

function serviceAccount() {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) {
    try { return JSON.parse(inline); } catch { /* fall through */ }
  }
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) return JSON.parse(readFileSync(path, "utf8"));
  return null;
}

function app() {
  if (getApps().length > 0) return getApp();
  const creds = serviceAccount();
  if (!creds) throw new Error("Set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS first.");
  return initializeApp({ credential: cert(creds), projectId: creds.project_id });
}

async function main() {
  const fs = getFirestore(app());
  let total = 0;

  for (const name of COLLECTIONS) {
    const collection = fs.collection(name);
    const probe = await collection.limit(1).get();
    if (probe.empty) continue; // collection doesn't exist (yet)

    const missing = [];
    const stream = collection.stream();
    for await (const doc of stream) {
      const data = doc.data();
      if (data.createdAt === undefined || data.createdAt === null) {
        missing.push({ id: doc.id, createTime: doc.createTime?.toDate?.() ?? new Date() });
      }
    }

    if (!missing.length) {
      console.log(`${name.padEnd(24)} ok — all ${probe.size >= 0 ? "docs" : "docs"} have createdAt`);
      continue;
    }

    // Write in batches of 400 to stay under Firestore's 500-op write limit.
    for (let i = 0; i < missing.length; i += 400) {
      const batch = fs.batch();
      for (const row of missing.slice(i, i + 400)) {
        batch.update(collection.doc(row.id), { createdAt: row.createTime });
      }
      await batch.commit();
    }
    console.log(`${name.padEnd(24)} backfilled createdAt on ${missing.length} doc(s)`);
    total += missing.length;
  }

  console.log(`\nDone — ${total} document(s) backfilled.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});