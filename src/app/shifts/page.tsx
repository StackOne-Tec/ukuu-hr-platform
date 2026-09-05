import type { Metadata } from "next";

export const dynamic = "force-dynamic";
import ShiftsView from "@/components/shifts/ShiftsView";
import { getShifts, getEmployees } from "@/lib/queries";

export const metadata: Metadata = { title: "Shifts · Ukuu HR" };

export default async function ShiftsPage() {
  const [shiftRes, empRes] = await Promise.all([getShifts(), getEmployees()]);
  return (
    <ShiftsView
      data={shiftRes.data}
      employees={empRes.data.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, department: e.department }))}
      departments={(Array.from(new Set(empRes.data.map((e) => e.department))) as string[]).filter((d) => d !== "—")}
    />
  );
}