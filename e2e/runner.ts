import { Pool } from "pg";

/**
 * Per-run fixture namespace + database access for the E2E suite.
 *
 * The app talks to a live shared PostgreSQL (Render), so this suite is
 * strictly non-destructive:
 *  - every row this suite creates is namespaced (emails, org slugs, coupon
 *    codes, employee/department names) under a unique per-run prefix,
 *  - cleanup deletes ONLY rows carrying this run's marker, in
 *    foreign-key-safe order,
 *  - demo/shared data is never touched.
 */

export const RUN_PREFIX = `e2e-${Date.now().toString(36)}-`;

export type RunHandle = {
  prefix: string;
  pool: Pool;
  /** Raw SQL helper (parameterized). */
  q: <T = any>(text: string, values?: unknown[]) => Promise<T[]>;
  /* ── fixture factories (all namespaced + tracked) ── */
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

function cuid(): string {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  // Same intent as src/lib/db-url.ts: force the sslmode pg expects.
  if (/[?&]sslmode=/.test(raw)) return raw;
  return raw.includes("?") ? `${raw}&sslmode=require` : `${raw}?sslmode=require`;
}

export function makeContext(): RunHandle {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!connectionString) throw new Error("DATABASE_URL is not set — cannot run E2E suite");

  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: { rejectUnauthorized: false },
  });

  const q = async <T = any>(text: string, values: unknown[] = []): Promise<T[]> => {
    const res = await pool.query(text, values);
    return res.rows as T[];
  };

  const prefix = RUN_PREFIX;
  const createdAt = new Date().toISOString();

  /**
   * Teardown: delete exactly this run's rows, children before parents.
   * Every statement is scoped by the run marker so shared/demo data is safe.
   */
  const cleanup = async () => {
    const steps: string[] = [
      // session + token tables reference users/orgs
      `DELETE FROM "WebSession" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "BridgeSession" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      // license + api keys are org-scoped
      `DELETE FROM "LicenseCode" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "ApiKey" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      // notifications + audit entries created by the flows
      `DELETE FROM "Notification" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "AuditLog" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "AuditLog" WHERE "entityType" = 'Coupon' AND "entityId" IN (SELECT id FROM "Coupon" WHERE code ILIKE $2)`,
      // HR messaging + documents created for e2e employees
      `DELETE FROM "HrMessage" WHERE "conversationId" IN (SELECT c.id FROM "HrConversation" c JOIN "Organization" o ON o.id = c."organizationId" WHERE o.slug LIKE $1)`,
      `DELETE FROM "HrConversation" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "EmployeeDocument" WHERE "employeeId" IN (SELECT e.id FROM "Employee" e JOIN "Organization" o ON o.id = e."organizationId" WHERE o.slug LIKE $1)`,
      // workforce children
      `DELETE FROM "Attendance" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "OvertimeRecord" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "LeaveRequest" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "EmployeeShiftAssignment" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "DepartmentShiftAssignment" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "AttendanceDevice" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "UnifiedClockEvent" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "ExpenseRequest" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "Announcement" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      // payroll children reference employees via codes, delete before employees
      `DELETE FROM "PayrollItem" WHERE "payrollRunId" IN (SELECT p.id FROM "PayrollRun" p JOIN "Organization" o ON o.id = p."organizationId" WHERE o.slug LIKE $1)`,
      `DELETE FROM "PayrollRun" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      // employees before departments
      `DELETE FROM "Employee" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "Department" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      // license/coupons: license rows already gone; clear redemption state
      `UPDATE "Coupon" SET "redeemedByOrgId" = NULL, "redeemedByOrgName" = NULL WHERE code ILIKE $2`,
      `DELETE FROM "Coupon" WHERE code ILIKE $2`,
      // shift definitions are org-scoped too
      `DELETE FROM "Shift" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      // finally the tenant itself + its accounts
      `DELETE FROM "UserAccount" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`,
      `DELETE FROM "Organization" WHERE slug LIKE $1`,
    ];
    for (const sql of steps) {
      await q(sql, [`${prefix}%`, `${prefix}%`]).catch(() => {
        /* table may not exist on a fresh schema — skip */
      });
    }
  };

  // Stale runs are cleared by global-setup (runCleanup); this context only
  // creates fixtures.

  const createOrg = async (tag: string) => {
    const slug = `${prefix}${tag}`;
    const id = cuid();
    await q(
      `INSERT INTO "Organization" (id, name, slug, email, country, currency, plan, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)`,
      [id, `E2E Org ${tag}`, slug, `${prefix}${tag}@e2e.test`, "Zambia", "ZMW", "trial-14d", createdAt]
    );
    return { id, slug, name: `E2E Org ${tag}` };
  };

  const createUser = async (tag: string, orgId: string) => {
    const email = `${prefix}${tag}@e2e.test`;
    const password = `${tag}-Passw0rd!`;
    const id = cuid();
    await q(
      `INSERT INTO "UserAccount" (id, "organizationId", name, email, role, "passwordHash", "isActive", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, $7, $7)`,
      [id, orgId, `E2E User ${tag}`, email, "Admin", password, createdAt]
    );
    return { id, email, password };
  };

  const createSession = async (userId: string, orgId: string) => {
    // Token format must match src/lib/session.ts (hashed with sha256 before storage).
    const { createHash } = await import("node:crypto");
    const token = `ukuu_ws_${createHash("sha256").update(String(Math.random())).digest("hex").slice(0, 24)}`;
    const tokenHash = createHash("sha256").update(token, "utf8").digest("hex");
    await q(
      `INSERT INTO "WebSession" (id, "tokenHash", "userId", "organizationId", "expiresAt", "createdAt")
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [cuid(), tokenHash, userId, orgId, new Date(Date.now() + 3600_000), createdAt]
    );
    return token;
  };

  const createLicense = async (orgId: string, plan = "Professional") => {
    await q(
      `INSERT INTO "LicenseCode" (id, "organizationId", code, plan, status, "issuedAt", "activatedAt")
       VALUES ($1, $2, $3, $4, 'Active', $5, $5)`,
      [cuid(), orgId, `${prefix}LIC-${tag7()}`, plan, createdAt]
    );
  };

  const createCoupon = async (tag: string, opts: { plan?: string; status?: string; expiresAt?: Date | null } = {}) => {
    // The redeem flow (AccessGate input + /api/license/redeem) uppercases the
    // code before the exact-match lookup, so store it fully uppercase.
    const code = `${prefix}${tag.toUpperCase().replace(/[^A-Z0-9-]/g, "")}`.toUpperCase().slice(0, 40);
    await q(
      `INSERT INTO "Coupon" (id, code, "discountPercent", plan, status, "expiresAt", "createdAt")
       VALUES ($1, $2, 100, $3, $4, $5, $6)`,
      [cuid(), code, opts.plan ?? "Professional", opts.status ?? "Active", opts.expiresAt ?? null, createdAt]
    );
    return code;
  };

  const createDepartment = async (tag: string, orgId: string) => {
    const id = cuid();
    await q(
      `INSERT INTO "Department" (id, "organizationId", name, color, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $5)`,
      [id, orgId, `E2E Dept ${tag}`, "#7B2FBE", createdAt]
    );
    return id;
  };

  const createEmployee = async (tag: string, orgId: string, deptId?: string | null) => {
    const id = cuid();
    // employeeCode is globally unique in the schema — suffix randomness so
    // repeated runs / parallel tags can never collide.
    const code = `E2E-${tag.toUpperCase().slice(0, 12)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const firstName = `E2E${cap(tag).slice(0, 14)}`;
    const lastName = "Worker";
    await q(
      `INSERT INTO "Employee" (id, "organizationId", "employeeCode", "firstName", "lastName", email, position,
        "departmentId", "employmentType", status, "hireDate", salary, "basicSalary", rating, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Full-time', 'Active', $9, 15000, 12000, 4, $10, $10)`,
      [id, orgId, code, firstName, lastName, `${prefix}${tag}@e2e.test`, "E2E Tester", deptId ?? null, new Date(), createdAt]
    );
    return { id, code, fullName: `${firstName} ${lastName}`, firstName, lastName };
  };

  return { prefix, pool, q, createOrg, createUser, createSession, createLicense, createCoupon, createDepartment, createEmployee };
}

function tag7() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export async function runCleanup(): Promise<void> {
  const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
  if (!connectionString) return;
  const pool = new Pool({ connectionString, max: 1, ssl: { rejectUnauthorized: false } });
  const like = `${RUN_PREFIX}%`;
  const steps: Array<[string, unknown[]]> = [
    [`DELETE FROM "WebSession" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "BridgeSession" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "LicenseCode" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "ApiKey" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "Notification" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "AuditLog" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "AuditLog" WHERE "entityType" = 'Coupon' AND "entityId" IN (SELECT id FROM "Coupon" WHERE code ILIKE $1)`, [like]],
    [`DELETE FROM "HrMessage" WHERE "conversationId" IN (SELECT c.id FROM "HrConversation" c JOIN "Organization" o ON o.id = c."organizationId" WHERE o.slug LIKE $1)`, [like]],
    [`DELETE FROM "HrConversation" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "EmployeeDocument" WHERE "employeeId" IN (SELECT e.id FROM "Employee" e JOIN "Organization" o ON o.id = e."organizationId" WHERE o.slug LIKE $1)`, [like]],
    [`DELETE FROM "Attendance" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "OvertimeRecord" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "LeaveRequest" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "EmployeeShiftAssignment" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "DepartmentShiftAssignment" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "AttendanceDevice" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "UnifiedClockEvent" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "ExpenseRequest" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "Announcement" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "PayrollItem" WHERE "payrollRunId" IN (SELECT p.id FROM "PayrollRun" p JOIN "Organization" o ON o.id = p."organizationId" WHERE o.slug LIKE $1)`, [like]],
    [`DELETE FROM "PayrollRun" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "Employee" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "Department" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`UPDATE "Coupon" SET "redeemedByOrgId" = NULL, "redeemedByOrgName" = NULL WHERE code ILIKE $1`, [like]],
    [`DELETE FROM "Coupon" WHERE code ILIKE $1`, [like]],
    [`DELETE FROM "Shift" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "UserAccount" WHERE "organizationId" IN (SELECT id FROM "Organization" WHERE slug LIKE $1)`, [like]],
    [`DELETE FROM "Organization" WHERE slug LIKE $1`, [like]],
  ];
  try {
    for (const [sql, params] of steps) {
      await pool.query(sql, params).catch(() => {});
    }
  } finally {
    await pool.end().catch(() => {});
  }
}
