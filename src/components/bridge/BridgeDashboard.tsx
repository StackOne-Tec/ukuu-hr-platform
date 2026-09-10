"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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
  LogOut,
  MonitorSmartphone,
  Plus,
  RefreshCw,
  UserRoundPlus,
  UsersRound,
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
  subscription?: {
    plan?: string;
    status?: string;
    valid?: boolean;
    expiresAt?: string | null;
    reason?: string | null;
  };
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

type BridgePage = "devices" | "sync" | "attendance" | "import";

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

export default function BridgeDashboard({ page }: { page: BridgePage }) {
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

  /* per-panel readiness — each dataset streams in independently so a slow
     endpoint never holds back the rest of the dashboard */
  const [devicesReady, setDevicesReady] = useState(false);
  const [syncsReady, setSyncsReady] = useState(false);
  const [attendanceReady, setAttendanceReady] = useState(false);

  /* add-device form (whiteboard fields: name, vendor, model, IP, integration, sync interval) */
  const [form, setForm] = useState({
    name: "",
    vendor: "Hikvision",
    model: "",
    ipAddress: "",
    username: "admin",
    password: "",
    integrationMode: "REST" as string,
    syncIntervalMinutes: 30,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deviceUsers, setDeviceUsers] = useState<Record<string, { employeeNo: string; name: string; userType: string }[]>>({});
  const [usersLoadingId, setUsersLoadingId] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [enrollForm, setEnrollForm] = useState({ employeeNo: "", name: "", username: "admin", password: "" });

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
    setLoading(true);

    // The account payload (org + subscription + device summary) is resolved
    // from the SAME license record the web console gates on, so this is the
    // bridge's authoritative "web application overall" subscription check.
    try {
      const accRes = await fetch("/api/v1/bridge/account", { headers: authHeaders() });
      if (accRes.status === 401) {
        // Stored session died server-side (expired/revoked) — drop it and send
        // the user back to sign-in instead of showing a stale dashboard.
        clearSession();
        router.replace("/bridge/login");
        return;
      }
      const acc = (await accRes.json().catch(() => null)) as {
        ok?: boolean;
        account?: { name: string; email: string; role: string } | null;
        organization?: { name: string } | null;
        subscription?: Subscription | null;
        dashboard?: { allowed: boolean; devices: { total: number; online: number; offline: number; error: number } } | null;
      } | null;
      if (acc?.ok) {
        setAccount(acc.account ?? null);
        setOrgName(acc.organization?.name ?? null);
        setSubscription(acc.subscription ?? null);
        setSummary(acc.dashboard ?? null);
        setBanner(null);
        // The web app's verdict controls the workspace: when it reports the
        // subscription invalid, the desktop app must not proceed — the locked
        // screen renders instead, so skip the data panels entirely.
        if (acc.subscription && !acc.subscription.valid) return;
      }
    } catch {
      setBanner({ kind: "error", text: "Unable to reach the cloud gateway — check your connection and retry." });
    } finally {
      setLoading(false);
    }

    // Panels refresh independently — each updates its own list (and flips its
    // ready flag) the moment its endpoint responds, so a slow devices/syncs/
    // attendance/employees call never delays the others.
    await Promise.all([
      fetch("/api/v1/bridge/devices", { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) {
            setDevices(d.devices ?? []);
            setQuota(d.quota ?? null);
          }
          setDevicesReady(true);
        })
        .catch(() => setDevicesReady(true)),
      fetch("/api/v1/bridge/syncs?limit=60", { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) setSyncs(d.syncs ?? []);
          setSyncsReady(true);
        })
        .catch(() => setSyncsReady(true)),
      fetch("/api/v1/bridge/attendance", { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) setAttendance(d.attendance ?? []);
          setAttendanceReady(true);
        })
        .catch(() => setAttendanceReady(true)),
      fetch("/api/v1/bridge/employees", { headers: authHeaders() })
        .then((r) => r.json())
        .then((d) => {
          if (d?.ok) setEmployees(d.employees ?? []);
        })
        .catch(() => {}),
    ]);
  }, [authHeaders, router]);

  /* boot: restore the Bridge session, or send the user back to sign-in.
     Seed the shell from the stored session (account/org/subscription) so the
     dashboard paints instantly after login, then refresh in place to confirm
     against the cloud — no full-screen wait in between. */
  useEffect(() => {
    const s = readSession();
    if (!s) {
      router.replace("/bridge/login");
      return;
    }
    sessionRef.current = s;
    setSession(s);
    if (s.account?.name) {
      setAccount(s.account as { name: string; email: string; role: string });
    }
    if (s.organization?.name) setOrgName(s.organization.name);
    if (s.subscription) setSubscription(s.subscription as Subscription);
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
            username: form.username.trim() || "admin",
            password: form.password || undefined,
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

  /* ── sync a device: the Bridge pulls the LAN terminal, then stages data ── */
  const syncNow = useCallback(
    async (device: Device) => {
      if (syncingId) return;
      setSyncingId(device.id);
      setBanner(null);
      try {
        const res = await fetch(`/api/v1/bridge/devices/${device.id}/sync`, {
          method: "POST",
          headers: authHeaders(true),
          body: JSON.stringify({}),
        });
        const data = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          fetched?: number;
          persisted?: number;
          personnelCount?: number;
          staged?: number;
        } | null;
        if (!res.ok || !data?.ok) throw new Error(apiError(data, "Unable to pull the device right now."));
        toast({
          title: `Pulled ${device.name}`,
          description: `${data.fetched ?? 0} terminal event(s) read · ${data.personnelCount ?? 0} enrolled people read · ${data.staged ?? 0} new record(s) waiting for cloud review.`,
        });
        await load();
      } catch (err) {
        setBanner({ kind: "error", text: err instanceof Error ? err.message : "Something went wrong." });
      } finally {
        setSyncingId(null);
      }
    },
    [syncingId, authHeaders, toast, load]
  );

  const readDeviceUsers = useCallback(async (device: Device) => {
    setUsersLoadingId(device.id);
    try {
      const res = await fetch(`/api/v1/bridge/devices/${device.id}/users`, { headers: authHeaders() });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; users?: { employeeNo: string; name: string; userType: string }[] };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Unable to read enrolled people.");
      setDeviceUsers((current) => ({ ...current, [device.id]: data.users ?? [] }));
      toast({ title: `Read ${device.name}`, description: `${data.users?.length ?? 0} person(s) are enrolled on the terminal.` });
    } catch (err) {
      setBanner({ kind: "error", text: err instanceof Error ? err.message : "Unable to read enrolled people." });
    } finally {
      setUsersLoadingId(null);
    }
  }, [authHeaders, toast]);

  const enrollEmployee = useCallback(async (device: Device) => {
    if (!enrollForm.employeeNo.trim() || !enrollForm.name.trim()) {
      setBanner({ kind: "error", text: "Enter an employee code and full name before enrolling." });
      return;
    }
    setEnrollingId(device.id);
    try {
      const res = await fetch(`/api/v1/bridge/devices/${device.id}/users`, {
        method: "POST",
        headers: authHeaders(true),
        body: JSON.stringify(enrollForm),
      });
      const data = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; employee?: { employeeNo: string; name: string } };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Unable to enroll the employee.");
      setEnrollForm({ employeeNo: "", name: "", username: "admin", password: "" });
      toast({ title: "Employee enrolled", description: `${data.employee?.name ?? enrollForm.name} was pushed to the terminal and saved to the cloud roster.` });
      await readDeviceUsers(device);
      await load();
    } catch (err) {
      setBanner({ kind: "error", text: err instanceof Error ? err.message : "Unable to enroll the employee." });
    } finally {
      setEnrollingId(null);
    }
  }, [enrollForm, authHeaders, toast, readDeviceUsers, load]);

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

  /* ── subscription gate ──
     The desktop app mirrors the web console's license: while the cloud reports
     the workspace subscription as invalid, the Bridge must not proceed into
     devices / sync / import. The account fetch (the authoritative web-app
     check) runs on every mount, and a stored-invalid session locks immediately
     so an unlicensed workspace never flashes the dashboard. */
  if (subscription && !subscription.valid) {
    return (
      <div className="br-root font-br-sans flex h-dvh w-full flex-col bg-br-surface-container-lowest text-br-on-surface">
        <main className="flex flex-1 items-center justify-center overflow-y-auto px-6 py-10">
          <div className="w-full max-w-md">
            {/* brand lockup */}
            <div className="mb-7 flex items-center justify-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-br-primary-container to-br-secondary-container shadow-lg shadow-br-primary-container/30">
                <UkuuLogoMark size={26} white />
              </span>
              <span className="flex flex-col leading-tight">
                <span className="font-br-sans text-[15px] font-extrabold tracking-[0.2em] text-br-on-surface">UKUU HR</span>
                <span className="font-br-sans text-[10px] font-bold uppercase tracking-[0.24em] text-br-on-surface-variant">
                  Access Sync Bridge
                </span>
              </span>
            </div>

            <div className="rounded-2xl border border-br-surface-variant bg-white p-6 shadow-[0_20px_55px_-28px_rgba(76,40,130,0.4)] sm:p-7">
              <div className="flex items-start gap-3.5">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[#fff3e0] text-br-tertiary">
                  <ShieldCheck size={22} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <h1 className="font-br-sans m-0 text-[17px] font-extrabold tracking-tight text-br-on-surface">
                    Workspace locked
                  </h1>
                  <p className="font-br-sans m-0 mt-0.5 text-[12px] font-semibold text-br-on-surface-variant">
                    {orgName ?? "Your workspace"}
                  </p>
                </div>
              </div>

              <p className="font-br-sans m-0 mt-4 text-[13px] leading-relaxed text-br-on-surface-variant">
                {subscription.reason ??
                  "Your subscription isn't active, so the Bridge can't sync devices or import attendance right now."}
              </p>

              <div className="mt-6 flex items-center gap-2 border-t border-br-surface-variant pt-5">
                <button
                  type="button"
                  className="br-btn br-btn-primary flex-1"
                  onClick={() => void load()}
                  disabled={loading}
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
                  I&rsquo;ve activated it &mdash; check again
                </button>
                <button
                  type="button"
                  className="br-btn br-btn-ghost"
                  onClick={() => void signOut()}
                  disabled={signingOut}
                >
                  {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                  Sign Out
                </button>
              </div>

              <p className="font-br-sans m-0 mt-5 text-center text-[11px] leading-relaxed text-br-outline">
                The Bridge mirrors your Ukuu HR web workspace &mdash; redeem an access code or renew your
                subscription there, then check again here.
              </p>
            </div>

            <p className="font-br-mono mt-7 text-center text-[10px] uppercase tracking-[0.2em] text-br-outline">
              local daemon 127.0.0.1:4370 &middot; cloud gateway idle
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="br-root font-br-sans flex h-dvh select-none flex-col bg-br-surface-container-lowest text-br-on-surface">
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

      {/* ── body: sidebar navigation + page content ── */}
      <div className="flex min-h-0 flex-1">
        <aside className="br-sidebar" aria-label="Bridge navigation">
          <div className="br-sidebar-brand">
            <span className="br-sidebar-logo">
              <UkuuLogoMark size={22} white />
            </span>
            <span className="br-sidebar-brand-text hidden lg:flex">
              <span className="br-sidebar-brand-name">UKUU HR</span>
              <span className="br-sidebar-brand-sub">Access Sync Bridge</span>
            </span>
          </div>

          <nav className="br-sidebar-nav">
            <div className="br-sidebar-section hidden lg:block">Bridge</div>
            <Link
              href="/bridge/dashboard/devices"
              className={`br-sidebar-item${page === "devices" ? " active" : ""}`}
            >
              <span className="br-sidebar-item-icon">
                <MonitorSmartphone size={18} strokeWidth={1.9} />
              </span>
              <span className="br-sidebar-item-label hidden lg:block">Devices</span>
            </Link>
            <Link
              href="/bridge/dashboard/sync"
              className={`br-sidebar-item${page === "sync" ? " active" : ""}`}
            >
              <span className="br-sidebar-item-icon">
                <Clock3 size={18} strokeWidth={1.9} />
              </span>
              <span className="br-sidebar-item-label hidden lg:block">Sync Activity</span>
            </Link>
            <Link
              href="/bridge/dashboard/attendance"
              className={`br-sidebar-item${page === "attendance" ? " active" : ""}`}
            >
              <span className="br-sidebar-item-icon">
                <CalendarCheck size={18} strokeWidth={1.9} />
              </span>
              <span className="br-sidebar-item-label hidden lg:block">Attendance</span>
            </Link>
            <Link
              href="/bridge/dashboard/import"
              className={`br-sidebar-item${page === "import" ? " active" : ""}`}
            >
              <span className="br-sidebar-item-icon">
                <KeyRound size={18} strokeWidth={1.9} />
              </span>
              <span className="br-sidebar-item-label hidden lg:block">Import</span>
            </Link>
          </nav>

          <div className="br-sidebar-footer">
            <div className="br-sidebar-account">
              <div className="br-sidebar-user">
                <span className="br-sidebar-user-avatar">
                  {(account?.name ?? "B").charAt(0).toUpperCase()}
                </span>
                <span className="br-sidebar-user-meta hidden lg:flex">
                  <span className="br-sidebar-user-name">{account?.name ?? "Bridge Daemon"}</span>
                  <span className="br-sidebar-user-role">{account?.email ?? orgName ?? "Workspace"}</span>
                </span>
              </div>
              <button
                type="button"
                className="br-sidebar-signout"
                onClick={() => void signOut()}
                disabled={signingOut}
              >
                {signingOut ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
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
          </div>
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-5 py-5">
          {banner && (
            <div
              role="status"
              aria-live="polite"
              className={`br-banner font-br-sans text-br-body-md ${
                banner.kind === "error"
                  ? "br-banner--error"
                  : banner.kind === "warn"
                    ? "br-banner--warn"
                    : "br-banner--ok"
              }`}
            >
              <span className="br-banner-icon">
                {banner.kind === "error" ? (
                  <AlertCircle size={16} />
                ) : (
                  <CheckCircle2 size={16} />
                )}
              </span>
              <span className="pt-0.5">{banner.text}</span>
            </div>
          )}

          {/* ── per-page KPI strips ── */}
          {page === "devices" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--violet">
                  {summary ? summary.devices.total : devicesReady ? devices.length : "—"}
                </div>
                <div className="br-kpi-label">Registered Devices</div>
                <div className="br-kpi-sub">
                  {summary ? `${summary.devices.offline} offline · ${summary.devices.error} error` : "—"}
                </div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--green">
                  {summary ? summary.devices.online : devicesReady ? devices.filter((d) => d.status === "Online").length : "—"}
                </div>
                <div className="br-kpi-label">Online Now</div>
                <div className="br-kpi-sub">reachable on the LAN</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--gold">{devicesReady ? autoSyncCount : "—"}</div>
                <div className="br-kpi-label">Auto-Sync On</div>
                <div className="br-kpi-sub">automatic uploads enabled</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--pink">{devicesReady ? syncsToday : "—"}</div>
                <div className="br-kpi-label">Syncs Today</div>
                <div className="br-kpi-sub">device → cloud runs</div>
              </div>
            </div>
          )}

          {page === "sync" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--violet">{syncsReady ? syncsToday : "—"}</div>
                <div className="br-kpi-label">Sync Runs Today</div>
                <div className="br-kpi-sub">last {syncsReady && syncs[0] ? timeAgo(syncs[0].ranAt) : "—"}</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--green">
                  {syncsReady ? syncs.reduce((n, s) => n + (s.persisted ?? 0), 0) : "—"}
                </div>
                <div className="br-kpi-label">Records Synced</div>
                <div className="br-kpi-sub">new records uploaded</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--gold">
                  {syncsReady ? syncs.reduce((n, s) => n + (s.matched ?? 0), 0) : "—"}
                </div>
                <div className="br-kpi-label">Matched</div>
                <div className="br-kpi-sub">linked to employees</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--pink">
                  {syncsReady ? syncs.reduce((n, s) => n + (s.unmatched ?? 0), 0) : "—"}
                </div>
                <div className="br-kpi-label">Unmatched</div>
                <div className="br-kpi-sub">awaiting review</div>
              </div>
            </div>
          )}

          {page === "attendance" && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--violet">{attendanceReady ? attendance.length : "—"}</div>
                <div className="br-kpi-label">Records Synced</div>
                <div className="br-kpi-sub">device punches → cloud rows</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--green">
                  {attendanceReady ? attendance.filter((a) => a.status === "Present").length : "—"}
                </div>
                <div className="br-kpi-label">Present</div>
                <div className="br-kpi-sub">marked on time</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--gold">
                  {attendanceReady ? attendance.filter((a) => a.status === "Late").length : "—"}
                </div>
                <div className="br-kpi-label">Late</div>
                <div className="br-kpi-sub">after scheduled start</div>
              </div>
              <div className="br-kpi">
                <div className="br-kpi-value br-kpi-value--pink">
                  {attendanceReady
                    ? attendance.reduce((n, a) => n + (a.workedHours ?? 0), 0).toFixed(1)
                    : "—"}
                </div>
                <div className="br-kpi-label">Hours Logged</div>
                <div className="br-kpi-sub">total worked hours</div>
              </div>
            </div>
          )}

          {/* ── devices page: registered devices + add device ── */}
          {page === "devices" && (
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
                {!devicesReady ? (
                  <div className="br-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Loader2 size={14} className="animate-spin" />
                    Loading registered devices…
                  </div>
                ) : devices.length === 0 ? (
                  <div className="br-empty">
                    <span className="br-empty-icon">
                      <MonitorSmartphone size={20} strokeWidth={1.8} />
                    </span>
                    <div className="br-empty-title">No devices registered yet</div>
                    <div className="br-empty-hint">
                      Use the Add Device form to register the first attendance device from your LAN.
                    </div>
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
                          {deviceUsers[d.id] && <span className="br-pill br-pill--ok"><UsersRound size={10} /> {deviceUsers[d.id].length} enrolled</span>}
                        </div>
                        <div className="mt-0.5 truncate font-br-mono text-br-code-mono-sm text-br-on-surface-variant">
                          {d.vendor}
                          {d.model ? ` ${d.model}` : ""} · {d.ipAddress ?? "—"}:{d.port} · last sync {timeAgo(d.lastSyncAt)}
                        </div>
                      </div>
                      <div className="flex flex-shrink-0 items-center gap-2">
                        <button type="button" className="br-btn br-btn-ghost br-btn--sm" onClick={() => void readDeviceUsers(d)} disabled={usersLoadingId === d.id} title="Read people already enrolled on the terminal">
                          {usersLoadingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <UsersRound size={13} />}
                          Read people
                        </button>
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
                      {deviceUsers[d.id] && (
                        <div className="mx-5 mb-3 rounded-lg border border-br-surface-variant bg-br-surface-container-low p-3">
                          <div className="mb-2 flex items-center gap-2 font-br-sans text-br-body-sm font-semibold text-br-on-surface"><UsersRound size={14} /> Enrolled on terminal</div>
                          {deviceUsers[d.id].length === 0 ? <div className="font-br-sans text-br-body-sm text-br-outline">No people returned by this terminal.</div> : <div className="grid gap-1 sm:grid-cols-2">{deviceUsers[d.id].map((user) => <div key={user.employeeNo} className="flex items-center justify-between rounded-md bg-white px-2.5 py-1.5 font-br-sans text-br-body-sm"><span>{user.name}</span><span className="font-br-mono text-br-code-mono-sm text-br-outline">{user.employeeNo}</span></div>)}</div>}
                          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]">
                            <input className="br-input" placeholder="Employee code" value={enrollForm.employeeNo} onChange={(e) => setEnrollForm((f) => ({ ...f, employeeNo: e.target.value }))} />
                            <input className="br-input" placeholder="Full name" value={enrollForm.name} onChange={(e) => setEnrollForm((f) => ({ ...f, name: e.target.value }))} />
                            <button type="button" className="br-btn br-btn-primary br-btn--sm" onClick={() => void enrollEmployee(d)} disabled={enrollingId === d.id}>{enrollingId === d.id ? <Loader2 size={13} className="animate-spin" /> : <UserRoundPlus size={13} />} Enroll</button>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2"><input className="br-input" placeholder="Terminal username (admin)" value={enrollForm.username} onChange={(e) => setEnrollForm((f) => ({ ...f, username: e.target.value }))} /><input className="br-input" type="password" placeholder="Terminal password (optional)" value={enrollForm.password} onChange={(e) => setEnrollForm((f) => ({ ...f, password: e.target.value }))} /></div>
                        </div>
                      )}
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
                    <label htmlFor="brd-username">Device username</label>
                    <input id="brd-username" className="br-input" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="admin" />
                  </div>
                  <div className="br-field">
                    <label htmlFor="brd-password">Device password</label>
                    <input id="brd-password" className="br-input" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Stored securely for sync" />
                  </div>
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
          )}

          {/* ── import page: API-key direct import (same DB as the cloud) ── */}
          {page === "import" && (
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
          )}

          {/* ── sync page: device → desktop → cloud uploads ── */}
          {page === "sync" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="br-panel xl:col-span-12">
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
                {!syncsReady ? (
                  <div className="br-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    <Loader2 size={14} className="animate-spin" />
                    Loading sync history…
                  </div>
                ) : syncs.length === 0 ? (
                  <div className="br-empty">
                    <span className="br-empty-icon">
                      <Clock3 size={20} strokeWidth={1.8} />
                    </span>
                    <div className="br-empty-title">No sync runs yet</div>
                    <div className="br-empty-hint">
                      Press “Sync now” on a registered device to pull and upload its punch data.
                    </div>
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
          </div>
          )}

          {/* ── attendance page: synced attendance records ── */}
          {page === "attendance" && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="br-panel xl:col-span-12">
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
              {!attendanceReady ? (
                <div className="br-empty" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                  <Loader2 size={14} className="animate-spin" />
                  Loading attendance records…
                </div>
              ) : attendance.length === 0 ? (
                <div className="br-empty">
                  <span className="br-empty-icon">
                    <CalendarCheck size={20} strokeWidth={1.8} />
                  </span>
                  <div className="br-empty-title">No attendance synced yet</div>
                  <div className="br-empty-hint">
                    Sync a device to populate the retrieved punch data here.
                  </div>
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
          )}
        </main>
        </div>
      </div>

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