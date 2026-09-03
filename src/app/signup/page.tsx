import type { Metadata } from "next"
import { Suspense } from "react"
import SignupExperience from "@/components/auth/SignupExperience"
import "../signup.css"

export const metadata: Metadata = {
  title: "Create your account — Ukuu HR",
  description:
    "Set up your Ukuu HR workspace in minutes — employees, attendance, leave, payroll, and statutory compliance.",
}

function SignupFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#ffffff",
        fontFamily: "var(--font-jakarta), sans-serif",
        color: "#64748b",
        fontSize: 14,
      }}
    >
      Loading sign-up…
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupExperience />
    </Suspense>
  )
}
