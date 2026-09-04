"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Check, Save } from "lucide-react";

export type EmployeeFormData = {
  id?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  position: string;
  departmentId: string;
  employmentType: string;
  status: string;
  hireDate: string;
  salary: number;
  basicSalary: number;
  nrc: string;
  tpin: string;
  bankName: string;
  bankAccountNumber: string;
  bankBranch: string;
  gender: string;
  maritalStatus: string;
  dateOfBirth: string;
  address: string;
  emergencyContact: string;
};

const STEPS = ["Personal", "Employment", "Banking", "Tax & Statutory"];

const initial: EmployeeFormData = {
  employeeCode: "", firstName: "", lastName: "", email: "", phone: "",
  position: "", departmentId: "", employmentType: "Full-time", status: "Active",
  hireDate: new Date().toISOString().slice(0, 10), salary: 0, basicSalary: 0,
  nrc: "", tpin: "", bankName: "", bankAccountNumber: "", bankBranch: "",
  gender: "", maritalStatus: "", dateOfBirth: "", address: "", emergencyContact: "",
};

/* ZRA 2025 PAYE brackets (Zambia) */
function payrollPreview(gross: number) {
  const nAPSA = Math.min(gross * 0.05, 9870);
  const nhima = gross * 0.01;
  const taxable = gross - nAPSA;
  let paye = 0;
  if (taxable > 4800) paye += Math.min(taxable - 4800, 2100) * 0.2;
  if (taxable > 6900) paye += Math.min(taxable - 6900, 2000) * 0.3;
  if (taxable > 8900) paye += (taxable - 8900) * 0.375;
  const net = gross - nAPSA - nhima - paye;
  return { nAPSA, nhima, paye, net };
}

export default function EmployeeForm({ departments, initialData }: { departments: { id: string; name: string }[]; initialData?: Partial<EmployeeFormData> }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmployeeFormData>({ ...initial, ...initialData });
  const set = (k: keyof EmployeeFormData, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const gross = Number(form.basicSalary || form.salary || 0);
  const preview = useMemo(() => payrollPreview(gross), [gross]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) router.push(form.id ? `/employees/${form.id}` : `/employees/${json.id}`);
      else alert(json.error ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, k, type = "text", options, span }: { label: string; k: keyof EmployeeFormData; type?: string; options?: { value: string; label: string }[]; span?: boolean }) => (
    <div className="bk-field" style={span ? { gridColumn: "1 / -1" } : undefined}>
      <label className="bk-label">{label}</label>
      {options ? (
        <select className="bk-input" value={String(form[k])} onChange={(e) => set(k, e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : (
        <input className="bk-input" type={type} value={String(form[k])} onChange={(e) => set(k, type === "number" ? Number(e.target.value) : e.target.value)} />
      )}
    </div>
  );

  return (
    <div className="bk-admin-card">
      {/* step indicator */}
      <div className="bk-admin-card-header" style={{ justifyContent: "flex-start", gap: 0 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, maxWidth: 220 }}>
            <span style={{
              width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 800, flexShrink: 0,
              background: i <= step ? "linear-gradient(135deg,#7B2FBE,#6A24A8)" : "var(--bk-muted)", color: i <= step ? "#fff" : "var(--bk-ink-3)",
            }}>
              {i < step ? <Check size={14} /> : i + 1}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: i <= step ? "var(--bk-ink)" : "var(--bk-ink-3)", whiteSpace: "nowrap" }}>{s}</span>
            {i < STEPS.length - 1 && <span style={{ flex: 1, height: 1, background: i < step ? "var(--bk-accent)" : "var(--bk-line)" }} />}
          </div>
        ))}
      </div>

      <div className="bk-admin-card-content">
        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            <Field label="First Name *" k="firstName" />
            <Field label="Last Name *" k="lastName" />
            <Field label="Email *" k="email" type="email" />
            <Field label="Phone" k="phone" />
            <Field label="Gender" k="gender" options={[{ value: "", label: "Select…" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} />
            <Field label="Marital Status" k="maritalStatus" options={[{ value: "", label: "Select…" }, { value: "Single", label: "Single" }, { value: "Married", label: "Married" }, { value: "Divorced", label: "Divorced" }]} />
            <Field label="Date of Birth" k="dateOfBirth" type="date" />
            <Field label="Address" k="address" />
            <Field label="Emergency Contact" k="emergencyContact" span />
          </div>
        )}
        {step === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            <Field label="Employee Code" k="employeeCode" />
            <Field label="Position / Job Title *" k="position" />
            <Field label="Department" k="departmentId" options={[{ value: "", label: "Select…" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} />
            <Field label="Employment Type" k="employmentType" options={[{ value: "Full-time", label: "Full-time" }, { value: "Part-time", label: "Part-time" }, { value: "Contract", label: "Contract" }]} />
            <Field label="Status" k="status" options={[{ value: "Active", label: "Active" }, { value: "Probation", label: "Probation" }, { value: "Inactive", label: "Inactive" }]} />
            <Field label="Hire Date" k="hireDate" type="date" />
            <Field label="Basic Salary (ZMW)" k="basicSalary" type="number" span />
          </div>
        )}
        {step === 2 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            <Field label="Bank Name" k="bankName" options={[{ value: "", label: "Select…" }, { value: "ZANACO", label: "ZANACO" }, { value: "Stanbic", label: "Stanbic" }, { value: "FNB", label: "FNB" }, { value: "Atlas Mara", label: "Atlas Mara" }, { value: "Indo-Zambia", label: "Indo-Zambia" }]} />
            <Field label="Account Number" k="bankAccountNumber" />
            <Field label="Bank Branch" k="bankBranch" span />
          </div>
        )}
        {step === 3 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            <Field label="NRC" k="nrc" />
            <Field label="TPIN" k="tpin" />
            <div className="bk-admin-card" style={{ gridColumn: "1 / -1", marginTop: 8 }}>
              <div className="bk-admin-card-header"><h3>Live Payroll Preview — ZRA 2025</h3></div>
              <div className="bk-admin-card-content" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                {[
                  ["Gross", gross, "var(--bk-ink)"],
                  ["NAPSA (5% capped)", preview.nAPSA, "var(--bk-ink-3)"],
                  ["NHIMA (1%)", preview.nhima, "var(--bk-ink-3)"],
                  ["PAYE", preview.paye, "#d89c11"],
                ].map(([label, value, color]) => (
                  <div key={label as string} className="bk-admin-stat-box">
                    <div className="bk-admin-stat-box-label">{label}</div>
                    <div className="bk-admin-stat-box-value" style={{ color: color as string }}>ZMW {Math.round((value as number) * 100) / 100}</div>
                  </div>
                ))}
                <div className="bk-admin-stat-box dark" style={{ gridColumn: "1 / -1" }}>
                  <div className="bk-admin-stat-box-label">Net Pay</div>
                  <div className="bk-admin-stat-box-value" style={{ color: "#fff", fontSize: 26 }}>ZMW {Math.round(preview.net * 100) / 100}</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bk-admin-card-header" style={{ justifyContent: "space-between" }}>
        <button type="button" className="bk-btn bk-btn-secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          <ChevronLeft size={16} /> Back
        </button>
        {step < STEPS.length - 1 ? (
          <button type="button" className="bk-btn bk-btn-primary" onClick={() => setStep((s) => s + 1)}>
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button type="button" className="bk-btn bk-btn-primary" onClick={save} disabled={saving}>
            <Save size={16} /> {saving ? "Saving…" : form.id ? "Save Changes" : "Create Employee"}
          </button>
        )}
      </div>
    </div>
  );
}