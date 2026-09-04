import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getTimeCards } from "@/lib/queries";

export const metadata: Metadata = { title: "Time Cards · Ukuu HR" };

export default async function TimeCardsPage() {
  const res = await getTimeCards();
  const cards = res.data;

  return (
    <AdminShell activeKey="timecards">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Time &amp; Attendance · weekly</div>
          <h1 className="bk-admin-h1">Time Cards</h1>
          <p className="bk-admin-sub">Weekly worked-time summary per employee.</p>
        </div>
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>This period</h3><span className="bk-muted-text">Last 30 days</span></div>
        <table className="bk-admin-table">
          <thead>
            <tr><th>Employee</th><th>Days worked</th><th>Total hours</th><th>Late arrivals</th><th>Avg / day</th></tr>
          </thead>
          <tbody>
            {cards.length === 0 && <tr><td colSpan={5} className="bk-admin-empty">No time card data yet.</td></tr>}
            {cards.map((c) => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="bk-admin-avatar">{c.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                    {c.name}
                  </span>
                </td>
                <td><span className="bk-admin-pill approved">{c.days}d</span></td>
                <td className="bk-mono" style={{ fontWeight: 700 }}>{c.hours}h</td>
                <td><span className={`bk-admin-pill ${c.late > 0 ? "gold" : "active"}`}>{c.late}</span></td>
                <td className="bk-mono">{c.avg}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}