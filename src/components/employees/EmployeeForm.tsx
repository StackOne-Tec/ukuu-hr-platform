"use client";

import { useState } from "react";
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

const STEPS = ["Personal", "Employment"];

const initial: EmployeeFormData = {
  employeeCode: "", firstName: "", lastName: "", email: "", phone: "",
  position: "", departmentId: "", employmentType: "Full-time", status: "Active",
  hireDate: new Date().toISOString().slice(0, 10), salary: 0, basicSalary: 0,
  nrc: "", tpin: "", bankName: "", bankAccountNumber: "", bankBranch: "",
  gender: "", maritalStatus: "", dateOfBirth: "", address: "", emergencyContact: "",
};

export default function EmployeeForm({ departments, initialData }: { departments: { id: string; name: string }[]; initialData?: Partial<EmployeeFormData> }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<EmployeeFormData>({ ...initial, ...initialData });
  const set = (k: keyof EmployeeFormData, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

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