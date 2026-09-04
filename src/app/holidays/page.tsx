import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getLeave } from "@/lib/queries";

export const metadata: Metadata = { title: "Public Holidays · Ukuu HR" };

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function HolidaysPage() {
  const res = await getLeave();
  const holidays = res.data.holidays;
  const now = new Date();
  const upcoming = holidays.filter((h) => h.date && new Date(h.date) >= now);
  const past = holidays.filter((h) => !h.date || new Date(h.date) < now);

  return (
    <AdminShell activeKey="holidays">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">FR-008 · Holiday management</div>
          <h1 className="bk-admin-h1">Public Holidays</h1>
          <p className="bk-admin-sub">Zambia statutory holidays, used by ShiftEngine for overtime classification.</p>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        <div className="bk-admin-kpi-card">
          <div className="bk-admin-kpi-value">{holidays.length}</div>
          <div className="bk-admin-kpi-label">Total holidays</div>
          <div className="bk-admin-kpi-sub">{holidays.length > 0 ? holidays[0].country : "Zambia"}</div>
        </div>
        <div className="bk-admin-kpi-card">
          <div className="bk-admin-kpi-value" style={{ color: "var(--bk-accent-3)" }}>{upcoming.length}</div>
          <div className="bk-admin-kpi-label">Upcoming</div>
        </div>
        <div className="bk-admin-kpi-card">
          <div className="bk-admin-kpi-value" style={{ color: "var(--bk-ink-3)" }}>{past.length}</div>
          <div className="bk-admin-kpi-label">Past this year</div>
        </div>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Holiday calendar</h3></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, padding: 24 }}>
          {holidays.length === 0 && <div className="bk-admin-empty" style={{ gridColumn: "1 / -1" }}>No holidays recorded.</div>}
          {holidays.map((h) => {
            const d = h.date ? new Date(h.date) : null;
            const isUpcoming = d && d >= now;
            return (
              <div key={h.id} style={{ display: "flex", gap: 14, padding: 14, borderRadius: 14, background: "var(--bk-muted)", border: "1px solid var(--bk-line)", alignItems: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: isUpcoming ? "linear-gradient(135deg,#7B2FBE,#6A24A8)" : "var(--bk-bg-strong)", color: isUpcoming ? "#fff" : "var(--bk-ink-3)", display: "grid", placeItems: "center", textAlign: "center", flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1 }}>{d ? d.getDate() : "—"}</div>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".04em" }}>{d ? MONTHS[d.getMonth()].slice(0, 3) : ""}</div>
                  </div>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13.5 }}>{h.name}</div>
                  <div className="bk-muted-text">{d ? d.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" }) : "—"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AdminShell>
  );
}