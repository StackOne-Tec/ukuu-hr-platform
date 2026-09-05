import "server-only";
import { Pool, type PoolClient } from "pg";
import { normalizeDatabaseUrl } from "@/lib/db-url";

const globalForDb = globalThis as unknown as { pool: Pool | undefined };

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL);
const parsedUrl = connectionString ? new URL(connectionString) : null;
const isLocal = parsedUrl ? ["localhost", "127.0.0.1", "::1"].includes(parsedUrl.hostname) : false;

const pool =
  globalForDb.pool ??
  new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
    ssl: parsedUrl && !isLocal ? { rejectUnauthorized: false } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

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

function quote(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function tableFor(model: string): string {
  const table = tables[model];
  if (!table) throw new Error(`Unknown database model: ${model}`);
  return quote(table);
}

function cuid(): string {
  const time = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `c${time}${random}`;
}

function isDate(value: unknown): value is Date {
  return value instanceof Date;
}

function valueForSql(value: unknown, values: unknown[]): string {
  values.push(isDate(value) ? value : value);
  return `$${values.length}`;
}

function fieldExpression(field: string): string {
  return `${quote(field)}`;
}

function buildWhere(where: Where | undefined, values: unknown[]): string {
  if (!where) return "";
  const clauses: string[] = [];
  for (const [field, condition] of Object.entries(where)) {
    if (condition === undefined) continue;
    if (field === "OR" && Array.isArray(condition)) {
      const parts = condition.map((item) => buildWhere(item as Where, values)).filter(Boolean);
      if (parts.length) clauses.push(`(${parts.join(" OR ")})`);
      continue;
    }
    if (field === "AND" && Array.isArray(condition)) {
      const parts = condition.map((item) => buildWhere(item as Where, values)).filter(Boolean);
      if (parts.length) clauses.push(`(${parts.join(" AND ")})`);
      continue;
    }
    if (field === "NOT") {
      const parts = Array.isArray(condition)
        ? condition.map((item) => buildWhere(item as Where, values)).filter(Boolean)
        : [buildWhere(condition as Where, values)].filter(Boolean);
      if (parts.length) clauses.push(`NOT (${parts.join(" AND ")})`);
      continue;
    }
    const column = fieldExpression(field);
    if (condition === null) {
      clauses.push(`${column} IS NULL`);
      continue;
    }
    if (Array.isArray(condition)) {
      if (!condition.length) clauses.push("FALSE");
      else clauses.push(`${column} IN (${condition.map((v) => valueForSql(v, values)).join(", ")})`);
      continue;
    }
    if (typeof condition === "object" && condition !== null && !isDate(condition)) {
      const operator = condition as Record<string, unknown>;
      if (operator.equals !== undefined) {
        clauses.push(operator.equals === null ? `${column} IS NULL` : `${column} = ${valueForSql(operator.equals, values)}`);
      }
      if (operator.in !== undefined) {
        const items = Array.isArray(operator.in) ? operator.in : [];
        clauses.push(items.length ? `${column} IN (${items.map((v) => valueForSql(v, values)).join(", ")})` : "FALSE");
      }
      if (operator.notIn !== undefined) {
        const items = Array.isArray(operator.notIn) ? operator.notIn : [];
        if (items.length) clauses.push(`${column} NOT IN (${items.map((v) => valueForSql(v, values)).join(", ")})`);
      }
      if (operator.gte !== undefined) clauses.push(`${column} >= ${valueForSql(operator.gte, values)}`);
      if (operator.gt !== undefined) clauses.push(`${column} > ${valueForSql(operator.gt, values)}`);
      if (operator.lte !== undefined) clauses.push(`${column} <= ${valueForSql(operator.lte, values)}`);
      if (operator.lt !== undefined) clauses.push(`${column} < ${valueForSql(operator.lt, values)}`);
      if (operator.contains !== undefined) clauses.push(`${column} ILIKE ${valueForSql(`%${String(operator.contains)}%`, values)}`);
      if (operator.startsWith !== undefined) clauses.push(`${column} ILIKE ${valueForSql(`${String(operator.startsWith)}%`, values)}`);
      if (operator.endsWith !== undefined) clauses.push(`${column} ILIKE ${valueForSql(`%${String(operator.endsWith)}`, values)}`);
      if (operator.not !== undefined) {
        if (operator.not === null) clauses.push(`${column} IS NOT NULL`);
        else if (typeof operator.not === "object") {
          const nested = buildWhere({ [field]: operator.not } as Where, values).replace(`${column} `, `${column} `);
          if (nested) clauses.push(`NOT (${nested})`);
        } else clauses.push(`${column} <> ${valueForSql(operator.not, values)}`);
      }
      continue;
    }
    clauses.push(`${column} = ${valueForSql(condition, values)}`);
  }
  return clauses.length ? clauses.join(" AND ") : "";
}

function buildOrder(orderBy: QueryOptions["orderBy"]): string {
  if (!orderBy) return "";
  const entries = Array.isArray(orderBy) ? orderBy : [orderBy];
  const result: string[] = [];
  for (const entry of entries) {
    for (const [field, direction] of Object.entries(entry)) {
      result.push(`${quote(field)} ${String(direction).toLowerCase() === "desc" ? "DESC" : "ASC"}`);
    }
  }
  return result.length ? ` ORDER BY ${result.join(", ")}` : "";
}

function applyProjection(row: DbRow, options: QueryOptions): DbRow {
  if (!options.select) return row;
  const projected: DbRow = {};
  for (const [key, enabled] of Object.entries(options.select)) if (enabled) projected[key] = row[key];
  return projected;
}

async function queryRows(client: Pool | PoolClient, model: string, options: QueryOptions = {}): Promise<DbRow[]> {
  const values: unknown[] = [];
  const where = buildWhere(options.where, values);
  const limit = options.take ? ` LIMIT ${Math.max(0, Math.floor(options.take))}` : "";
  const sql = `SELECT * FROM ${tableFor(model)}${where ? ` WHERE ${where}` : ""}${buildOrder(options.orderBy)}${limit}`;
  const rows = (await client.query<DbRow>(sql, values)).rows;
  const hydrated = await Promise.all(rows.map((row) => hydrate(model, row, options.include)));
  return hydrated.map((row) => applyProjection(row, options));
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
  return queryRows(pool, model, options);
}

async function first(model: string, options: QueryOptions = {}): Promise<DbRow | null> {
  const rows = await queryRows(pool, model, { ...options, take: 1 });
  return rows[0] ?? null;
}

async function count(model: string, options: QueryOptions = {}): Promise<number> {
  const values: unknown[] = [];
  const where = buildWhere(options.where, values);
  const result = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${tableFor(model)}${where ? ` WHERE ${where}` : ""}`, values);
  return Number(result.rows[0]?.count ?? 0);
}

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

async function create(model: string, data: Record<string, unknown>): Promise<DbRow> {
  const normalized = normalizeData(model, data);
  const fields = Object.keys(normalized).filter((key) => normalized[key] !== undefined);
  const values = fields.map((field) => normalized[field]);
  const sql = `INSERT INTO ${tableFor(model)} (${fields.map(quote).join(", ")}) VALUES (${fields.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING *`;
  return (await pool.query<DbRow>(sql, values)).rows[0];
}

async function update(model: string, where: Where, data: Record<string, unknown>): Promise<DbRow> {
  const values: unknown[] = [];
  const nextData = { ...data };
  if (updatedAtModels.has(model) && !nextData.updatedAt) nextData.updatedAt = new Date();
  const assignments = Object.entries(nextData)
    .filter(([, value]) => value !== undefined)
    .map(([field, value]) => `${quote(field)} = ${valueForSql(value, values)}`);
  const condition = buildWhere(where, values);
  const sql = `UPDATE ${tableFor(model)} SET ${assignments.join(", ")}${condition ? ` WHERE ${condition}` : ""} RETURNING *`;
  return (await pool.query<DbRow>(sql, values)).rows[0];
}

async function remove(model: string, where: Where, manyRows = false): Promise<number | DbRow> {
  const values: unknown[] = [];
  const condition = buildWhere(where, values);
  const sql = `DELETE FROM ${tableFor(model)}${condition ? ` WHERE ${condition}` : ""}${manyRows ? "" : " RETURNING *"}`;
  const result = await pool.query<DbRow>(sql, values);
  return manyRows ? result.rowCount ?? 0 : result.rows[0];
}

function uniqueWhere(where: Where): Where {
  return where;
}

function modelApi(model: string) {
  return {
    findMany: (options?: QueryOptions) => many(model, options),
    findFirst: (options?: QueryOptions) => first(model, options),
    findUnique: (options: { where: Where; select?: Record<string, boolean>; include?: Record<string, unknown> }) => first(model, { ...options, where: uniqueWhere(options.where) }),
    findUniqueOrThrow: async (options: { where: Where }) => {
      const row = await first(model, options);
      if (!row) throw new Error(`${model} record not found`);
      return row;
    },
    count: (options?: QueryOptions) => count(model, options),
    create: (options: { data: Record<string, unknown> }) => create(model, options.data),
    createMany: async (options: { data: Record<string, unknown>[] }) => {
      let inserted = 0;
      for (const data of options.data) {
        try {
          await create(model, data);
          inserted++;
        } catch {
          // Match the app's existing seed/import behavior: duplicate rows are ignored.
        }
      }
      return { count: inserted };
    },
    update: (options: { where: Where; data: Record<string, unknown> }) => update(model, options.where, options.data),
    updateMany: async (options: { where: Where; data: Record<string, unknown> }) => {
      const values: unknown[] = [];
      const assignments = Object.entries(options.data)
        .filter(([, value]) => value !== undefined)
        .map(([field, value]) => `${quote(field)} = ${valueForSql(value, values)}`);
      const condition = buildWhere(options.where, values);
      const result = await pool.query(`UPDATE ${tableFor(model)} SET ${assignments.join(", ")}${condition ? ` WHERE ${condition}` : ""}`, values);
      return { count: result.rowCount ?? 0 };
    },
    delete: (options: { where: Where }) => remove(model, options.where) as Promise<DbRow>,
    deleteMany: async (options?: { where?: Where }) => ({ count: await remove(model, options?.where ?? {}, true) as number }),
    upsert: async (options: { where: Where; update: Record<string, unknown>; create: Record<string, unknown> }) => {
      const existing = await first(model, { where: options.where });
      return existing ? update(model, options.where, options.update) : create(model, options.create);
    },
  };
}

export const db: any = new Proxy<Record<string, any>>({
  $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
    let sql = "";
    strings.forEach((part, index) => {
      sql += part;
      if (index < values.length) sql += `$${index + 1}`;
    });
    return (await pool.query(sql, values)).rows;
  },
}, {
  get(target, property: string | symbol) {
    if (property === "$queryRaw") return target.$queryRaw;
    if (typeof property !== "string") return undefined;
    if (!target[property]) target[property] = modelApi(property);
    return target[property];
  },
});

export { pool };
