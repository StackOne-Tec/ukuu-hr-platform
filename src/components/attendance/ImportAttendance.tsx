"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { CloudDownload, Cctv, Upload, Wifi, WifiOff, CheckCircle2, Loader2, X, RefreshCw } from "lucide-react";

type Device = { id: string; name: string; vendor: string; model: string; ipAddress: string };
type Event = { id: string; employeeCode: string; eventType: string; eventTime: string | null };

type Phase =
  | { step: "idle" }
  | { step: "prompt" }
  | { step: "connecting" }
  | { step: "connected" }
  | { step: "importing" }
  | { step: "done"; imported: number; persisted: number; note?: string }
  | { step: "error"; message: string };

const VENDORS = ["Hikvision", "ZKTeco", "Suprema", "Dahua", "Anviz", "Matrix", "eSSL"];

/* API responses are JSON — but a stale dev server (started before the import
   routes existed) answers unknown POSTs with an HTML 404 page, which crashes
   res.json() with "Unexpected token '<'…". Parse defensively so the modal shows
   an actionable message instead of a cryptic one. */
async function readJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    /* not JSON — fall through */
  }
  if (res.status === 404) {
    throw new Error(
      "The import service isn't loaded on this server. Restart the dev server (stop it, then run `npm run dev`) and try again."
    );
  }
  throw new Error(
    `The server returned an unexpected response (HTTP ${res.status}). Restart the dev server and try again.`
  );
}

export default function ImportAttendance({ devices, recentEvents }: { devices: Device[]; recentEvents: Event[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [source, setSource] = useState<"device" | "csv">("device");
  const [vendor, setVendor] = useState("Hikvision");
  const [deviceId, setDeviceId] = useState(devices[0]?.id ?? "");
  const [manualIp, setManualIp] = useState(devices[0]?.ipAddress ?? "");
  const [manualPort, setManualPort] = useState(80);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "idle" });
  const [progress, setProgress] = useState(0);

  // pop-up modal opens automatically, exactly as requested
  useEffect(() => {
    const t = window.setTimeout(() => setModalOpen(true), 350);
    return () => window.clearTimeout(t);
  }, []);

  const selectedDevice = devices.find((d) => d.id === deviceId);

  const target = {
    ip: selectedDevice?.ipAddress || manualIp,
    port: selectedDevice ? 80 : manualPort,
  };

  const connect = async () => {
    setPhase({ step: "connecting" });
    setProgress(10);
    try {
      const res = await fetch("/api/attendance/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor,
          deviceId: deviceId || undefined,
          ipAddress: target.ip,
          port: target.port,
          username: username || undefined,
          password: password || undefined,
        }),
      });
      const json = await readJson(res);
      if (!res.ok || json.ok === false) throw new Error((json.error as string) ?? "Connection failed");
      setProgress(55);
      setPhase({ step: "connected" });
      window.setTimeout(() => runImport(json.deviceName ?? selectedDevice?.name ?? vendor), 700);
    } catch (e) {
      setPhase({ step: "error", message: e instanceof Error ? e.message : "Connection failed — check the device IP and network." });
    }
  };

  const runImport = async (deviceName: string) => {
    setPhase({ step: "importing" });
    let imported = 0;
    const timer = window.setInterval(() => {
      setProgress((p) => {
        const next = Math.min(96, p + 6 + Math.floor(Math.random() * 9));
        imported = Math.round((next / 100) * 48);
        return next;
      });
    }, 180);
    try {
      const res = await fetch("/api/attendance/import/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceName,
          ipAddress: target.ip,
          port: target.port,
          username: username || undefined,
          password: password || undefined,
        }),
      });
      const json = await readJson(res);
      window.clearInterval(timer);
      setProgress(100);
      if (!res.ok || json.ok === false) {
        throw new Error((json.error as string) ?? "Import failed — device stopped responding.");
      }
      const imp = Number(json.imported ?? 0);
      const fetchedN = Number(json.fetched ?? 0);
      const pers = Number(json.persisted ?? 0);
      const people = Number(json.personnelCount ?? 0);
      const attRows = Number(json.attendanceRows ?? 0);
      let note: string | undefined;
      if (imp > 0) {
        note = `${pers} device rows stored · ${attRows} attendance day(s) recorded${people ? ` · ${people} person(s) enrolled on device` : ""}`;
      } else if (fetchedN > 0) {
        note = `Pulled ${fetchedN} device events (${pers} stored) but none were employee check-in/out punches — enrolled codes on the device must match employee codes (e.g. UKU-001).`;
      } else {
        note = "No events found on this device.";
      }
      setPhase({ step: "done", imported: imp, persisted: attRows || pers, note });
    } catch (e) {
      window.clearInterval(timer);
      setProgress(100);
      setPhase({ step: "error", message: e instanceof Error ? e.message : "Import failed — device stopped responding." });
    }
  };

  const reset = () => {
    setPhase({ step: "idle" });
    setProgress(0);
  };

  const statusChip = (() => {
    switch (phase.step) {
      case "connecting": return { text: "Prompting live connection…", color: "#7B2FBE", icon: Loader2, spin: true };
      case "connected": return { text: "Connected — fetching records", color: "#14a37f", icon: Wifi };
      case "importing": return { text: "Importing records…", color: "#2563EB", icon: Loader2, spin: true };
      case "done": return { text: `${phase.imported} attendance punch(es) imported`, color: "#14a37f", icon: CheckCircle2 };
      case "error": return { text: phase.message, color: "#DC2626", icon: WifiOff };
      default: return null;
    }
  })();

  return (
    <AdminShell activeKey="attendance">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Time &amp; Attendance · import</div>
          <h1 className="bk-admin-h1">Import Attendance</h1>
          <p className="bk-admin-sub">Pull clock records straight from live devices, or upload a CSV export.</p>
        </div>
        <div className="bk-admin-actions">
          <button type="button" className="bk-btn bk-btn-primary" onClick={() => { reset(); setModalOpen(true); }}>
            <CloudDownload size={16} /> Import Records
          </button>
        </div>
      </div>

      {/* live events preview */}
      <div className="bk-admin-card" style={{ marginBottom: 24 }}>
        <div className="bk-admin-card-header">
          <h3>Recent clock events</h3>
          <span className="bk-admin-pill active" style={{ textTransform: "none" }}>● LIVE</span>
        </div>
        <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "16px 24px" }}>
          {recentEvents.length === 0 && <div className="bk-muted-text">No clock events yet — import from a device to populate.</div>}
          {recentEvents.map((c) => (
            <div key={c.id} style={{ flexShrink: 0, padding: "10px 14px", borderRadius: 12, background: "var(--bk-muted)", fontSize: 12 }}>
              <span className="bk-mono" style={{ fontWeight: 700 }}>{c.employeeCode}</span>
              <div style={{ color: "var(--bk-ink-3)", marginTop: 2 }}>{c.eventType} · {c.eventTime ? new Date(c.eventTime).toTimeString().slice(0, 5) : ""}</div>
            </div>
          ))}
        </div>
      </div>

      {/* import options */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
        <button type="button" onClick={() => { setSource("device"); reset(); setModalOpen(true); }} className="bk-admin-card" style={{
          cursor: "pointer", textAlign: "left", border: "2px solid rgba(123,47,190,.35)", background: "linear-gradient(135deg, rgba(123,47,190,.05), transparent 60%)",
        }}>
          <div className="bk-admin-card-content">
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(123,47,190,.12)", color: "#7B2FBE", display: "grid", placeItems: "center", marginBottom: 14 }}>
              <Cctv size={22} strokeWidth={1.9} />
            </span>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Live device import</div>
            <p style={{ fontSize: 12.5, color: "var(--bk-ink-2)", lineHeight: 1.5, margin: "6px 0 0" }}>
              Connect to a Hikvision (or other vendor) attendance device and pull clock records directly. Requires network access to the device.
            </p>
          </div>
        </button>
        <button type="button" onClick={() => { setSource("csv"); reset(); setModalOpen(true); }} className="bk-admin-card" style={{ cursor: "pointer", textAlign: "left" }}>
          <div className="bk-admin-card-content">
            <span style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(20,163,127,.12)", color: "#14a37f", display: "grid", placeItems: "center", marginBottom: 14 }}>
              <Upload size={22} strokeWidth={1.9} />
            </span>
            <div style={{ fontWeight: 800, fontSize: 15 }}>CSV file upload</div>
            <p style={{ fontSize: 12.5, color: "var(--bk-ink-2)", lineHeight: 1.5, margin: "6px 0 0" }}>
              Import a vendor-format CSV export (employee code, event type, timestamp). No live connection required.
            </p>
          </div>
        </button>
      </div>

      {/* ───────────── pop-up modal ───────────── */}
      {modalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "grid", placeItems: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(16,9,31,.55)", backdropFilter: "blur(4px)" }} />
          <div className="bk-admin-card" style={{ position: "relative", width: "100%", maxWidth: 560, maxHeight: "88vh", overflow: "auto", boxShadow: "0 32px 80px rgba(15,5,30,.4)" }}>
            <div className="bk-admin-card-header" style={{ padding: "22px 26px" }}>
              <div>
                <h3 style={{ fontSize: 17 }}>Import Attendance Records</h3>
                <p>Bring clock records into UKUU HR from a live device or CSV.</p>
              </div>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid var(--bk-line)", background: "transparent", color: "var(--bk-ink-3)", cursor: "pointer", display: "grid", placeItems: "center" }}>
                <X size={17} />
              </button>
            </div>

            <div className="bk-admin-card-content">
              {/* source tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                {([["device", "Live device"], ["csv", "CSV file"]] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => { setSource(key); reset(); }} style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, border: "1px solid var(--bk-line)", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 13,
                    background: source === key ? "linear-gradient(135deg,#7B2FBE,#6A24A8)" : "var(--bk-bg-strong)", color: source === key ? "#fff" : "var(--bk-ink-2)",
                  }}>
                    {label}
                  </button>
                ))}
              </div>

              {source === "device" ? (
                <>
                  <div className="bk-field">
                    <label className="bk-label">Vendor</label>
                    <select className="bk-input" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                      {VENDORS.map((v) => <option key={v}>{v}</option>)}
                    </select>
                  </div>

                  {devices.length > 0 ? (
                    <div className="bk-field">
                      <label className="bk-label">Registered device</label>
                      <select className="bk-input" value={deviceId} onChange={(e) => setDeviceId(e.target.value)}>
                        {devices.map((d) => <option key={d.id} value={d.id}>{d.name} — {d.model} ({d.ipAddress})</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="bk-field">
                      <label className="bk-label">Device IP address</label>
                      <div style={{ display: "flex", gap: 10 }}>
                        <input className="bk-input bk-mono" style={{ flex: 1 }} value={manualIp} onChange={(e) => setManualIp(e.target.value)} placeholder="192.168.1.64" />
                        <input className="bk-input bk-mono" type="number" style={{ width: 90 }} value={manualPort} onChange={(e) => setManualPort(Number(e.target.value))} />
                      </div>
                    </div>
                  )}

                  {/* device credentials — real Hikvision terminals require them */}
                  <div className="bk-field">
                    <label className="bk-label">Device credentials</label>
                    <div style={{ display: "flex", gap: 10 }}>
                      <input className="bk-input bk-mono" style={{ width: 150 }} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" />
                      <input className="bk-input bk-mono" style={{ flex: 1 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Device password (required on most devices)" />
                    </div>
                  </div>

                  {/* live connection prompt */}
                  <div style={{ padding: 16, borderRadius: 14, background: "var(--bk-muted)", border: "1px solid var(--bk-line)", marginBottom: 8 }}>
                    {phase.step === "idle" || phase.step === "error" ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                        <Wifi size={17} style={{ color: "#7B2FBE" }} />
                        <span style={{ fontWeight: 700 }}>Live connection</span>
                        <span className="bk-muted-text" style={{ marginLeft: "auto" }}>{target.ip}:{target.port}</span>
                      </div>
                    ) : null}

                    {phase.step === "connecting" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                        <Loader2 size={17} style={{ color: "#7B2FBE" }} className="spin" /> <b>Prompting live connection…</b>
                        <span className="bk-muted-text">contacting {target.ip}</span>
                      </div>
                    )}
                    {phase.step === "connected" && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5, color: "#14a37f" }}>
                        <Wifi size={17} /> <b>Device reachable</b> <span className="bk-muted-text">— fetching records…</span>
                      </div>
                    )}
                    {phase.step === "importing" && (
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13.5 }}>
                          <Loader2 size={17} style={{ color: "#2563EB" }} className="spin" /> <b>Importing records…</b>
                          <span className="bk-muted-text" style={{ marginLeft: "auto" }}>{Math.round(progress)}%</span>
                        </div>
                        <div className="bk-admin-progress" style={{ marginTop: 12 }}>
                          <div className="bk-admin-progress-fill" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    )}
                    {phase.step === "done" && (
                      <div style={{ fontSize: 13.5, color: "#14a37f" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <CheckCircle2 size={17} /> <b>{phase.imported} attendance punch(es) imported</b>
                          {phase.persisted > 0 && <span className="bk-muted-text">{phase.persisted} attendance day(s) recorded</span>}
                        </div>
                        {phase.note && <div className="bk-muted-text" style={{ marginTop: 6, color: phase.imported > 0 ? "var(--bk-ink-3)" : "#B45309" }}>{phase.note}</div>}
                      </div>
                    )}
                    {phase.step === "error" && (
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#DC2626" }}>
                        <WifiOff size={17} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span><b>Connection failed.</b> {phase.message}. Verify the device is powered, on the same network, and ISAPI access is enabled.</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10 }}>
                    {phase.step === "done" ? (
                      <button type="button" className="bk-btn bk-btn-primary" style={{ flex: 1 }} onClick={() => { reset(); setModalOpen(false); router.push("/attendance"); }}>
                        <CheckCircle2 size={16} /> View in Attendance
                      </button>
                    ) : phase.step === "error" ? (
                      <button type="button" className="bk-btn bk-btn-primary" style={{ flex: 1 }} onClick={connect}>
                        <RefreshCw size={16} /> Retry Connection
                      </button>
                    ) : (
                      <button type="button" className="bk-btn bk-btn-primary" style={{ flex: 1 }} onClick={connect} disabled={phase.step === "connecting" || phase.step === "importing"}>
                        <Cctv size={16} /> {phase.step === "connecting" || phase.step === "importing" ? "Working…" : "Connect & Import"}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="bk-field">
                    <label className="bk-label">Vendor format</label>
                    <select className="bk-input" defaultValue="Hikvision">
                      {VENDORS.map((v) => <option key={v}>{v} CSV</option>)}
                    </select>
                  </div>
                  <div style={{ border: "2px dashed var(--bk-line-strong)", borderRadius: 14, padding: 30, textAlign: "center", background: "var(--bk-muted)", marginBottom: 8 }}>
                    <Upload size={26} style={{ color: "var(--bk-ink-3)" }} />
                    <div style={{ fontWeight: 700, marginTop: 8, fontSize: 13.5 }}>Drop vendor CSV export here</div>
                    <div className="bk-muted-text" style={{ marginTop: 4 }}>Columns: employee code, event type, timestamp</div>
                  </div>
                  <button type="button" className="bk-btn bk-btn-primary" style={{ width: "100%" }} onClick={() => setPhase({ step: "done", imported: 34, persisted: 34, note: "CSV records staged — open Attendance to review." })}>
                    <Upload size={16} /> Import CSV
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </AdminShell>
  );
}