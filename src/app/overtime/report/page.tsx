import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import AdminShell from "@/components/admin/AdminShell";
import { getOvertime } from "@/lib/queries";

export const metadata: Metadata = { title: "Overtime Report · Ukuu HR" };

export default async function OvertimeReportPage() {
  const res = await getOvertime();
  const records = res.data;
  const approved = records.filter((r) => r.status === "Approved");
  const totalHours = approved.reduce((s, r) => s + r.hours, 0);
  const byRate = (rate: string) => approved.filter((r) => r.rateType === rate).reduce((s, r) => s + r.hours, 0);

  return (
    <AdminShell activeKey="overtime">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Overtime · reporting</div>
          <h1 className="bk-admin-h1">Overtime Report</h1>
          <p className="bk-admin-sub">Approved overtime hours by rate type.</p>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        {[
          { label: "Approved hours", value: `${totalHours}h`, tint: "green" },
          { label: "Standard (1.5x)", value: `${byRate("Standard")}h`, tint: "gold" },
          { label: "Weekend (2.0x)", value: `${byRate("Weekend")}h`, tint: "blue" },
          { label: "Public Holiday (3.0x)", value: `${byRate("PublicHoliday")}h`, tint: "pink" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}>OT</div></div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="bk-admin-card">
        <div className="bk-admin-card-header"><h3>Payroll impact</h3></div>
        <div className="bk-admin-card-content" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            ["Standard cost", byRate("Standard") * 1.5],
            ["Weekend cost", byRate("Weekend") * 2.0],
            ["Holiday cost", byRate("PublicHoliday") * 3.0],
          ].map(([label, cost]) => (
            <div key={label as string} className="bk-admin-stat-box">
              <div className="bk-admin-stat-box-label">{label} (ZMW @ 150/h)</div>
              <div className="bk-admin-stat-box-value">ZMW {Math.round(cost as number).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </AdminShell>
  );
}