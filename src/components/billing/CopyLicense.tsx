"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function CopyLicense({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title="Copy license code"
      aria-label="Copy license code"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        background: "rgba(255,255,255,.12)",
        border: "1px solid rgba(255,255,255,.25)",
        color: copied ? "#6EE7B7" : "#fff",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: ".04em",
        padding: "7px 12px",
        borderRadius: 9,
        cursor: "pointer",
      }}
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {code}
    </button>
  );
}