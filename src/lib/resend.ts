import "server-only";
import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  throw new Error("RESEND_API_KEY is not defined — add it to .env to send transactional email.");
}

export const resend = new Resend(apiKey);