import type { Metadata } from "next"
import { Suspense } from "react"
import AuthExperience from "@/components/auth/AuthExperience"
import { IS_ADMIN_PLATFORM } from "@/lib/platform"
import "../auth.css"

export const metadata: Metadata = IS_ADMIN_PLATFORM
  ? {
      title: "Platform Admin Sign in — Ukuu",
      description:
        "Restricted console for Ukuu platform administrators — access codes, tenant oversight and security.",
    }
  : {
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
        background: IS_ADMIN_PLATFORM ? "#0a1128" : "#f7f5fc",
        fontFamily: "var(--font-jakarta), sans-serif",
        color: IS_ADMIN_PLATFORM ? "#c4b5fd" : "#6b7280",
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
