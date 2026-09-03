import type { Metadata } from "next";
import { Suspense } from "react";
import DashboardPage from "@/components/dashboard/DashboardPage";
import "../dashboard.css";

export const metadata: Metadata = {
  title: "Workspace Overview · UkuuHR",
  description:
    "UkuuHR workspace dashboard — employees, attendance, leave, overtime and device status at a glance.",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DashboardPage />
    </Suspense>
  );
}
