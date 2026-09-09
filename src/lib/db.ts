import "server-only";
import {
  Filter,
  type Query,
  type WhereFilterOp,
} from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";

/* ═══════════════════════════════════════════════════════════════════════════
   Ukuu HR data layer — Cloud Firestore.

   This module exposes the same `db.<model>.<method>()` API the app has always
   used (previously backed by PostgreSQL). Call sites are untouched: every
   route, tour, and import goes through this proxy.

   Firestore notes:
     - Each model maps to a top-level collection (e.g. "UserAccount").
     - The document id is the row's `id` field.
     - Query operators that Firestore cannot express (case-insensitive
       contains / startsWith / endsWith, oversized in/not-in, nested NOT)
       are applied as in-memory post-filters — semantics match the old SQL
       (ILIKE is case-insensitive).
   ═══════════════════════════════════════════════════════════════════════════ */

const tables: Record<string, string> = {
  organization: "Organization",
  apiKey: "ApiKey",
  syncRun: "SyncRun",
  webSession: "WebSession",
  bridgeSession: "BridgeSession",
  userAccount: "UserAccount",
  branch: "Branch",
  department: "Department",
  employee: "Employee",
  attendance: "Attendance",
  leaveType: "LeaveType",
  leaveRequest: "LeaveRequest",
  leaveHoliday: "LeaveHoliday",
  payrollRun: "PayrollRun",
  payrollItem: "PayrollItem",
  shift: "Shift",
  employeeShiftAssignment: "EmployeeShiftAssignment",
  departmentShiftAssignment: "DepartmentShiftAssignment",
  attendanceTolerance: "AttendanceTolerance",
  overtimeRecord: "OvertimeRecord",
  attendanceDevice: "AttendanceDevice",
  unifiedClockEvent: "UnifiedClockEvent",
  hikvisionDevice: "HikvisionDevice",
  hikvisionClockEvent: "HikvisionClockEvent",
  employeeDocument: "EmployeeDocument",
  hrPolicy: "HrPolicy",
  hrConversation: "HrConversation",
  hrMessage: "HrMessage",
  auditLog: "AuditLog",
  licenseCode: "LicenseCode",
  coupon: "Coupon",
  expenseRequest: "ExpenseRequest",
  notification: "Notification",
  pendingRegistration: "PendingRegistration",
  jobOpening: "JobOpening",
  candidate: "Candidate",
  announcement: "Announcement",
};

type Where = Record<string, unknown>;
type QueryOptions = {
  where?: Where;
  select?: Record<string, boolean>;
  include?: Record<string, unknown>;
  orderBy?: Record<string, unknown> | Record<string, unknown>[];
  take?: number;
};

type DbRow = Record<string, any>;

function tableFor(model: string): string {
  const table = tables[model];
  if (!table) throw new Error(`Unknown database model: ${model}`);
  return table;
}

function cuid(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `c${time}${random}`;
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

/**
 * The Admin SDK returns Timestamps (not Date objects) for date fields — unlike
 * the client SDK. Normalize every Timestamp to a Date on read so callers get
 * the same `Date` semantics the app had on PostgreSQL (`getTime()`, comparisons,
 * `toISOString()`, JSON serialization all work). Applied at the single read
 * path so every model inherits the behavior.
 */
function fromFirestore(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as { toDate?: unknown }).toDate === "function" &&
    typeof (value as { seconds?: unknown }).seconds === "number"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  if (Array.isArray(value)) return value.map(fromFirestore);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = fromFirestore(item);
    }
    return out;
  }
  return value;
}

/* ─── where compilation ──────────────────────────────────────────────────── */

type Constraint = { field: string; op: WhereFilterOp; value: unknown };

type Compiled = {
  /** Constraints safe to push to Firestore (equality, in, not-in, ranges). */
  constraints: Constraint[];
  /** Firestore Filter groups (OR / AND of pushed constraints). */
  filters: Filter[];
  /** True when `constraints` + `filters` fully express the where clause. */
  complete: boolean;
  /** In-memory matcher for the whole where clause (used for post-filtering). */
  rowPredicate: (row: DbRow) => boolean;
};

const IN_MAX = 30;
const NOT_IN_MAX = 10;

function matchesEquals(value: unknown, expected: unknown): boolean {
  if (expected === null) return value === null || value === undefined;
  return value === expected;
}

function compileWhere(where: Where | undefined): Compiled {
  const constraints: Constraint[] = [];
  const filters: Filter[] = [];
  let complete = true;
  const checks: Array<(row: DbRow) => boolean> = [];

  const addCheck = (fn: (row: DbRow) => boolean) => {
    complete = false;
    checks.push(fn);
  };

  for (const [field, condition] of Object.entries(where ?? {})) {
    if (condition === undefined) continue;

    if (field === "OR" && Array.isArray(condition)) {
      const branches = condition.map((item) => compileWhere(item as Where));
      if (branches.every((b) => b.complete)) {
        const groups = branches
          .map((b) => {
            const parts: Filter[] = b.constraints.map((c) => Filter.where(c.field, c.op, c.value));
            for (const f of b.filters) parts.push(f);
            return parts.length ? Filter.and(...parts) : null;
          })
          .filter((g): g is Filter => g !== null);
        if (groups.length) filters.push(Filter.or(...groups));
      } else {
        addCheck(condition.map((item) => compileWhere(item as Where).rowPredicate).reduce(
          (acc, p) => (row: DbRow) => acc(row) || p(row),
          () => false
        ));
      }
      continue;
    }

    if (field === "AND" && Array.isArray(condition)) {
      const parts = condition.map((item) => compileWhere(item as Where));
      if (parts.every((p) => p.complete)) {
        for (const p of parts) {
          constraints.push(...p.constraints);
          filters.push(...p.filters);
        }
      } else {
        addCheck(parts.map((p) => p.rowPredicate).reduce(
          (acc, p) => (row: DbRow) => acc(row) && p(row),
          () => true
        ));
      }
      continue;
    }

    if (field === "NOT") {
      const inner = Array.isArray(condition)
        ? compileWhere({ OR: condition } as Where)
        : compileWhere(condition as Where);
      addCheck((row) => !inner.rowPredicate(row));
      continue;
    }

    const get = (row: DbRow) => row[field];

    if (condition === null) {
      constraints.push({ field, op: "==", value: null });
      checks.push((row) => matchesEquals(get(row), null));
      continue;
    }

    if (Array.isArray(condition)) {
      if (!condition.length) {
        // SQL `IN ()` matches nothing; Firestore rejects empty `in` — post-filter.
        addCheck(() => false);
      } else if (condition.length <= IN_MAX) {
        constraints.push({ field, op: "in", value: condition });
        checks.push((row) => condition.includes(get(row)));
      } else {
        addCheck((row) => condition.includes(get(row)));
      }
      continue;
    }

    if (typeof condition === "object" && condition !== null && !isDate(condition)) {
      const operator = condition as Record<string, unknown>;
      if (operator.equals !== undefined) {
        constraints.push({ field, op: "==", value: operator.equals });
        checks.push((row) => matchesEquals(get(row), operator.equals));
      }
      if (operator.in !== undefined) {
        const items = Array.isArray(operator.in) ? operator.in : [];
        if (items.length <= IN_MAX) {
          constraints.push({ field, op: "in", value: items });
          checks.push((row) => items.includes(get(row)));
        } else {
          addCheck((row) => items.includes(get(row)));
        }
      }
      if (operator.notIn !== undefined) {
        const items = Array.isArray(operator.notIn) ? operator.notIn : [];
        if (items.length && items.length <= NOT_IN_MAX) {
          constraints.push({ field, op: "not-in", value: items });
          checks.push((row) => !items.includes(get(row)));
        } else {
          addCheck((row) => !items.includes(get(row)));
        }
      }
      if (operator.gte !== undefined) {
        constraints.push({ field, op: ">=", value: operator.gte });
        checks.push((row) => get(row) >= (operator.gte as number));
      }
      if (operator.gt !== undefined) {
        constraints.push({ field, op: ">", value: operator.gt });
        checks.push((row) => get(row) > (operator.gt as number));
      }
      if (operator.lte !== undefined) {
        constraints.push({ field, op: "<=", value: operator.lte });
        checks.push((row) => get(row) <= (operator.lte as number));
      }
      if (operator.lt !== undefined) {
        constraints.push({ field, op: "<", value: operator.lt });
        checks.push((row) => get(row) < (operator.lt as number));
      }
      if (operator.contains !== undefined) {
        const needle = String(operator.contains).toLowerCase();
        addCheck((row) => String(get(row) ?? "").toLowerCase().includes(needle));
      }
      if (operator.startsWith !== undefined) {
        const prefix = String(operator.startsWith).toLowerCase();
        addCheck((row) => String(get(row) ?? "").toLowerCase().startsWith(prefix));
      }
      if (operator.endsWith !== undefined) {
        const suffix = String(operator.endsWith).toLowerCase();
        addCheck((row) => String(get(row) ?? "").toLowerCase().endsWith(suffix));
      }
      if (operator.not !== undefined) {
        if (operator.not === null) {
          constraints.push({ field, op: "!=", value: null });
          checks.push((row) => get(row) !== null && get(row) !== undefined);
        } else if (typeof operator.not === "object") {
          const inner = compileWhere({ [field]: operator.not } as Where);
          addCheck((row) => !inner.rowPredicate(row));
        } else {
          constraints.push({ field, op: "!=", value: operator.not });
          checks.push((row) => get(row) !== operator.not);
        }
      }
      continue;
    }

    constraints.push({ field, op: "==", value: condition });
    checks.push((row) => matchesEquals(get(row), condition));
  }

  const rowPredicate =
    checks.length === 0
      ? () => true
      : (row: DbRow) => checks.every((check) => check(row));

  return { constraints, filters, complete, rowPredicate };
}

/* ─── queries ────────────────────────────────────────────────────────────── */

function applyConstraints(query: Query, compiled: Compiled): Query {
  let q = query;
  for (const c of compiled.constraints) q = q.where(c.field, c.op, c.value);
  for (const f of compiled.filters) q = q.where(f);
  return q;
}

function normalizeOrder(orderBy: QueryOptions["orderBy"]): Array<[string, "asc" | "desc"]> {
  if (!orderBy) return [];
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  const result: Array<[string, "asc" | "desc"]> = [];
  for (const entry of entries) {
    for (const [field, direction] of Object.entries(entry)) {
      result.push([field, String(direction).toLowerCase() === "desc" ? "desc" : "asc"]);
    }
  }
  return result;
}

async function queryDocs(model: string, options: QueryOptions = {}): Promise<DbRow[]> {
  const compiled = compileWhere(options.where);
  const orderBy = normalizeOrder(options.orderBy);

  let query = applyConstraints(getDb().collection(tableFor(model)), compiled);
  for (const [field, direction] of orderBy) query = query.orderBy(field, direction);

  const limitPushable = compiled.complete && typeof options.take === "number";
  if (limitPushable) query = query.limit(options.take!);

  const snap = await query.get();
  let rows = snap.docs.map((d) => ({ id: d.id, ...(fromFirestore(d.data()) as Record<string, unknown>) }) as DbRow);

  if (!compiled.complete) {
    rows = rows.filter(compiled.rowPredicate);
    if (typeof options.take === "number") rows = rows.slice(0, options.take);
  }

  return rows;
}

async function countRows(model: string, options: QueryOptions = {}): Promise<number> {
  const compiled = compileWhere(options.where);
  if (compiled.complete) {
    const q = applyConstraints(getDb().collection(tableFor(model)), compiled);
    const snap = await q.count().get();
    return snap.data().count;
  }
  return (await queryDocs(model, { where: options.where })).length;
}

function applyProjection(row: DbRow, options: QueryOptions): DbRow {
  if (!options.select) return row;
  const projected: DbRow = {};
  for (const [key, enabled] of Object.entries(options.select)) if (enabled) projected[key] = row[key];
  return projected;
}

async function hydrate(model: string, row: DbRow, include?: Record<string, unknown>): Promise<DbRow> {
  if (!include) return row;
  const result = { ...row };
  for (const relation of Object.keys(include)) {
    if (relation === "department" && model === "employee" && row.departmentId) {
      result.department = await first("department", { where: { id: row.departmentId } });
    } else if (relation === "organization" && row.organizationId) {
      result.organization = await first("organization", { where: { id: row.organizationId }, select: (include[relation] as any)?.select });
    } else if (relation === "users" && model === "organization") {
      result.users = await many("userAccount", { where: { organizationId: row.id } });
    } else if (relation === "employees" && model === "organization") {
      result.employees = await many("employee", { where: { organizationId: row.id } });
    } else if (relation === "department" && model === "jobOpening" && row.departmentId) {
      result.department = await first("department", { where: { id: row.departmentId } });
    } else if (relation === "leaveRequests" && model === "employee") {
      result.leaveRequests = await many("leaveRequest", { where: { employeeId: row.id }, ...(include[relation] as QueryOptions) });
    } else if (relation === "attendances" && model === "employee") {
      result.attendances = await many("attendance", { where: { employeeId: row.id }, ...(include[relation] as QueryOptions) });
    } else if (relation === "documents" && model === "employee") {
      result.documents = await many("employeeDocument", { where: { employeeId: row.id } });
    } else if (relation === "items" && model === "payrollRun") {
      result.items = await many("payrollItem", { where: { payrollRunId: row.id } });
    } else if (relation === "shift" && (model === "employeeShiftAssignment" || model === "departmentShiftAssignment") && row.shiftId) {
      result.shift = await first("shift", { where: { id: row.shiftId } });
    } else if (relation === "messages" && model === "hrConversation") {
      result.messages = await many("hrMessage", { where: { conversationId: row.id }, ...(include[relation] as QueryOptions) });
    } else if (relation === "_count" && model === "organization") {
      result._count = {
        employees: await count("employee", { where: { organizationId: row.id } }),
        users: await count("userAccount", { where: { organizationId: row.id } }),
      };
    }
  }
  return result;
}

async function many(model: string, options: QueryOptions = {}): Promise<DbRow[]> {
  const rows = await queryDocs(model, options);
  const hydrated = await Promise.all(rows.map((row) => hydrate(model, row, options.include)));
  return hydrated.map((row) => applyProjection(row, options));
}

async function first(model: string, options: QueryOptions = {}): Promise<DbRow | null> {
  const rows = await queryDocs(model, { ...options, take: 1 });
  if (!rows.length) return null;
  return applyProjection(await hydrate(model, rows[0], options.include), options);
}

async function count(model: string, options: QueryOptions = {}): Promise<number> {
  return countRows(model, options);
}

/* ─── writes ─────────────────────────────────────────────────────────────── */

const updatedAtModels = new Set([
  "organization",
  "userAccount",
  "department",
  "employee",
  "leaveRequest",
  "attendanceDevice",
  "hrPolicy",
  "jobOpening",
  "candidate",
]);

function normalizeData(model: string, data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if (!result.id) result.id = cuid();
  if (updatedAtModels.has(model) && !result.updatedAt) result.updatedAt = new Date();
  return result;
}

/** Firestore rejects `undefined` field values — drop them before writes. */
function cleanData(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) if (value !== undefined) out[key] = value;
  return out;
}

async function create(model: string, data: Record<string, unknown>): Promise<DbRow> {
  const normalized = normalizeData(model, data);
  await getDb().collection(tableFor(model)).doc(String(normalized.id)).set(cleanData(normalized));
  return normalized;
}

async function update(model: string, where: Where, data: Record<string, unknown>): Promise<DbRow | undefined> {
  const nextData = { ...data };
  if (updatedAtModels.has(model) && !nextData.updatedAt) nextData.updatedAt = new Date();
  const rows = await queryDocs(model, { where, take: 1 });
  if (!rows.length) return undefined;
  const target = rows[0];
  await getDb().collection(tableFor(model)).doc(String(target.id)).update(cleanData(nextData));
  return { ...target, ...cleanData(nextData) };
}

async function remove(model: string, where: Where): Promise<DbRow | undefined> {
  const rows = await queryDocs(model, { where, take: 1 });
  if (!rows.length) return undefined;
  await getDb().collection(tableFor(model)).doc(String(rows[0].id)).delete();
  return rows[0];
}

/** Tag a rejected operation with model.operation so logDbError can include it. */
function tagError(model: string, op: string, e: unknown): never {
  if (e instanceof Error) {
    (e as { dbContext?: string }).dbContext = `${model}.${op}`;
  }
  throw e;
}

function modelApi(model: string) {
  const call = <T>(op: string, fn: () => Promise<T>): Promise<T> => fn().catch((e) => tagError(model, op, e));

  return {
    findMany: (options?: QueryOptions) => call("findMany", () => many(model, options)),
    findFirst: (options?: QueryOptions) => call("findFirst", () => first(model, options)),
    findUnique: (options: { where: Where; select?: Record<string, boolean>; include?: Record<string, unknown> }) =>
      call("findUnique", () => first(model, { ...options, take: 1 })),
    findUniqueOrThrow: async (options: { where: Where }) =>
      call("findUniqueOrThrow", async () => {
        const row = await first(model, { ...options, take: 1 });
        if (!row) throw new Error(`${model} record not found`);
        return row;
      }),
    count: (options?: QueryOptions) => call("count", () => count(model, options)),
    create: (options: { data: Record<string, unknown> }) => call("create", () => create(model, options.data)),
    createMany: (options: { data: Record<string, unknown>[] }) =>
      call("createMany", async () => {
        const collection = getDb().collection(tableFor(model));
        let inserted = 0;
        for (const data of options.data) {
          try {
            const normalized = normalizeData(model, data);
            if (normalized.id && (await collection.doc(String(normalized.id)).get()).exists) continue;
            await create(model, normalized);
            inserted++;
          } catch {
            // Match the app's existing seed/import behavior: duplicate rows are ignored.
          }
        }
        return { count: inserted };
      }),
    update: (options: { where: Where; data: Record<string, unknown> }) =>
      call("update", () => update(model, options.where, options.data)),
    updateMany: (options: { where: Where; data: Record<string, unknown> }) =>
      call("updateMany", async () => {
        const nextData = { ...options.data };
        if (updatedAtModels.has(model) && !nextData.updatedAt) nextData.updatedAt = new Date();
        const rows = await queryDocs(model, { where: options.where });
        const collection = getDb().collection(tableFor(model));
        for (const row of rows) {
          await collection.doc(String(row.id)).update(cleanData(nextData)).catch(() => {});
        }
        return { count: rows.length };
      }),
    delete: (options: { where: Where }) => call("delete", () => remove(model, options.where) as Promise<DbRow>),
    deleteMany: (options?: { where?: Where }) =>
      call("deleteMany", async () => {
        const rows = await queryDocs(model, { where: options?.where ?? {} });
        const collection = getDb().collection(tableFor(model));
        for (const row of rows) await collection.doc(String(row.id)).delete().catch(() => {});
        return { count: rows.length };
      }),
    upsert: (options: { where: Where; update: Record<string, unknown>; create: Record<string, unknown> }) =>
      call("upsert", async () => {
        const existing = await first(model, { where: options.where });
        return existing ? update(model, options.where, options.update) : create(model, options.create);
      }),
  };
}

export const db: any = new Proxy<Record<string, any>>({
  $queryRaw: async () => {
    throw new Error("Raw SQL is not available on Firestore — use the db.* API instead.");
  },
}, {
  get(target, property: string | symbol) {
    if (property === "$queryRaw") return target.$queryRaw;
    if (typeof property !== "string") return undefined;
    if (!target[property]) target[property] = modelApi(property);
    return target[property];
  },
});