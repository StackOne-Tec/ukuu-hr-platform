import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { getPayroll } from "@/lib/queries";
import { Calculator, CheckCircle2, FileText } from "lucide-react";

export const metadata: Metadata = { title: "Payroll · Ukuu HR" };

const PILL: Record<string, string> = { Approved: "approved", Draft: "info", Pending: "pending", Paid: "active" };

export default async function PayrollPage() {
  const res = await getPayroll();
  const runs = res.data;
  const current = runs[0];

  return (
    <AdminShell activeKey="payroll">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Payroll · ZRA 2025 PAYE</div>
          <h1 className="bk-admin-h1">Payroll</h1>
          <p className="bk-admin-sub">Generate monthly batches, review gross-to-net, approve runs.</p>
        </div>
        <div className="bk-admin-actions">
          <Link href="/payroll/pending" className="bk-btn bk-btn-secondary">Pending Approvals</Link>
          <Link href="/payroll/calculator" className="bk-btn bk-btn-primary"><Calculator size={16} /> Live Calculator</Link>
        </div>
      </div>

      <div className="bk-admin-kpi-grid">
        {[
          { label: "Runs created", value: runs.length, tint: "blue" },
          { label: "Current gross", value: current ? `ZMW ${current.totalGross.toLocaleString()}` : "—", tint: "gold" },
          { label: "Current net", value: current ? `ZMW ${current.totalNet.toLocaleString()}` : "—", tint: "green" },
          { label: "PAYE deducted", value: current ? `ZMW ${current.totalPaye.toLocaleString()}` : "—", tint: "pink" },
        ].map((k) => (
          <div key={k.label} className="bk-admin-kpi-card">
            <div className="bk-admin-kpi-card-top"><div className={`bk-admin-kpi-icon ${k.tint}`}>K</div></div>
            <div className="bk-admin-kpi-value" style={{ fontSize: 26 }}>{k.value}</div>
            <div className="bk-admin-kpi-label">{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {runs.length === 0 && (
          <div className="bk-admin-card"><div className="bk-admin-empty">No payroll runs yet.</div></div>
        )}
        {runs.map((run) => (
          <div key={run.id} className="bk-admin-card">
            <div className="bk-admin-card-header">
              <div>
                <h3>{run.periodLabel}</h3>
                <p>{run.employees} employees · gross ZMW {run.totalGross.toLocaleString()} · net ZMW {run.totalNet.toLocaleString()}</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span className={`bk-admin-pill ${PILL[run.status] ?? "info"}`}>{run.status}</span>
                {run.status === "Approved" && <Link href={`/payroll/${run.id}/payslip`} className="bk-btn bk-btn-secondary" style={{ minHeight: 36, padding: "6px 14px" }}><FileText size={14} /> Payslips</Link>}
                {run.status === "Draft" && <span className="bk-admin-pill info" style={{ background: "rgba(20,163,127,.12)", color: "var(--bk-accent-3)" }}><CheckCircle2 size={12} /> Ready to approve</span>}
              </div>
            </div>
            <table className="bk-admin-table">
              <thead>
                <tr><th>Employee</th><th>Code</th><th>Gross</th><th>NAPSA</th><th>NHIMA</th><th>PAYE</th><th>Net Pay</th></tr>
              </thead>
              <tbody>
                {run.items.map((i) => (
                  <tr key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.employeeName}</td>
                    <td className="bk-mono" style={{ color: "var(--bk-ink-3)" }}>{i.employeeCode}</td>
                    <td>ZMW {i.gross.toLocaleString()}</td>
                    <td>ZMW {i.nAPSA.toLocaleString()}</td>
                    <td>ZMW {i.nhima.toLocaleString()}</td>
                    <td style={{ color: "#d89c11", fontWeight: 600 }}>ZMW {i.paye.toLocaleString()}</td>
                    <td style={{ fontWeight: 800 }}>ZMW {i.net.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}