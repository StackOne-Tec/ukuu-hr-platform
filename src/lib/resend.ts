import "server-only";
import { Resend } from "resend";

let _client: Resend | null = null;
let _warned = false;

/**
 * Lazily-built Resend client. Returns `null` (after one warning) when
 * RESEND_API_KEY is not set, so importing this module — which Next.js also
 * does at build time while collecting page data — never throws. Email senders
 * must treat a `null` client as "email disabled" and continue.
 */
export function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (!_warned) {
      _warned = true;
      console.warn("[email] RESEND_API_KEY is not set — transactional email is disabled.");
    }
    return null;
  }
  if (!_client) {
    _client = new Resend(apiKey);
  }
  return _client;
}
