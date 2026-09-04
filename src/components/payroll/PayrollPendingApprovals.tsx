"use client";

import { useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { Check, X } from "lucide-react";

type Item = {
  id: string;
  employeeCode: string;
  employeeName: string;
  gross: number;
  nAPSA: number;
  nhima: number;
  paye: number;
  net: number;
  overtimePay: number;
};

export default function PayrollPendingApprovals({ items, runLabel }: { items: Item[]; runLabel: string }) {
  const [decisions, setDecisions] = useState<Record<string, "Approved" | "Rejected">>({});
  const pending = items.filter((i) => !decisions[i.id]);
  const approved = items.filter((i) => decisions[i.id] === "Approved").length;
  const rejected = items.filter((i) => decisions[i.id] === "Rejected").length;

  return (
    <AdminShell activeKey="payroll">
      <div className="bk-admin-section-header">
        <div className="bk-admin-section-header-left">
          <div className="bk-admin-greeting">Payroll · {runLabel}</div>
          <h1 className="bk-admin-h1">Pending Approvals</h1>
          <p className="bk-admin-sub">{pending.length} awaiting review · {approved} approved · {rejected} rejected</p>
        </div>
      </div>

      <div className="bk-admin-card">
        <table className="bk-admin-table">
          <thead>
            <tr><th>Employee</th><th>Gross</th><th>NAPSA</th><th>NHIMA</th><th>PAYE</th><th>Net</th><th style={{ textAlign: "right" }}>Decision</th></tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={7} className="bk-admin-empty">Nothing to approve.</td></tr>}
            {items.map((i) => {
              const decision = decisions[i.id];
              return (
                <tr key={i.id} style={decision ? { opacity: 0.55 } : undefined}>
                  <td>
                    <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="bk-admin-avatar">{i.employeeName.split(" ").map((p) => p[0]).slice(0, 2).join("")}</span>
                      <span style={{ fontWeight: 600 }}>{i.employeeName}</span>
                      <span className="bk-mono" style={{ color: "var(--bk-ink-3)", fontSize: 11 }}>{i.employeeCode}</span>
                    </span>
                  </td>
                  <td>ZMW {i.gross.toLocaleString()}</td>
                  <td>ZMW {i.nAPSA.toLocaleString()}</td>
                  <td>ZMW {i.nhima.toLocaleString()}</td>
                  <td style={{ color: "#d89c11" }}>ZMW {i.paye.toLocaleString()}</td>
                  <td style={{ fontWeight: 800 }}>ZMW {i.net.toLocaleString()}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    {!decision ? (
                      <>
                        <button type="button" className="bk-btn bk-btn-secondary" style={{ minHeight: 32, padding: "4px 12px", marginRight: 6 }} onClick={() => setDecisions((d) => ({ ...d, [i.id]: "Approved" }))}>
                          <Check size={14} /> Approve
                        </button>
                        <button type="button" className="bk-btn bk-btn-danger" style={{ minHeight: 32, padding: "4px 12px" }} onClick={() => setDecisions((d) => ({ ...d, [i.id]: "Rejected" }))}>
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <span className={`bk-admin-pill ${decision === "Approved" ? "approved" : "rejected"}`}>{decision}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pending.length === 0 && items.length > 0 && (
          <div className="bk-admin-card-header" style={{ borderTop: "1px solid var(--bk-line)" }}>
            <span className="bk-admin-pill active" style={{ textTransform: "none" }}>✓ All items reviewed — approve the run in Payroll</span>
          </div>
        )}
      </div>
    </AdminShell>
  );
}