import { test, expect } from "@playwright/test";
import { ctx } from "./ctx";
import { provisionWorkspace, signInAs } from "./helpers";

/**
 * Bridge device data import (the “importing of data from the devices” flow):
 * a registered attendance device uploads punch events through
 * POST /api/v1/bridge/sync, which STAGES them as pending records. They do NOT
 * enter the core attendance system until an admin selects them — either via
 * POST /api/attendance/import/bridge (the API the GUI calls) or through the
 * selection GUI on /attendance/import. The rollup, dedupe and sync history are
 * verified end-to-end here.
 */

// The dev box's DNS intermittently stalls on Google's auth hosts, so API calls
// get a generous timeout (the suite's actionTimeout is 20s).
const API_TIMEOUT = 120_000;

async function bridgeLogin(request: import("@playwright/test").APIRequestContext, email: string, password: string) {
  const res = await request.post("/api/v1/bridge/login", { data: { email, password }, timeout: API_TIMEOUT });
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body.ok).toBe(true);
  expect(body.token).toMatch(/^ukuu_br_/);
  return body.token as string;
}

async function registerDevice(
  request: import("@playwright/test").APIRequestContext,
  headers: Record<string, string>,
  name: string,
  ipAddress: string
) {
  const created = await request.post("/api/v1/bridge/devices", {
    headers,
    data: { name, vendor: "Hikvision", ipAddress, integrationMode: "REST", autoSyncEnabled: true, syncIntervalMinutes: 15 },
    timeout: API_TIMEOUT,
  });
  expect(created.status()).toBe(201);
  const device = (await created.json()).device;
  expect(device.name).toBe(name);
  return device as { id: string; name: string };
}

/** Ids of the pending (staged) clock-event rows for an org. */
async function pendingEventIds(orgId: string): Promise<string[]> {
  const snap = await ctx.firestore
    .collection("UnifiedClockEvent")
    .where("organizationId", "==", orgId)
    .where("pending", "==", true)
    .get();
  return snap.docs.map((d) => d.id);
}

/** Import selected pending records through the real API the GUI calls. */
async function importBridgeRecords(
  request: import("@playwright/test").APIRequestContext,
  webSessionToken: string,
  eventIds: string[]
) {
  const res = await request.post("/api/attendance/import/bridge", {
    headers: { Cookie: `ukuu_session=${webSessionToken}` },
    data: { eventIds },
    timeout: API_TIMEOUT,
  });
  expect(res.status()).toBe(200);
  return res.json();
}

/** Attendance rows currently in the core system for an org. */
async function attendanceRows(orgId: string): Promise<Array<Record<string, unknown>>> {
  const snap = await ctx.firestore.collection("Attendance").where("organizationId", "==", orgId).get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

test.describe("Bridge device data import", () => {
  test("sync stages records; admin import lands them in the core system", async ({ request }) => {
    const tag = `bi${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);
    const emp = await ctx.createEmployee(`biemp${Date.now().toString(36).slice(-4)}`, ws.org.id);

    // 1. Sign the desktop app in and register a device.
    const token = await bridgeLogin(request, ws.user.email, ws.user.password);
    const headers = { Authorization: `Bearer ${token}` };
    const device = await registerDevice(request, headers, `E2E Reader ${tag}`, "10.20.30.40");

    // 2. Upload the punch events the device collected (one work day).
    const day = new Date();
    day.setHours(8, 5, 0, 0);
    const checkIn = new Date(day);
    const checkOut = new Date(day);
    checkOut.setHours(17, 30, 0, 0);

    const sync = await request.post("/api/v1/bridge/sync", {
      headers,
      data: {
        mode: "manual",
        deviceId: device.id,
        events: [
          { employeeCode: emp.code, time: checkIn.toISOString(), eventType: "check-in" },
          { employeeCode: emp.code, time: checkOut.toISOString(), eventType: "check-out" },
        ],
      },
      timeout: API_TIMEOUT,
    });
    expect(sync.status()).toBe(200);
    const s = await sync.json();
    expect(s.ok).toBe(true);
    expect(s.received).toBe(2);
    expect(s.persisted).toBe(2); // both events logged as new clock-event rows
    expect(s.staged).toBe(2); // staged as pending — NOT yet in the core system
    expect(s.attendanceRows).toBe(0); // nothing imported until the admin selects records
    expect(s.device.id).toBe(device.id);

    // 3. Nothing has entered the core attendance system yet.
    expect(await attendanceRows(ws.org.id)).toHaveLength(0);

    // 4. The admin imports the selected pending records through the real API.
    const ids = await pendingEventIds(ws.org.id);
    expect(ids).toHaveLength(2);
    const imported = await importBridgeRecords(request, ws.token, ids);
    expect(imported.imported).toBe(1); // one daily attendance row from the pair
    expect(imported.matched).toBe(1);
    expect(imported.unmatchedPunches).toBe(0);
    expect(imported.eventsProcessed).toBe(2);

    // 5. The dashboard's attendance view shows the imported row.
    const att = await request.get("/api/v1/bridge/attendance", { headers, timeout: API_TIMEOUT });
    expect(att.status()).toBe(200);
    const a = await att.json();
    expect(a.ok).toBe(true);
    const row = a.attendance.find((r: { employeeCode: string }) => r.employeeCode === emp.code);
    expect(row).toBeTruthy();
    expect(row.employeeName).toBe(emp.fullName);
    expect(row.checkIn).toBe("08:05");
    expect(row.checkOut).toBe("17:30");
    expect(row.status).toBe("Late"); // 08:05 > 08:00 shift start
    expect(row.source).toBe("Device");

    // 6. The review list drained: nothing pending remains.
    expect(await pendingEventIds(ws.org.id)).toHaveLength(0);

    // 7. Sync history recorded the run (attendance rows are reported at import).
    const syncs = await request.get("/api/v1/bridge/syncs?limit=10", { headers, timeout: API_TIMEOUT });
    expect(syncs.status()).toBe(200);
    const sh = await syncs.json();
    expect(sh.ok).toBe(true);
    const run = sh.syncs?.find((r: { deviceId: string }) => r.deviceId === device.id);
    expect(run).toBeTruthy();
    expect(run.persisted).toBe(2);
    expect(run.mode).toBe("manual");
  });

  test("re-importing the same punches is idempotent (dedupe at stage + import)", async ({ request }) => {
    const tag = `bd${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);
    const emp = await ctx.createEmployee(`bdemp${Date.now().toString(36).slice(-4)}`, ws.org.id);

    const token = await bridgeLogin(request, ws.user.email, ws.user.password);
    const headers = { Authorization: `Bearer ${token}` };
    const device = await registerDevice(request, headers, `E2E Reader ${tag}`, "10.20.30.41");

    const day = new Date();
    day.setHours(9, 0, 0, 0);
    const events = [
      { employeeCode: emp.code, time: day.toISOString(), eventType: "check-in" },
      { employeeCode: emp.code, time: new Date(day.getTime() + 8 * 3600_000).toISOString(), eventType: "check-out" },
    ];

    const first = await request.post("/api/v1/bridge/sync", { headers, data: { deviceId: device.id, events }, timeout: API_TIMEOUT });
    expect((await first.json()).persisted).toBe(2);

    // Same events again — nothing new persists (stage dedupe).
    const again = await request.post("/api/v1/bridge/sync", { headers, data: { deviceId: device.id, events }, timeout: API_TIMEOUT });
    const g = await again.json();
    expect(g.ok).toBe(true);
    expect(g.persisted).toBe(0);
    expect(g.staged).toBe(0);

    // Import once → exactly one attendance row.
    const ids = await pendingEventIds(ws.org.id);
    expect(ids).toHaveLength(2);
    const imported = await importBridgeRecords(request, ws.token, ids);
    expect(imported.imported).toBe(1);
    expect(await attendanceRows(ws.org.id)).toHaveLength(1);

    // Re-importing the same ids is a no-op (they are no longer pending).
    const again2 = await importBridgeRecords(request, ws.token, ids);
    expect(again2.imported).toBe(0);
    expect(again2.eventsProcessed).toBe(0);

    const att = await request.get("/api/v1/bridge/attendance", { headers, timeout: API_TIMEOUT });
    const a = await att.json();
    expect(a.attendance.filter((r: { employeeCode: string }) => r.employeeCode === emp.code)).toHaveLength(1);
  });

  test("punches that match no employee are flagged at import, not swallowed", async ({ request }) => {
    const tag = `bu${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);

    const token = await bridgeLogin(request, ws.user.email, ws.user.password);
    const headers = { Authorization: `Bearer ${token}` };
    const device = await registerDevice(request, headers, `E2E Reader ${tag}`, "10.20.30.42");

    const sync = await request.post("/api/v1/bridge/sync", {
      headers,
      data: {
        deviceId: device.id,
        events: [
          { employeeCode: "NO-SUCH-CODE", time: new Date().toISOString(), eventType: "check-in" },
        ],
      },
      timeout: API_TIMEOUT,
    });
    expect(sync.status()).toBe(200);
    const s = await sync.json();
    expect(s.persisted).toBe(1); // logged to the clock-event log
    expect(s.staged).toBe(1);
    expect(s.attendanceRows).toBe(0);

    // Importing it reports the unmatched punch instead of dropping it.
    const ids = await pendingEventIds(ws.org.id);
    expect(ids).toHaveLength(1);
    const imported = await importBridgeRecords(request, ws.token, ids);
    expect(imported.imported).toBe(0);
    expect(imported.matched).toBe(0);
    expect(imported.unmatchedPunches).toBe(1); // flagged, not lost
    expect(await attendanceRows(ws.org.id)).toHaveLength(0);
  });

  test("sync requires a registered device and a valid session", async ({ request }) => {
    const res = await request.post("/api/v1/bridge/sync", {
      data: { device: { name: "Ghost" }, events: [] },
      timeout: API_TIMEOUT,
    });
    expect(res.status()).toBe(401);

    const tag = `bg${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);
    const token = await bridgeLogin(request, ws.user.email, ws.user.password);
    const headers = { Authorization: `Bearer ${token}` };

    const ghost = await request.post("/api/v1/bridge/sync", {
      headers,
      data: { device: { name: "Unregistered Reader" }, events: [] },
      timeout: API_TIMEOUT,
    });
    expect(ghost.status()).toBe(400);
  });

  test("admin selects which records to import via the Import Attendance GUI", async ({ page, request }) => {
    const tag = `gi${Date.now().toString(36).slice(-5)}`;
    const ws = await provisionWorkspace(tag);
    const empA = await ctx.createEmployee(`gia${Date.now().toString(36).slice(-4)}`, ws.org.id);
    const empB = await ctx.createEmployee(`gib${Date.now().toString(36).slice(-4)}`, ws.org.id);

    // Bridge sync stages two check-in records (one per employee).
    const token = await bridgeLogin(request, ws.user.email, ws.user.password);
    const headers = { Authorization: `Bearer ${token}` };
    const device = await registerDevice(request, headers, `E2E Reader ${tag}`, "10.20.30.50");

    const day = new Date();
    day.setHours(9, 0, 0, 0);
    const sync = await request.post("/api/v1/bridge/sync", {
      headers,
      data: {
        deviceId: device.id,
        events: [
          { employeeCode: empA.code, time: day.toISOString(), eventType: "check-in" },
          { employeeCode: empB.code, time: new Date(day.getTime() + 60_000).toISOString(), eventType: "check-in" },
        ],
      },
      timeout: API_TIMEOUT,
    });
    expect((await sync.json()).persisted).toBe(2);

    // Open the Import Attendance page as the console admin.
    await signInAs(page, ws.token);
    await page.goto("/attendance/import");

    // The review list shows both staged records with checkboxes.
    const section = page.locator(".bk-admin-card", { hasText: "Records synced from the Bridge application" });
    await expect(section).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("bridge-record")).toHaveCount(2);
    await expect(page.getByTestId(`bridge-record-check-${empA.code}`)).toBeVisible();
    await expect(page.getByTestId(`bridge-record-check-${empB.code}`)).toBeVisible();

    // Select ONLY employee A's record and import it.
    await page.getByTestId(`bridge-record-check-${empA.code}`).check();
    await expect(page.getByTestId("bridge-import-selected")).toContainText("Import Selected (1)");
    await page.getByTestId("bridge-import-selected").click();

    // Success banner; exactly one attendance row (employee A); B still pending.
    await expect(page.getByText(/Imported 1 attendance record\(s\) from the Bridge\./)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("bridge-record")).toHaveCount(1);
    const att1 = await attendanceRows(ws.org.id);
    expect(att1).toHaveLength(1);
    expect(att1[0].employeeId).toBe(empA.id);

    // Select employee B's record and import it — the list drains completely.
    await page.getByTestId(`bridge-record-check-${empB.code}`).check();
    await page.getByTestId("bridge-import-selected").click();
    await expect(page.getByText(/Imported 1 attendance record\(s\) from the Bridge\./)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/No records waiting to be imported/)).toBeVisible({ timeout: 60_000 });
    expect(await attendanceRows(ws.org.id)).toHaveLength(2);
  });
});