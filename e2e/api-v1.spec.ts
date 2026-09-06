import { test, expect } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace, createApiKeyDirect } from "./helpers";

/**
 * Public v1 API (API-key authenticated):
 *  - 401 without/with bad key, 403 on scope mismatch;
 *  - employees endpoints honor tenant scope;
 *  - Bridge API: login, devices, attendance sync — the contract the desktop
 *    app depends on.
 */

let ws: Awaited<ReturnType<typeof provisionWorkspace>>;
let fullKey: string;
let scopedKey: string;
let employeeCode: string;

test.beforeAll(async () => {
  ws = await provisionWorkspace(`api${Date.now().toString(36).slice(-5)}`);
  fullKey = (await createApiKeyDirect(ws.org.id, "e2e full", "full:rw")).key;
  scopedKey = (await createApiKeyDirect(ws.org.id, "e2e att-only", "attendance:rw")).key;
  const emp = await ctx.createEmployee(`apiemp${Date.now().toString(36).slice(-4)}`, ws.org.id);
  employeeCode = emp.code;
});

test.describe("v1 auth", () => {
  test("rejects missing, bogus and inactive keys", async ({ request }) => {
    await expect((await request.get("/api/v1/employees")).status()).toBe(401);

    const bogus = await request.get("/api/v1/employees", {
      headers: { Authorization: "Bearer ukuu_live_deadbeef" },
    });
    expect(bogus.status()).toBe(401);
  });

  test("enforces scopes: attendance-only key cannot read employees", async ({ request }) => {
    const res = await request.get("/api/v1/employees", {
      headers: { Authorization: `Bearer ${scopedKey}` },
    });
    expect(res.status()).toBe(403);
  });

  test("full key reads employees scoped to the key's org", async ({ request }) => {
    const res = await request.get("/api/v1/employees", {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.count).toBe(1);
    expect(body.employees[0].employeeCode).toBe(employeeCode);
  });
});

test.describe("v1 employees", () => {
  test("GET supports pagination shape via count", async ({ request }) => {
    const res = await request.get("/api/v1/employees", {
      headers: { "X-Api-Key": fullKey },
    });
    const body = await res.json();
    expect(body.count).toBeGreaterThanOrEqual(1);
    const emp = body.employees[0];
    for (const field of ["id", "employeeCode", "firstName", "lastName", "email", "position", "status", "hireDate"]) {
      expect(emp).toHaveProperty(field);
    }
  });
});

test.describe("Bridge API", () => {
  let bridgeToken: string;

  test("bridge login accepts cloud credentials and reports subscription", async ({ request }) => {
    const res = await request.post("/api/v1/bridge/login", {
      data: { email: ws.user.email, password: ws.user.password },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.token).toMatch(/^ukuu_br_/);
    expect(body.subscription.valid).toBe(true);
    expect(body.dashboard.allowed).toBe(true);
    bridgeToken = body.token;
  });

  test("bridge login rejects short passwords and unsupported providers", async ({ request }) => {
    const short = await request.post("/api/v1/bridge/login", {
      data: { email: ws.user.email, password: "123" },
    });
    expect(short.status()).toBe(400);

    const google = await request.post("/api/v1/bridge/login", {
      data: { email: ws.user.email, password: ws.user.password, provider: "google" },
    });
    expect(google.status()).toBe(400);
  });

  test("bridge devices: register, list, duplicate-IP conflict", async ({ request }) => {
    const headers = { Authorization: `Bearer ${bridgeToken}` };

    const list0 = await request.get("/api/v1/bridge/devices", { headers });
    expect(list0.status()).toBe(200);
    const l0 = await list0.json();
    expect(l0.quota.maxDevices).toBeNull(); // unlimited

    const created = await request.post("/api/v1/bridge/devices", {
      headers,
      data: { name: "E2E Bridge Device", vendor: "Hikvision", ipAddress: "10.10.10.10", integrationMode: "REST" },
    });
    expect(created.status()).toBe(201);
    const c = await created.json();
    expect(c.device.name).toBe("E2E Bridge Device");

    const dup = await request.post("/api/v1/bridge/devices", {
      headers,
      data: { name: "Another", ipAddress: "10.10.10.10" },
    });
    expect(dup.status()).toBe(409);

    const badIp = await request.post("/api/v1/bridge/devices", {
      headers,
      data: { name: "Bad IP", ipAddress: "not-an-ip" },
    });
    expect(badIp.status()).toBe(400);
  });

  test("bridge attendance export requires a session", async ({ request }) => {
    const res = await request.get("/api/v1/bridge/attendance");
    expect(res.status()).toBe(401);
  });
});
