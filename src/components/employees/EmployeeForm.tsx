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

type FieldProps = {
  label: string;
  k: keyof EmployeeFormData;
  type?: string;
  options?: { value: string; label: string }[];
  span?: boolean;
  form: EmployeeFormData;
  set: (k: keyof EmployeeFormData, v: string | number) => void;
};

/* Defined at module scope (not inside the form component) so its identity is
   stable across renders — defining it inline makes React remount the inputs on
   every keystroke, which drops focus after the first character. */
function Field({ label, k, type = "text", options, span, form, set }: FieldProps) {
  return (
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
}

export default function EmployeeForm({ departments, initialData }: { departments: { id: string; name: string }[]; initialData?: Partial<EmployeeFormData> }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<EmployeeFormData>({ ...initial, ...initialData });
  const set = (k: keyof EmployeeFormData, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) {
        setError(json.error ?? "Failed to save employee. Please try again.");
        return;
      }
      router.push(form.id ? `/employees/${form.id}` : `/employees/${json.id}`);
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setSaving(false);
    }
  };

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

      {error && (
        <div role="alert" style={{ margin: "16px 24px 0", padding: "12px 14px", borderRadius: 10, color: "#B42318", background: "#FEF3F2", border: "1px solid #FDA29B", fontSize: 13, fontWeight: 600 }}>
          {error}
        </div>
      )}

      <div className="bk-admin-card-content">
        {step === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            <Field label="First Name *" k="firstName" form={form} set={set} />
            <Field label="Last Name *" k="lastName" form={form} set={set} />
            <Field label="Email *" k="email" type="email" form={form} set={set} />
            <Field label="Phone" k="phone" form={form} set={set} />
            <Field label="Gender" k="gender" options={[{ value: "", label: "Select…" }, { value: "Female", label: "Female" }, { value: "Male", label: "Male" }]} form={form} set={set} />
            <Field label="Marital Status" k="maritalStatus" options={[{ value: "", label: "Select…" }, { value: "Single", label: "Single" }, { value: "Married", label: "Married" }, { value: "Divorced", label: "Divorced" }]} form={form} set={set} />
            <Field label="Date of Birth" k="dateOfBirth" type="date" form={form} set={set} />
            <Field label="Address" k="address" form={form} set={set} />
            <Field label="Emergency Contact" k="emergencyContact" span form={form} set={set} />
          </div>
        )}
        {step === 1 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 18px" }}>
            <Field label="Employee Code" k="employeeCode" form={form} set={set} />
            <Field label="Position / Job Title *" k="position" form={form} set={set} />
            <Field label="Department" k="departmentId" options={[{ value: "", label: "Select…" }, ...departments.map((d) => ({ value: d.id, label: d.name }))]} form={form} set={set} />
            <Field label="Employment Type" k="employmentType" options={[{ value: "Full-time", label: "Full-time" }, { value: "Part-time", label: "Part-time" }, { value: "Contract", label: "Contract" }]} form={form} set={set} />
            <Field label="Status" k="status" options={[{ value: "Active", label: "Active" }, { value: "Probation", label: "Probation" }, { value: "Inactive", label: "Inactive" }]} form={form} set={set} />
            <Field label="Hire Date" k="hireDate" type="date" form={form} set={set} />
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