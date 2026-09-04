"use client";

import { useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Fingerprint, CheckCircle2 } from "lucide-react";

/* The demo's signature clock-in screen — "Tap to clock in → You're clocked in". */
export default function ClockPage() {
  const [now, setNow] = useState(new Date());
  const [clockedIn, setClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  const toggle = () => {
    if (!clockedIn) {
      setClockedIn(true);
      setClockInTime(now.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
    } else {
      setClockedIn(false);
      setClockInTime(null);
    }
  };

  const hh = now.getHours() % 12 || 12;
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");

  return (
    <AdminShell activeKey="clock">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Verified in real time</div>
          <h1 className="bk-admin-h1">Clock In / Out</h1>
          <p className="bk-admin-sub">A simple clock-in. A reliable record.</p>
        </div>
      </div>

      <div className="bk-admin-grid-2-even">
        {/* clock card — mirrors the demo phone UI */}
        <div style={{
          borderRadius: 24,
          background: "linear-gradient(150deg,#130A24,#2B1747 57%,#112038)",
          color: "#fff",
          padding: 40,
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
          minHeight: 420,
        }}>
          <div style={{ position: "absolute", width: 480, height: 480, borderRadius: "50%", left: "50%", top: -240, transform: "translateX(-50%)", background: "radial-gradient(circle, rgba(135,89,218,.5), rgba(135,89,218,0) 67%)", filter: "blur(12px)" }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontWeight: 800, fontSize: 20 }}>Good morning, Amara</div>
            <div style={{ color: "#C7BBD6", fontSize: 13, marginTop: 4 }}>
              {now.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}
            </div>

            <div style={{ marginTop: 48, fontFamily: "var(--font-mono), monospace", fontSize: 76, fontWeight: 800, letterSpacing: -2, color: "#fff" }}>
              {hh}:{mm}
              <span style={{ fontSize: 28, color: "#F0C257", marginLeft: 6 }}>{ss}</span>
            </div>
            <div style={{ color: "#C7BBD6", fontSize: 13, marginTop: 8 }}>Shift · Day Shift 08:00 – 17:00</div>

            <div style={{ marginTop: 44, display: "flex", justifyContent: "center" }}>
              <span style={{
                width: 120, height: 120, borderRadius: "50%",
                background: "radial-gradient(circle at 38% 28%,#7658B8,#321B56 67%)",
                border: "12px solid rgba(240,194,87,.16)",
                display: "grid", placeItems: "center",
              }}>
                <Fingerprint size={52} color="#F0C257" />
              </span>
            </div>

            <div style={{ marginTop: 32, fontWeight: 800, fontSize: 19 }}>
              {clockedIn ? "You're clocked in" : "Tap to clock in"}
            </div>
            <div style={{ marginTop: 6, color: clockedIn ? "#56D8B0" : "#C7BBD6", fontSize: 12.5, fontWeight: 700 }}>
              {clockedIn ? `${clockInTime} · on time` : "Verified in seconds"}
            </div>

            <button type="button" onClick={toggle} style={{
              marginTop: 28, width: "100%", maxWidth: 340, height: 58, borderRadius: 17, border: "none", cursor: "pointer",
              background: clockedIn ? "#149A75" : "#F0C257",
              color: clockedIn ? "#fff" : "#25163F",
              fontWeight: 900, fontSize: 14, letterSpacing: 1.5, fontFamily: "inherit",
            }}>
              {clockedIn ? "CLOCKED IN  ✓" : "CLOCK IN"}
            </button>
          </div>
        </div>

        {/* side info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="bk-admin-card">
            <div className="bk-admin-card-header"><h3>Verified entry</h3></div>
            <div className="bk-admin-card-content">
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 64, borderRadius: 12, background: "#101020", color: "#F0C257", display: "grid", placeItems: "center", fontFamily: "var(--font-mono), monospace", fontWeight: 800, fontSize: 22 }}>
                  {hh}:{mm}
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>Attendance device</div>
                  <div style={{ color: "var(--bk-ink-3)", fontSize: 12 }}>Hikvision / CSV / API</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bk-admin-card">
            <div className="bk-admin-card-header">
              <h3>UKUU Sync</h3>
              <span className="bk-admin-pill active" style={{ textTransform: "none" }}>LIVE</span>
            </div>
            <div className="bk-admin-card-content">
              <div style={{ padding: 14, borderRadius: 12, background: "var(--bk-muted)", fontSize: 13 }}>
                <b>New event received</b>
                <div className="bk-mono" style={{ marginTop: 8, fontWeight: 700 }}>UKU-042 · {clockInTime ?? "—"}</div>
              </div>
              <div style={{ marginTop: 20, fontWeight: 800, fontSize: 13, color: "var(--bk-ink)" }}>ShiftEngine resolves status</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
                {[
                  ["●", "Shift matched", "#159B76"],
                  ["●", "Audit ready", "#7658B8"],
                  ["●", "On time", "#159B76"],
                  ["●", "Synced", "#2563C9"],
                ].map(([dot, label, color]) => (
                  <span key={label} style={{ fontSize: 12, fontWeight: 700, color: "var(--bk-ink-2)" }}>
                    <b style={{ color, marginRight: 7 }}>{dot}</b>{label}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: 20, display: "flex", alignItems: "center", gap: 8, color: "var(--bk-accent-3)", fontSize: 13, fontWeight: 700 }}>
                <CheckCircle2 size={16} /> {clockedIn ? "Clocked in · record preserved" : "Ready to verify"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}