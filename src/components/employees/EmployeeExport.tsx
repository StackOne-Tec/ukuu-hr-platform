"use client";

import { Download } from "lucide-react";

export type EmployeeExportRow = {
  code: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
  hireDate: string | null;
  status: string;
};

export default function EmployeeExport({ rows }: { rows: EmployeeExportRow[] }) {
  const exportCsv = () => {
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [
      ["Code", "First Name", "Last Name", "Department", "Position", "Hire Date", "Status"].join(","),
      ...rows.map((r) => [r.code, r.firstName, r.lastName, r.department, r.position, r.hireDate ?? "", r.status].map(esc).join(",")),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "employees.csv";
    a.click();
  };

  return (
    <button type="button" className="bk-btn bk-btn-secondary" onClick={exportCsv}>
      <Download size={16} /> Export
    </button>
  );
}