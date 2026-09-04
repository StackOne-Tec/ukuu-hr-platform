"use client";

import { useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

/* ZRA 2025 PAYE — Zambia */
const BANDS = [
  { from: 0, to: 4800, rate: 0, label: "Tax-free band" },
  { from: 4800, to: 6900, rate: 0.2, label: "20% band" },
  { from: 6900, to: 8900, rate: 0.3, label: "30% band" },
  { from: 8900, to: Infinity, rate: 0.375, label: "37.5% band" },
];

export default function PayrollCalculatorPage() {
  const [gross, setGross] = useState(15000);
  const [allowances, setAllowances] = useState(0);
  const [deductions, setDeductions] = useState(0);

  const calc = useMemo(() => {
    const g = gross + allowances;
    const nAPSA = Math.min(g * 0.05, 9870);
    const nhima = g * 0.01;
    const taxable = g - nAPSA;
    let paye = 0;
    const bandDetails = BANDS.map((b) => {
      const bandTaxable = Math.max(0, Math.min(taxable, b.to) - b.from);
      const tax = bandTaxable * b.rate;
      paye += tax;
      return { ...b, taxable: bandTaxable, tax };
    });
    const net = g - nAPSA - nhima - paye - deductions;
    return { g, nAPSA, nhima, taxable, paye, net, bandDetails };
  }, [gross, allowances, deductions]);

  const fmt = (n: number) => `ZMW ${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AdminShell activeKey="payroll">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Payroll · gross to net</div>
          <h1 className="bk-admin-h1">Payroll Calculator</h1>
          <p className="bk-admin-sub">Live gross-to-net with ZRA 2025 PAYE band breakdown.</p>
        </div>
      </div>

      <div className="bk-admin-grid-2">
        <div className="bk-admin-card">
          <div className="bk-admin-card-header"><h3>Inputs</h3></div>
          <div className="bk-admin-card-content">
            <div className="bk-field">
              <label className="bk-label">Basic salary (ZMW)</label>
              <input type="number" className="bk-input" value={gross} onChange={(e) => setGross(Number(e.target.value))} />
            </div>
            <div className="bk-field">
              <label className="bk-label">Taxable allowances (ZMW)</label>
              <input type="number" className="bk-input" value={allowances} onChange={(e) => setAllowances(Number(e.target.value))} />
            </div>
            <div className="bk-field">
              <label className="bk-label">Other deductions (ZMW)</label>
              <input type="number" className="bk-input" value={deductions} onChange={(e) => setDeductions(Number(e.target.value))} />
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="bk-admin-card">
            <div className="bk-admin-card-header"><h3>Result</h3></div>
            <div className="bk-admin-card-content">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">Gross</div><div className="bk-admin-stat-box-value">{fmt(calc.g)}</div></div>
                <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">Taxable income</div><div className="bk-admin-stat-box-value">{fmt(calc.taxable)}</div></div>
                <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">NAPSA (5%, capped)</div><div className="bk-admin-stat-box-value">{fmt(calc.nAPSA)}</div></div>
                <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">NHIMA (1%)</div><div className="bk-admin-stat-box-value">{fmt(calc.nhima)}</div></div>
                <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">PAYE</div><div className="bk-admin-stat-box-value" style={{ color: "#d89c11" }}>{fmt(calc.paye)}</div></div>
                <div className="bk-admin-stat-box"><div className="bk-admin-stat-box-label">Other deductions</div><div className="bk-admin-stat-box-value">{fmt(deductions)}</div></div>
                <div className="bk-admin-stat-box dark" style={{ gridColumn: "1 / -1" }}>
                  <div className="bk-admin-stat-box-label">Net pay</div>
                  <div className="bk-admin-stat-box-value" style={{ color: "#fff", fontSize: 30 }}>{fmt(calc.net)}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="bk-admin-card">
            <div className="bk-admin-card-header"><h3>PAYE band breakdown</h3></div>
            <div className="bk-admin-card-content">
              {calc.bandDetails.map((b) => (
                <div key={b.label} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                    <span>{b.label} {isFinite(b.to) ? `(${b.from.toLocaleString()}–${b.to.toLocaleString()})` : `(${b.from.toLocaleString()}+)`} · {b.rate * 100}%</span>
                    <span className="bk-mono">{fmt(b.tax)}</span>
                  </div>
                  <div className="bk-admin-progress">
                    <div className="bk-admin-progress-fill" style={{ width: `${calc.taxable > 0 ? Math.min(100, (b.taxable / calc.taxable) * 100) : 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}