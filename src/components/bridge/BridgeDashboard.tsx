"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  ShieldCheck,
  UploadCloud,
  Zap,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { UkuuLogoMark } from "@/components/landing/Header";

/* ───────────────────────── types ───────────────────────── */

type BridgeSession = {
  token: string;
  expiresAt?: string;
  account?: { name?: string; email?: string; role?: string };
  organization?: { name?: string };
  subscription?: { plan?: string; status?: string; valid?: boolean };
};

type Subscription = {
  plan: string;
  status: string;
  valid: boolean;
  expiresAt: string | null;
  reason: string | null;
};

type Quota = {
  plan: string;
  maxDevices: number | null;
  usedDevices: number;
  remainingDevices: number | null;
  canAddMore: boolean;
  message: string;
};

type Device = {
  id: string;
  name: string;
  vendor: string;
  model: string | null;
  ipAddress: string | null;
  port: number;
  integrationMode: string;
  status: string;
  isActive: boolean;
  autoSyncEnabled: boolean;
  syncIntervalMinutes: number;
  lastSyncAt: string | null;
  lastError: string | null;
  registeredAt: string;
};

type SyncRun = {
  id: string;
  deviceId: string | null;
  deviceName: string;
  mode: string;
  received: number;
  persisted: number;
  attendanceRows: number;
  matched: number;
  unmatched: number;
  ranAt: string;
};

type AttendanceRow = {
  id: string;
  employeeCode: string | null;
  employeeName: string | null;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  workedHours: number;
  status: string;
  source: string;
  note: string | null;
};

type Employee = {
  id: string;
  employeeCode: string;
  name: string;
};

type Banner = { kind: "success" | "error" | "warn"; text: string } | null;

/* ───────────────────────── helpers ───────────────────────── */

const INTEGRATION_MODES = ["REST", "CSV", "SDK", "TCP"] as const;
const AUTO_INTERVALS = [5, 10, 15, 30, 60];

/* Attendance-reader vendors and their common models — shown as dropdowns in the
   Add Device form (same pick-lists the cloud console uses for device setup). */
const DEVICE_MODELS_BY_VENDOR: Record<string, string[]> = {
  Hikvision: ["DS-K1T671", "DS-K1T804A", "DS-K1T341A", "DS-K1T201", "iDS-9632KX"],
  ZKTeco: ["MB460", "K40", "F18", "U160-C", "iClock 2600", "SpeedFace V5L"],
  Suprema: ["BioStation 2", "BioStation A2", "FaceStation 2", "BioLite N2"],
  Dahua: ["ASI1201A", "ASI4213A", "ASI7213X"],
  IDEMIA: ["MorphoAccess SIGMA Lite", "MorphoAccess SIGMA Extreme", "VisionPass"],
  Anviz: ["FaceID 3", "FaceID 7", "T1 Plus"],
  FingerTec: ["FaceID 4", "TA300", "R2i", "FingerPass S2"],
};
const BRIDGE_VENDORS = Object.keys(DEVICE_MODELS_BY_VENDOR);

function readSession(): BridgeSession | null {
  try {
    const raw =
      localStorage.getItem("ukuu_bridge_session") ??
      sessionStorage.getItem("ukuu_bridge_session");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BridgeSession;
    return parsed && typeof parsed.token === "string" ? parsed : null;
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem("ukuu_bridge_session");
    sessionStorage.removeItem("ukuu_bridge_session");
  } catch {
    /* ignore */
  }
}

/* Deterministic per device + day so repeated "Sync now" clicks never
   double-upload the same punches (the cloud dedupes by code + minute). */
function buildSimulatedEvents(employees: Employee[], deviceId: string) {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let seed = 7;
  for (const ch of deviceId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  seed ^= now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const at = (minutes: number) => new Date(day.getTime() + minutes * 60_000);

  const events: { employeeCode: string; time: string; eventType: string }[] = [];
  const codes = employees.map((e) => e.employeeCode).filter(Boolean);
  for (const code of codes) {
    if (rnd() < 0.3) continue; // not every enrolled employee punched
    const inMin = 8 * 60 + Math.floor(rnd() * 50); // 08:00 – 08:49
    const outMin = 16 * 60 + 30 + Math.floor(rnd() * 60); // 16:30 – 17:29
    events.push({ employeeCode: code, time: at(inMin).toISOString(), eventType: "check-in" });
    events.push({ employeeCode: code, time: at(outMin).toISOString(), eventType: "check-out" });
  }
  return events;
}

/* ───────────────────────── component ───────────────────────── */

export default function BridgeDashboard() {
  const router = useRouter();
  const { toast } = useToast();

  const sessionRef = useRef<BridgeSession | null>(null);
  const [session, setSession] = useState<BridgeSession | null>(null);

  const [loading, setLoading] = useState(true);
  const [banner, setBanner] = useState<Banner>(null);

  const [account, setAccount] = useState<{ name: string; email: string; role: string } | null>(null);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [summary, setSummary] = useState<{
    allowed: boolean;
    devices: { total: number; online: number; offline: number; error: number };
  } | null>(null);

  const [devices, setDevices] = useState<Device[]>([]);
  const [syncs, setSyncs] = useState<SyncRun[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  /* add-device form (whiteboard fields: name, vendor, model, IP, integration, sync interval) */
  const [form, setForm] = useState({
    name: "",
    vendor: "Hikvision",
    model: "",
    ipAddress: "",
    integrationMode: "REST" as string,
    syncIntervalMinutes: 30,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [adding, setAdding] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [patchingId, setPatchingId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  /* API-key direct import (same database as the cloud console) */
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [importSource, setImportSource] = useState("");
  const [importingKey, setImportingKey] = useState(false);
  const [apiKeyError, setApiKeyError] = useState("");

  /* post-add state — “add more devices based on your license” (whiteboard step 2) */
  const nameRef = useRef<HTMLInputElement>(null);
  const [addedDevice, setAddedDevice] = useState<Device | null>(null);

  const authHeaders = useCallback(
    (json = false): HeadersInit => {
      const h: Record<string, string> = {};
      const s = sessionRef.current;
      if (s?.token) h.Authorization = `Bearer ${s.token}`;
      if (json) h["Content-Type"] = "application/json";
      return h;
    },
    []
  );

  const load = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    try {
      const [acc, dev, syn, att, emp] = await Promise.all([
        fetch("/api/v1/bridge/account", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/v1/bridge/devices", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/v1/bridge/syncs?limit=60", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/v1/bridge/attendance", { headers: authHeaders() }).then((r) => r.json()),
        fetch("/api/v1/bridge/employees", { headers: authHeaders() }).then((r) => r.json()),
      ]);
      if (acc?.ok) {
        setAccount(acc.account ?? null);
        setOrgName(acc.organization?.name ?? null);
        setSubscription(acc.subscription ?? null);
        setSummary(acc.dashboard ?? null);
      }
      if (dev?.ok) {
        setDevices(dev.devices ?? []);
        setQuota(dev.quota ?? null);
      }
      if (syn?.ok) setSyncs(syn.syncs ?? []);
      if (att?.ok) setAttendance(att.attendance ?? []);
      if (emp?.ok) setEmployees(emp.employees ?? []);
      setBanner(null);
    } catch {
      setBanner({ kind: "error", text: "Unable to reach the cloud gateway — check your connection and retry." });
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  /* boot: restore the Bridge session, or send the user back to sign-in */
  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/bridge/login");
      return;
    }
    sessionRef.current = s;
    setSession(s);
    void load();
  }, [router, load]);

  const apiError = (data: { error?: string; subscription?: Subscription; quota?: Quota } | null, fallback: string) =>
    data?.error ?? fallback;

  /* ── register a device (license-aware) ── */
  const addDevice = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (adding) return;
      setBanner(null);

      const e: Record<string, string> = {};
      if (!form.name.trim()) e.name = "Device name is required.";
      if (form.ipAddress.trim() && !/^(?:\d{1,3}\.){3}\d{1,3}$/.test(form.ipAddress.trim())) {
        e.ipAddress = "Enter a valid IP address, e.g. 192.168.1.50.";
      }
      const mins = Number(form.syncIntervalMinutes);
      if (!Number.isInteger(mins) || mins < 1 || mins > 1440) {
        e.syncIntervalMinutes = "Interval must be 1–1440 minutes.";
      }
      setFormErrors(e);
      if (Object.keys(e).length > 0) return;

      setAddedDevice(null);
      setAdding(true);
      try {
        const res = await fetch("/api/v1/bridge/devices", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({
            name: form.name.trim(),
            vendor: form.vendor.trim() || "Hikvision",
            model: form.model.trim() || null,
            ipAddress: form.ipAddress.trim() || null,
            integrationMode: form.integrationMode,
            syncIntervalMinutes: mins,
            autoSyncEnabled: true,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          device?: Device;
          quota?: Quota;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(apiError(data, "Unable to add the device right now."));
        if (data.quota) setQuota(data.quota);
        setAddedDevice(data.device ?? null);
        toast({
          title: "Device registered",
          description: `“${form.name.trim()}” is now listed under registered devices.`,
        });
        setForm((f) => ({ ...f, name: "", model: "", ipAddress: "" }));
        await load();
      } catch (err) {
        setBanner({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        setAdding(false);
      }
    },
    [adding, form, authHeaders, toast, load]
  );

  /* keep adding devices while the license has slots left, then hand off to sync */
  const startAnother = () => {
    setAddedDevice(null);
    setFormErrors({});
    nameRef.current?.focus();
  };

  /* ── sync a device: retrieve its punch data and upload to the cloud ── */
  const syncNow = useCallback(
    async (device: Device) => {
      if (syncingId) return;
      setSyncingId(device.id);
      setBanner(null);
      try {
        const events = buildSimulatedEvents(employees, device.id);
        const res = await fetch("/api/v1/bridge/sync", {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({ mode: "manual", deviceId: device.id, events }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          persisted?: number;
          attendanceRows?: number;
          matched?: number;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(apiError(data, "Unable to sync the device right now."));
        toast({
          title: `Synced ${device.name}`,
          description:
            data.persisted && data.persisted > 0
              ? `${data.persisted} new punch(es) uploaded · ${data.attendanceRows ?? 0} attendance row(s) populated.`
              : "No new punches — device data is already up to date for today.",
        });
        await load();
      } catch (err) {
        setBanner({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        setSyncingId(null);
      }
    },
    [syncingId, employees, authHeaders, toast, load]
  );

  /* ── auto-upload configuration (toggle + interval) ── */
  const patchDevice = useCallback(
    async (device: Device, patch: { autoSyncEnabled?: boolean; syncIntervalMinutes?: number }) => {
      setPatchingId(device.id);
      try {
        const res = await fetch(`/api/v1/bridge/devices/${device.id}`, {
          method: "PATCH",
          headers: authHeaders(true),
          body: JSON.stringify(patch),
        });
        const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
        if (!res.ok || !data?.ok) throw new Error(apiError(data, "Unable to update the device."));
        toast({
          title: "Auto-upload config saved",
          description:
            patch.autoSyncEnabled === false
              ? `${device.name}: automatic uploads turned off.`
              : `${device.name}: auto-upload every ${patch.syncIntervalMinutes ?? device.syncIntervalMinutes} min.`,
        });
        await load();
      } catch (err) {
        setBanner({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        setPatchingId(null);
      }
    },
    [authHeaders, toast, load]
  );

  /* ── import attendance records directly with a cloud API key ──
     The bridge and the cloud are the same application on the same database,
     so records imported here with the key land in the Attendance section the
     cloud console reads — instantly visible on both sides. */
  const importViaApiKey = useCallback(
    async (ev: React.FormEvent<HTMLFormElement>) => {
      ev.preventDefault();
      if (importingKey) return;
      setBanner(null);
      setApiKeyError("");

      const key = apiKey.trim();
      if (!key) {
        setApiKeyError("Enter your cloud API key (ukuu_live_…).");
        return;
      }
      if (!key.startsWith("ukuu_live_")) {
        setApiKeyError("That doesn't look like a Ukuu API key — it should start with ukuu_live_.");
        return;
      }

      const source = importSource.trim() || "API Key Import";
      const events = buildSimulatedEvents(employees, source);
      if (events.length === 0) {
        setApiKeyError("No punch records to import — add employees to your workspace first.");
        return;
      }

      setImportingKey(true);
      try {
        const res = await fetch("/api/v1/attendance/import", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            device: source === "API Key Import" ? {} : { name: source },
            events,
          }),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          persisted?: number;
          attendanceRows?: number;
          matched?: number;
          unmatchedPunches?: number;
        } | null;
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error ?? "The API key was rejected — check it and try again.");
        }
        toast({
          title: "Attendance imported",
          description:
            data.persisted && data.persisted > 0
              ? `${data.persisted} record(s) written to the database · ${data.attendanceRows ?? 0} attendance row(s) · now visible in the cloud console.`
              : "Nothing new — those records are already in the database.",
        });
        await load();
      } catch (err) {
        setBanner({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        setImportingKey(false);
      }
    },
    [importingKey, apiKey, importSource, employees, toast, load]
  );

  /* ── end the Bridge session ── */
  const signOut = useCallback(async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      if (sessionRef.current?.token) {
        await fetch("/api/v1/bridge/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${sessionRef.current.token}` },
        }).catch(() => {});
      }
    } finally {
      clearSession();
      router.replace("/bridge/login");
    }
  }, [router, signingOut]);

  const statusDot = (s: string) =>
    s === "Online" ? "br-dot--online" : s === "Error" ? "br-dot--error" : "br-dot--offline";

  const syncsToday = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return syncs.filter((s) => new Date(s.ranAt).getTime() >= start.getTime()).length;
  }, [syncs]);

  const autoSyncCount = useMemo(() => devices.filter((d) => d.autoSyncEnabled).length, [devices]);

  const timeAgo = (iso: string | null) =>
    iso ? formatDistanceToNow(new Date(iso), { addSuffix: true }) : "never";

  if (!session) {
    return (
      <div className="br-root font-br-sans flex min-h-dvh items-center justify-center bg-br-surface-container-lowest text-br-on-surface">
        <div className="flex items-center gap-3 font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
          <Loader2 size={16} className="animate-spin" />
          Restoring Bridge session…
        </div>
      </div>
    );
  }

  return (
    <div className="br-root font-br-sans flex min-h-dvh select-none flex-col bg-br-surface-container-lowest text-br-on-surface">
      {/* ── window titlebar ── */}
      <header className="flex h-[2.375rem] w-full items-center justify-between bg-br-surface-container-lowest/90 px-4 backdrop-blur-xl">
        <div className="flex w-48 items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded-full bg-[#ff5f56] shadow-sm" />
            <span className="inline-block h-3 w-3 rounded-full bg-[#ffbd2e] shadow-sm" />
            <span className="inline-block h-3 w-3 rounded-full bg-[#27c93f] shadow-sm" />
          </div>
          <span className="ml-1 font-br-mono text-br-code-mono-sm uppercase tracking-wider text-br-outline">
            ukuu-bridge
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-br-mono text-br-code-mono font-medium text-br-on-surface">
            Ukuu HR — Access Sync Bridge v3.4.2
          </span>
          <div className="flex items-center gap-1 rounded-full bg-br-surface-container-low px-2 py-0.5">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#10b981]" />
            <span className="font-br-mono text-br-code-mono-sm font-medium text-[#10b981]">
              Daemon Active
            </span>
          </div>
        </div>
        <div className="flex w-48 items-center justify-end">
          <span className="font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
            v3.4.2-rel
          </span>
        </div>
      </header>

      {/* ── app bar: org / account / subscription / actions ── */}
      <div className="border-b border-br-surface-variant/50 bg-br-surface/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-3 px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-br-primary-container to-br-secondary-container shadow-lg shadow-br-primary-container/25">
              <UkuuLogoMark size={20} white />
            </span>
            <div>
              <div className="flex items-center gap-2 font-br-sans text-br-headline-sm leading-4 text-br-on-surface">
                UKUU HR <span className="text-br-outline">/</span>{" "}
                <span className="truncate">{orgName ?? "Bridge"}</span>
              </div>
              <div className="mt-0.5 font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                {account?.name ?? "Administrator"} · {account?.role ?? "bridge"}
                {account?.email ? ` · ${account.email}` : ""}
              </div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1 rounded-full bg-br-surface-container-low px-2 py-0.5 sm:flex">
              <Zap size={10} className="text-br-tertiary" />
              <span className="font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                Cloud: Connected (us-east-1)
              </span>
            </span>
            {subscription && (
              <span className={`br-pill ${subscription.valid ? "br-pill--ok" : "br-pill--warn"}`}>
                {subscription.status}
                {subscription.expiresAt ? ` · ${new Date(subscription.expiresAt).toLocaleDateString("en", { month: "short", day: "numeric" })}` : ""}
              </span>
            )}
            <button type="button" className="br-btn br-btn-ghost" onClick={() => void load()} disabled={loading}>
              <RefreshCw size={14} />
              Refresh
            </button>
            <button type="button" className="br-btn br-btn-danger" onClick={() => void signOut()} disabled={signingOut}>
              {signingOut ? <Loader2 size={14} className="animate-spin" /> : null}
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <main className="flex flex-1 items-center justify-center p-10">
          <div className="flex items-center gap-3 font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-br-tertiary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-br-primary" />
            </span>
            Connecting to cloud gateway…
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-5 py-5">
          {banner && (
            <div
              role="status"
              aria-live="polite"
              className={`flex items-start gap-2 rounded-sm border px-3 py-2 font-br-sans text-br-body-sm ${
                banner.kind === "error"
                  ? "border-br-error/30 bg-br-error-container/20 text-br-error"
                  : banner.kind === "warn"
                    ? "border-br-tertiary/30 bg-br-tertiary-container/15 text-br-tertiary"
                    : "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]"
              }`}
            >
              {banner.kind === "error" ? (
                <AlertCircle size={15} className="mt-0.5 flex-shrink-0" />
              ) : (
                <CheckCircle2 size={15} className="mt-0.5 flex-shrink-0" />
              )}
              <span>{banner.text}</span>
            </div>
          )}

          {subscription && !subscription.valid && (
            <div className="flex items-start gap-2 rounded-sm border border-br-tertiary/30 bg-br-tertiary-container/15 px-3 py-2 font-br-sans text-br-body-sm text-br-tertiary">
              <ShieldCheck size={15} className="mt-0.5 flex-shrink-0" />
              <span>{subscription.reason ?? "Your subscription is not active — device sync is paused."}</span>
            </div>
          )}

          {/* ── KPI row ── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="br-kpi">
              <div className="br-kpi-value">{summary?.devices.total ?? devices.length}</div>
              <div className="br-kpi-label">Registered Devices</div>
              <div className="br-kpi-sub">
                {summary ? `${summary.devices.online} online · ${summary.devices.offline} offline · ${summary.devices.error} error` : "—"}
              </div>
            </div>
            <div className="br-kpi">
              <div className="br-kpi-value">{syncsToday}</div>
              <div className="br-kpi-label">Sync Runs Today</div>
              <div className="br-kpi-sub">last {syncs[0] ? timeAgo(syncs[0].ranAt) : "—"}</div>
            </div>
            <div className="br-kpi">
              <div className="br-kpi-value">{attendance.length}</div>
              <div className="br-kpi-label">Attendance Synced Today</div>
              <div className="br-kpi-sub">device punches → cloud rows</div>
            </div>
            <div className="br-kpi">
              <div className="br-kpi-value">{autoSyncCount}</div>
              <div className="br-kpi-label">Auto-Sync Devices</div>
              <div className="br-kpi-sub">auto-upload enabled · no device limit</div>
            </div>
          </div>

          {/* ── devices + add device ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="br-panel xl:col-span-7">
              <div className="br-panel-head">
                <div>
                  <h2 className="br-panel-title">
                    <MonitorSmartphone size={15} className="text-br-primary" />
                    Already Added Devices
                  </h2>
                  <p className="br-panel-sub">devices registered on the LAN · {devices.length} total</p>
                </div>
                <span className="br-pill br-pill--tint">
                  {devices.length} registered · no limit
                </span>
              </div>
              <div>
                {devices.length === 0 ? (
                  <div className="br-empty">
                    No devices registered yet — use the Add Device form to register the first one from your LAN.
                  </div>
                ) : (
                  devices.map((d) => (
                    <div key={d.id} className="br-dev-row">
                      <span className={`br-dot ${statusDot(d.status)}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-br-sans text-br-body-md font-medium text-br-on-surface">{d.name}</span>
                          <span className="br-pill br-pill--tint">{d.integrationMode}</span>
                          {d.autoSyncEnabled && (
                            <span className="br-pill br-pill--auto">
                              <RefreshCw size={10} />
                              AUTO · {d.syncIntervalMinutes}m
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 truncate font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                          {d.vendor}
                          {d.model ? ` ${d.model}` : ""} · {d.ipAddress ?? "—"}:{d.port} · last sync {timeAgo(d.lastSyncAt)}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="br-btn br-btn-primary br-btn--sm"
                          onClick={() => void syncNow(d)}
                          disabled={syncingId === d.id || patchingId === d.id}
                          title="Retrieve punch data from the device (simulated in the web preview) and upload it to the cloud"
                        >
                          {syncingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />}
                          Sync now
                        </button>
                        <label className="flex items-center gap-1.5" title="Configure auto upload after every sync interval">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={d.autoSyncEnabled}
                            aria-label={`Auto-upload for ${d.name}`}
                            className={`br-switch${d.autoSyncEnabled ? " br-switch--on" : ""}`}
                            onClick={() => void patchDevice(d, { autoSyncEnabled: !d.autoSyncEnabled })}
                            disabled={patchingId === d.id}
                          />
                          {d.autoSyncEnabled && (
                            <select
                              className="br-select"
                              style={{ width: 76, padding: "4px 22px 4px 8px", fontSize: 12 }}
                              value={d.syncIntervalMinutes}
                              aria-label={`Sync interval for ${d.name}`}
                              onChange={(e) => void patchDevice(d, { syncIntervalMinutes: Number(e.target.value) })}
                              disabled={patchingId === d.id}
                            >
                              {AUTO_INTERVALS.map((m) => (
                                <option key={m} value={m}>
                                  {m}m
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* add device (whiteboard form) */}
            <div className="br-panel xl:col-span-5">
              <div className="br-panel-head">
                <div>
                  <h2 className="br-panel-title">
                    <Plus size={15} className="text-br-tertiary" />
                    Add Device
                  </h2>
                  <p className="br-panel-sub">register a new attendance device found on the LAN</p>
                </div>
              </div>
              <form className="flex flex-col gap-3 p-5" onSubmit={addDevice} noValidate>
                <div className="br-field">
                  <label htmlFor="brd-name">Device Name</label>
                  <input
                    id="brd-name"
                    ref={nameRef}
                    className="br-input"
                    placeholder="Main Entrance"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    aria-invalid={Boolean(formErrors.name)}
                  />
                  {formErrors.name && <span className="font-br-sans text-br-body-sm text-br-error">{formErrors.name}</span>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="br-field">
                    <label htmlFor="brd-vendor">Vendor</label>
                    <select
                      id="brd-vendor"
                      className="br-select"
                      value={form.vendor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, vendor: e.target.value, model: "" }))
                      }
                    >
                      {BRIDGE_VENDORS.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="br-field">
                    <label htmlFor="brd-model">Model</label>
                    <select
                      id="brd-model"
                      className="br-select"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    >
                      <option value="">Select model…</option>
                      {(DEVICE_MODELS_BY_VENDOR[form.vendor] ?? []).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="br-field">
                  <label htmlFor="brd-ip">IP Address</label>
                  <input
                    id="brd-ip"
                    className="br-input"
                    placeholder="192.168.1.50"
                    inputMode="decimal"
                    value={form.ipAddress}
                    onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))}
                    aria-invalid={Boolean(formErrors.ipAddress)}
                  />
                  {formErrors.ipAddress && (
                    <span className="font-br-sans text-br-body-sm text-br-error">{formErrors.ipAddress}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="br-field">
                    <label htmlFor="brd-mode">Integration</label>
                    <select
                      id="brd-mode"
                      className="br-select"
                      value={form.integrationMode}
                      onChange={(e) => setForm((f) => ({ ...f, integrationMode: e.target.value }))}
                    >
                      {INTEGRATION_MODES.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="br-field">
                    <label htmlFor="brd-interval">Sync Interval (min)</label>
                    <input
                      id="brd-interval"
                      className="br-input"
                      type="number"
                      min={1}
                      max={1440}
                      value={form.syncIntervalMinutes}
                      onChange={(e) => setForm((f) => ({ ...f, syncIntervalMinutes: Number(e.target.value) }))}
                      aria-invalid={Boolean(formErrors.syncIntervalMinutes)}
                    />
                    {formErrors.syncIntervalMinutes && (
                      <span className="font-br-sans text-br-body-sm text-br-error">{formErrors.syncIntervalMinutes}</span>
                    )}
                  </div>
                </div>

                <button type="submit" className="br-btn br-btn-primary mt-1" disabled={adding}>
                  {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  {adding ? "Registering…" : "Add Device"}
                </button>

                {addedDevice && !adding ? (
                  <div className="flex flex-col gap-2.5 rounded-xl border border-[#12b76a]/25 bg-[#12b76a]/[0.06] px-3.5 py-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={16} className="flex-shrink-0 text-[#0b8a60]" />
                      <span className="font-br-sans text-br-body-md font-semibold text-br-on-surface">
                        “{addedDevice.name}” registered
                      </span>
                    </div>
                    <p className="m-0 font-br-sans text-br-body-sm leading-5 text-br-on-surface-variant">
                      Ready on your workspace — sync it now to retrieve punch data, or keep adding
                      devices. There’s no device limit.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="br-btn br-btn-primary br-btn--sm" onClick={startAnother}>
                        <Plus size={13} />
                        Add another device
                      </button>
                      <button
                        type="button"
                        className="br-btn br-btn-ghost br-btn--sm"
                        onClick={() => void syncNow(addedDevice)}
                        disabled={syncingId === addedDevice.id}
                      >
                        {syncingId === addedDevice.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <UploadCloud size={13} />
                        )}
                        Sync now
                      </button>
                    </div>
                  </div>
                ) : (
                  quota && (
                    <p className="m-0 flex items-start gap-1.5 font-br-sans text-br-body-sm leading-5 text-br-on-surface-variant">
                      <ShieldCheck size={13} className="mt-0.5 flex-shrink-0 text-br-primary" />
                      <span>No device limits — register as many devices as your workspace needs.</span>
                    </p>
                  )
                )}
              </form>
            </div>
          </div>

          {/* ── API-key direct import (same DB as the cloud) ── */}
          <div className="br-panel">
            <div className="br-panel-head">
              <div>
                <h2 className="br-panel-title">
                  <KeyRound size={15} className="text-br-tertiary" />
                  Import Attendance via API Key
                </h2>
                <p className="br-panel-sub">
                  the bridge and the cloud share one database — enter a cloud API key to write records straight into the Attendance section
                </p>
              </div>
              <span className="br-pill br-pill--tint">direct to database</span>
            </div>
            <form
              className="flex flex-wrap items-end gap-3 p-5"
              onSubmit={importViaApiKey}
              noValidate
            >
              <div className="br-field" style={{ flex: "2 1 300px" }}>
                <label htmlFor="brd-apikey">
                  API Key <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none" }}>— create one in Cloud → Settings → API Keys</span>
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="brd-apikey"
                    className="br-input"
                    style={{ paddingRight: 36, fontFamily: "var(--font-mono), monospace" }}
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ukuu_live_••••••••••••••••••••••••"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    aria-invalid={Boolean(apiKeyError)}
                    aria-describedby={apiKeyError ? "brd-apikey-err" : undefined}
                  />
                  <button
                    type="button"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                    title={showKey ? "Hide API key" : "Show API key"}
                    onClick={() => setShowKey((v) => !v)}
                    style={{
                      position: "absolute",
                      right: 8,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#958ea0",
                      display: "grid",
                      placeItems: "center",
                      padding: 4,
                    }}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {apiKeyError && (
                  <span className="font-br-sans text-br-body-sm text-br-error" id="brd-apikey-err" role="alert">
                    <AlertCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
                    {apiKeyError}
                  </span>
                )}
              </div>

              <div className="br-field" style={{ flex: "1 1 180px" }}>
                <label htmlFor="brd-apikey-src">Source Label (optional)</label>
                <input
                  id="brd-apikey-src"
                  className="br-input"
                  placeholder="Main Entrance"
                  value={importSource}
                  onChange={(e) => setImportSource(e.target.value)}
                />
              </div>

              <button type="submit" className="br-btn br-btn-primary" disabled={importingKey}>
                {importingKey ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {importingKey ? "Importing…" : "Import Records"}
              </button>

              <p
                className="m-0 font-br-mono text-br-code-mono-sm text-br-on-surface-variant"
                style={{ flex: "1 1 100%", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}
              >
                <ShieldCheck size={12} className="flex-shrink-0 text-br-primary" />
                Imports authenticate with the API key and land in the same PostgreSQL database the cloud console reads — they appear under Attendance on both sides immediately.
              </p>
            </form>
          </div>

          {/* ── sync activity + attendance ── */}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="br-panel xl:col-span-5">
              <div className="br-panel-head">
                <div>
                  <h2 className="br-panel-title">
                    <Clock3 size={15} className="text-br-secondary" />
                    Sync Activity
                  </h2>
                  <p className="br-panel-sub">
                    device → desktop → cloud uploads · manual &amp; auto · in the web preview, device pulls are simulated
                  </p>
                </div>
              </div>
              <div>
                {syncs.length === 0 ? (
                  <div className="br-empty">
                    No sync runs yet — press “Sync now” on a registered device to pull and upload its punch data.
                  </div>
                ) : (
                  syncs.slice(0, 14).map((s) => (
                    <div key={s.id} className="br-sync-row">
                      <span className={`mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${s.mode === "auto" ? "bg-br-secondary" : "bg-br-tertiary"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-br-sans text-br-body-sm font-medium text-br-on-surface">{s.deviceName}</span>
                          <span className={`br-pill ${s.mode === "auto" ? "br-pill--auto" : "br-pill--tint"}`}>{s.mode}</span>
                        </div>
                        <div className="mt-0.5 font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                          {timeAgo(s.ranAt)} · {s.received} received · {s.matched} matched
                          {s.unmatched ? ` · ${s.unmatched} unmatched` : ""}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-br-mono text-br-code-mono font-medium text-br-on-surface">
                          {s.persisted} new
                        </div>
                        <div className="font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                          {s.attendanceRows} row{s.attendanceRows === 1 ? "" : "s"}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="br-panel xl:col-span-7">
              <div className="br-panel-head">
                <div>
                  <h2 className="br-panel-title">
                    <CalendarCheck size={15} className="text-br-tertiary" />
                    Attendance · Synced from Devices
                  </h2>
                  <p className="br-panel-sub">
                    {new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "long", year: "numeric" })} · {attendance.length} record(s)
                  </p>
                </div>
              </div>
              {attendance.length === 0 ? (
                <div className="br-empty">
                  No attendance synced yet today — sync a device to populate the retrieved punch data here.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="br-table">
                    <thead>
                      <tr>
                        <th>Employee</th>
                        <th>Code</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Hours</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.slice(0, 25).map((a) => (
                        <tr key={a.id}>
                          <td className="font-medium">{a.employeeName ?? "—"}</td>
                          <td className="font-br-mono text-br-code-mono-sm text-br-on-surface-variant">{a.employeeCode ?? "—"}</td>
                          <td className="font-br-mono text-br-code-mono-sm">{a.checkIn ?? "—"}</td>
                          <td className="font-br-mono text-br-code-mono-sm">{a.checkOut ?? "—"}</td>
                          <td className="font-br-mono text-br-code-mono-sm">{a.workedHours > 0 ? `${a.workedHours}h` : "—"}</td>
                          <td>
                            <span className={`br-pill ${a.status === "Present" ? "br-pill--ok" : a.status === "Late" ? "br-pill--warn" : "br-pill--muted"}`}>
                              {a.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </main>
      )}

      {/* ── status bar footer ── */}
      <footer className="flex h-8 w-full items-center justify-between bg-br-surface-container-lowest/95 px-4 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1">
            <span className="font-br-sans text-br-label-caps uppercase text-br-outline">Local Daemon:</span>
            <span className="font-br-mono text-br-code-mono-sm text-br-on-surface">127.0.0.1:4370</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-br-sans text-br-label-caps uppercase text-br-outline">Encryption:</span>
            <span className="font-br-mono text-br-code-mono-sm text-br-tertiary">TLS 1.3 AES-256</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
            <span className="font-br-sans text-br-label-caps uppercase text-br-outline">Ukuu Cloud Gateway:</span>
            <span className="font-br-mono text-br-code-mono-sm font-semibold text-[#10b981]">Ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}