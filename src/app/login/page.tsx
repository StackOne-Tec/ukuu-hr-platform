import type { Metadata } from "next"
import { Suspense } from "react"
import AuthExperience from "@/components/auth/AuthExperience"
import "../auth.css"

export const metadata: Metadata = {
  title: "Sign in — Ukuu HR",
  description:
    "Sign in to your Ukuu HR workspace to manage employees, payroll, leave and attendance.",
}

function AuthFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        background: "#f7f5fc",
        fontFamily: "var(--font-jakarta), sans-serif",
        color: "#6b7280",
        fontSize: 14,
      }}
    >
      Loading sign-in…
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <AuthExperience />
    </Suspense>
  )
}
