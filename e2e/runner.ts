import { readFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { initializeApp, cert, getApps, getApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

/**
 * Per-run fixture namespace + Firestore access for the E2E suite.
 *
 * The app is Firestore-backed (Firebase Auth + Cloud Firestore on project
 * `chat-4f81e`), so fixtures are provisioned with the Admin SDK exactly like
 * the app's own data layer writes them — no raw SQL, no second database.
 * The suite is strictly non-destructive:
 *  - every document this suite creates is namespaced (emails, org slugs,
 *    coupon codes, employee codes) under a unique per-run prefix,
 *  - cleanup deletes ONLY documents carrying this run's marker, scoped per
 *    organization, and the Firebase Auth users created for it,
 *  - demo/shared data is never touched.
 */

export const RUN_PREFIX = `e2e-${Date.now().toString(36)}-`;

export type RunHandle = {
  prefix: string;
  firestore: Firestore;
  /** Raw SQL is gone with the Postgres migration — callers must use the fixture factories. */
  q: <T = any>(text: string, values?: unknown[]) => Promise<T[]>;
  /* ── fixture factories (all namespaced + Firestore-native) ── */
  createOrg: (tag: string) => Promise<{ id: string; slug: string; name: string }>;
  createUser: (tag: string, orgId: string) => Promise<{ id: string; email: string; password: string }>;
  createSession: (userId: string, orgId: string) => Promise<string>;
  createLicense: (orgId: string, plan?: string) => Promise<void>;
  createCoupon: (tag: string, opts?: { plan?: string; status?: string; expiresAt?: Date | null }) => Promise<string>;
  createDepartment: (tag: string, orgId: string) => Promise<string>;
  createEmployee: (
    tag: string,
    orgId: string,
    deptId?: string | null
  ) => Promise<{ id: string; code: string; fullName: string; firstName: string; lastName: string }>;
};

/* Collection names mirror src/lib/db.ts `tables` — the app reads these exact
   collections, so fixtures must land in the same casing. */
const COLLECTIONS = {
  organization: "Organization",
  userAccount: "UserAccount",
  webSession: "WebSession",
  bridgeSession: "BridgeSession",
  licenseCode: "LicenseCode",
  apiKey: "ApiKey",
  coupon: "Coupon",
  department: "Department",
  employee: "Employee",
  attendance: "Attendance",
  attendanceDevice: "AttendanceDevice",
  unifiedClockEvent: "UnifiedClockEvent",
  syncRun: "SyncRun",
  notification: "Notification",
  auditLog: "AuditLog",
  shift: "Shift",
  overtimeRecord: "OvertimeRecord",
  leaveRequest: "LeaveRequest",
  employeeShiftAssignment: "EmployeeShiftAssignment",
  departmentShiftAssignment: "DepartmentShiftAssignment",
  expenseRequest: "ExpenseRequest",
  announcement: "Announcement",
  payrollRun: "PayrollRun",
  payrollItem: "PayrollItem",
  hrConversation: "HrConversation",
  hrMessage: "HrMessage",
  employeeDocument: "EmployeeDocument",
} as const;

/** Every collection that carries an `organizationId` field — used for cleanup
    (UserAccount is handled with its Firebase Auth users). */
const ORG_SCOPED: string[] = Object.values(COLLECTIONS).filter(
  (c) => c !== "Coupon" && c !== "Organization" && c !== "UserAccount"
);

function cuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/** Minimal .env/.env.local loader — Playwright doesn't load dotfiles for us. */
function loadEnvFile(path: string) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      if (process.env[m[1]] !== undefined) continue;
      let value = m[2];
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[m[1]] = value;
    }
  } catch {
    /* file missing — rely on exported env */
  }
}

function resolveServiceAccount(): Record<string, string> {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (inline) return JSON.parse(inline) as Record<string, string>;
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (path) return JSON.parse(readFileSync(path, "utf8")) as Record<string, string>;
  throw new Error(
    "No Firebase credentials configured — set FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS in .env.local"
  );
}

function app(): App {
  if (getApps().length > 0) return getApp();
  const sa = resolveServiceAccount();
  return initializeApp({ credential: cert(sa as Parameters<typeof cert>[0]) });
}

function db(): Firestore {
  return getFirestore(app());
}

const hashToken = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

export function makeContext(): RunHandle {
  const prefix = RUN_PREFIX;
  const createdAt = new Date();

  const q = async <T = any>(): Promise<T[]> => {
    throw new Error(
      "ctx.q (raw SQL) is no longer available — the app runs on Firestore. Use ctx.createOrg/createUser/… instead."
    );
  };

  const createOrg = async (tag: string) => {
    const slug = `${prefix}${tag}`;
    const id = cuid();
    await db()
      .collection(COLLECTIONS.organization)
      .doc(id)
      .set({
        id,
        name: `E2E Org ${tag}`,
        slug,
        email: `${prefix}${tag}@e2e.test`,
        country: "Zambia",
        currency: "ZMW",
        plan: "trial-14d",
        trialEndsAt: null,
        createdAt,
      });
    return { id, slug, name: `E2E Org ${tag}` };
  };

  const createUser = async (tag: string, orgId: string) => {
    const email = `${prefix}${tag}@e2e.test`;
    const password = `${tag}-Passw0rd!`;
    // Firebase Auth owns the credentials (the app verifies via signInWithPassword).
    const record = await getAuth(app()).createUser({ email, password, emailVerified: true });
    const id = record.uid;
    await db()
      .collection(COLLECTIONS.userAccount)
      .doc(id)
      .set({
        id,
        organizationId: orgId,
        name: `E2E User ${tag}`,
        email,
        role: "Admin",
        passwordHash: null,
        isActive: true,
        emailVerified: true,
        createdAt,
      });
    return { id, email, password };
  };

  const createSession = async (userId: string, orgId: string) => {
    // Token format must match src/lib/session.ts (only the sha256 hash is stored).
    const token = `ukuu_ws_${randomBytes(24).toString("hex")}`;
    await db()
      .collection(COLLECTIONS.webSession)
      .doc(cuid())
      .set({
        tokenHash: hashToken(token),
        userId,
        organizationId: orgId,
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt,
      });
    return token;
  };

  const createLicense = async (orgId: string, plan = "Professional") => {
    await db()
      .collection(COLLECTIONS.licenseCode)
      .doc(cuid())
      .set({
        organizationId: orgId,
        code: `${prefix}LIC-${tag7()}`,
        plan,
        status: "Active",
        issuedAt: createdAt,
        activatedAt: createdAt,
      });
  };

  const createCoupon = async (tag: string, opts: { plan?: string; status?: string; expiresAt?: Date | null } = {}) => {
    // The redeem flow (AccessGate input + /api/license/redeem) uppercases the
    // code before the exact-match lookup, so store it fully uppercase.
    const code = `${prefix}${tag.toUpperCase().replace(/[^A-Z0-9-]/g, "")}`.toUpperCase().slice(0, 40);
    await db()
      .collection(COLLECTIONS.coupon)
      .doc(cuid())
      .set({
        code,
        discountPercent: 100,
        plan: opts.plan ?? "Professional",
        status: opts.status ?? "Active",
        expiresAt: opts.expiresAt ?? null,
        createdAt,
      });
    return code;
  };

  const createDepartment = async (tag: string, orgId: string) => {
    const id = cuid();
    await db()
      .collection(COLLECTIONS.department)
      .doc(id)
      .set({ id, organizationId: orgId, name: `E2E Dept ${tag}`, color: "#7B2FBE", createdAt });
    return id;
  };

  const createEmployee = async (tag: string, orgId: string, deptId?: string | null) => {
    const id = cuid();
    // employeeCode must be globally unique — suffix randomness so repeated
    // runs / parallel tags can never collide.
    const code = `E2E-${tag.toUpperCase().slice(0, 12)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const firstName = `E2E${cap(tag).slice(0, 14)}`;
    const lastName = "Worker";
    await db()
      .collection(COLLECTIONS.employee)
      .doc(id)
      .set({
        id,
        organizationId: orgId,
        employeeCode: code,
        firstName,
        lastName,
        email: `${prefix}${tag}@e2e.test`,
        position: "E2E Tester",
        departmentId: deptId ?? null,
        employmentType: "Full-time",
        status: "Active",
        hireDate: new Date(),
        salary: 15000,
        basicSalary: 12000,
        rating: 4,
        createdAt,
      });
    return { id, code, fullName: `${firstName} ${lastName}`, firstName, lastName };
  };

  return {
    prefix,
    firestore: db(),
    q,
    createOrg,
    createUser,
    createSession,
    createLicense,
    createCoupon,
    createDepartment,
    createEmployee,
  };
}

/* ───────────────────────── cleanup ───────────────────────── */

function tag7() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function deleteWhereOrg(fs: Firestore, collection: string, orgId: string): Promise<void> {
  const snap = await fs.collection(collection).where("organizationId", "==", orgId).get();
  await Promise.all(snap.docs.map((d) => d.ref.delete().catch(() => {})));
}

/** Remove every document + Firebase Auth user this run (or a crashed run with
    the same marker shape) created. Safe to call from any process. */
export async function runCleanup(): Promise<void> {
  let appRef: App | null = null;
  try {
    loadEnvFile(".env.local");
    loadEnvFile(".env");
    const inline = process.env.FIREBASE_SERVICE_ACCOUNT;
    const path = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const raw = inline ?? (path ? readFileSync(path, "utf8") : null);
    if (!raw) return;
    appRef = initializeApp({ credential: cert(JSON.parse(raw) as Parameters<typeof cert>[0]) });
  } catch {
    return; // no credentials — nothing to clean
  }

  try {
    const fs = getFirestore(appRef);
    // The suite runs serially (workers: 1) against a dedicated `e2e-` namespace,
    // and RUN_PREFIX is computed per process — so global-setup/teardown can't
    // know the test workers' exact prefix. Clean everything this suite could
    // have created: orgs whose slug starts with the namespace marker.
    const like = "e2e-";
    // Organizations created by this suite carry the run prefix in their slug.
    const orgSnap = await fs
      .collection(COLLECTIONS.organization)
      .where("slug", ">=", like)
      .where("slug", "<", `${like}\uf8ff`)
      .get();
    const orgIds = orgSnap.docs.map((d) => d.id);

    for (const orgId of orgIds) {
      // Firebase Auth users first — before their UserAccount docs are removed.
      const users = await fs.collection(COLLECTIONS.userAccount).where("organizationId", "==", orgId).get();
      for (const doc of users.docs) {
        await getAuth(appRef).deleteUser(doc.id).catch(() => {});
      }
      // Every org-scoped child document (Firestore has no FKs — order is irrelevant).
      for (const collection of ORG_SCOPED) {
        await deleteWhereOrg(fs, collection, orgId);
      }
      await fs.collection(COLLECTIONS.userAccount).where("organizationId", "==", orgId).get()
        .then((snap) => Promise.all(snap.docs.map((d) => d.ref.delete().catch(() => {}))));
      await fs.collection(COLLECTIONS.organization).doc(orgId).delete().catch(() => {});
    }

    // Coupons have no org id — they are namespaced by code prefix (stored
    // uppercase because the redeem flow uppercases input before lookup).
    const couponLike = "E2E-";
    const couponSnap = await fs
      .collection(COLLECTIONS.coupon)
      .where("code", ">=", couponLike)
      .where("code", "<", `${couponLike}\uf8ff`)
      .get();
    await Promise.all(couponSnap.docs.map((d) => d.ref.delete().catch(() => {})));
  } finally {
    await getFirestore(appRef).terminate().catch(() => {});
  }
}