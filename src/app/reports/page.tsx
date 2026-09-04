import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getReportsData } from "@/lib/queries";

export const metadata: Metadata = { title: "Reports · Ukuu HR" };

const COLORS = ["#7B2FBE", "#6c63ff", "#14a37f", "#e85d75", "#d89c11", "#2563EB", "#A78BFA"];

function Donut({ data, size = 150 }: { data: { name: string; count: number }[]; size?: number }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bk-muted)" strokeWidth={14} />
      {data.map((d, i) => {
        const frac = d.count / total;
        const el = (
          <circle
            key={d.name}
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={COLORS[i % COLORS.length]} strokeWidth={14}
            strokeDasharray={`${frac * c} ${c}`}
            strokeDashoffset={-offset * c}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        );
        offset += frac;
        return el;
      })}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 20, fontWeight: 800, fill: "var(--bk-ink)" }}>
        {total}
      </text>
    </svg>
  );
}

export default async function ReportsPage() {
  const res = await getReportsData();
  const { departments, statuses, spend, totalEmployees, totalAttendance, payrollRuns } = res.data;
  const maxSpend = Math.max(1, ...spend.map((s) => s.total));

  return (
    <AdminShell activeKey="reports">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Analytics · FR-010</div>
          <h1 className="bk-admin-h1">Reports</h1>
          <p className="bk-admin-sub">Workforce distribution, attendance health and payroll spend.</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/reports/generator" className="bk-btn bk-btn-primary">Report Generator</Link>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        {[
          { label: "Total employees", value: totalEmployees, tint: "blue" },
          { label: "Attendance records", value: totalAttendance, tint: "green" },
          { label: "Payroll runs", value: payrollRuns, tint: "gold" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}>%</div></div>
            <div className="bk-admin-kpi-value">{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div className="bk-admin-grid-2-even">
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Department distribution</h3></div>
          <div className="bk-admin-card-content" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <Donut data={departments} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 200 }}>
              {departments.map((d, i) => (
                <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
                  <span className="bk-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span style={{ flex: 1 }}>{d.name}</span>
                  <span className="bk-mono">{d.count}</span>
                </div>
              ))}
              {departments.length === 0 && <span className="bk-muted-text">No data.</span>}
            </div>
          </div>
        </div>

        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Attendance status</h3></div>
          <div className="bk-admin-card-content" style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
            <Donut data={statuses} />
            <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1, minWidth: 200 }}>
              {statuses.map((s, i) => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600 }}>
                  <span className="bk-dot" style={{ background: COLORS[i % COLORS.length] }} />
                  <span style={{ flex: 1 }}>{s.name}</span>
                  <span className="bk-mono">{s.count}</span>
                </div>
              ))}
              {statuses.length === 0 && <span className="bk-muted-text">No data.</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="bk-admin-card" style={{ marginTop: 24 }}>
        <div className="bk-admin-card-header"><h3>Payroll spend by period</h3></div>
        <div className="bk-admin-card-content">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 18, height: 180, padding: "0 8px", borderBottom: "1px solid var(--bk-line)" }}>
            {spend.map((s) => (
              <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <span className="bk-mono" style={{ fontSize: 10.5, color: "var(--bk-ink-3)" }}>ZMW {Math.round(s.total / 1000)}k</span>
                <div style={{ width: "70%", height: Math.max(4, (s.total / maxSpend) * 140), borderRadius: "10px 10px 3px 3px", background: "linear-gradient(180deg,#7B2FBE,#A78BFA)" }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--bk-ink-2)" }}>{s.label}</span>
              </div>
            ))}
            {spend.length === 0 && <span className="bk-muted-text">No payroll data.</span>}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}