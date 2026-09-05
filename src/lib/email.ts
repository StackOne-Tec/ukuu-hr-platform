import "server-only";
import { resend } from "@/lib/resend";

/**
 * Sending address. Until a domain is verified in Resend, only the shared
 * `onboarding@resend.dev` sender is allowed. Replace EMAIL_FROM with your own
 * address once you verify a domain (e.g. no-reply@yourcompany.com).
 */
const FROM = process.env.EMAIL_FROM ?? "Ukuu HR <onboarding@resend.dev>";

export type SendResult = { ok: boolean; error?: string };

/** Never throws — callers can fire-and-forget without breaking the request. */
export async function sendEmail(to: string, subject: string, html: string): Promise<SendResult> {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed to send email" };
  }
}

const SHELL = (title: string, body: string) => `
  <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 32px 24px; color: #1a1a2e; background: #faf9fc;">
    <div style="background: #ffffff; border-radius: 14px; padding: 28px; border: 1px solid #ece8f4;">
      <div style="font-weight: 800; font-size: 18px; color: #7B2FBE; letter-spacing: .02em; margin-bottom: 18px;">UKUU HR</div>
      <h1 style="font-size: 17px; margin: 0 0 12px;">${title}</h1>
      ${body}
    </div>
    <p style="font-size: 12px; color: #8b87a0; margin-top: 18px; text-align: center;">
      Ukuu HR · HRMS Platform · <a href="https://ukuuhr.app" style="color: #7B2FBE;">ukuuhr.app</a>
    </p>
  </div>
`;

export function welcomeEmailHtml(name: string, workspace: string): string {
  return SHELL(
    `Welcome aboard${name ? `, ${name}` : ""}! 🎉`,
    `
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Your <strong>Ukuu HR</strong> workspace is ready. You can start adding employees,
        tracking attendance, and running payroll right away.
      </p>
      <p style="font-size: 14px; margin: 0 0 20px;">
        Workspace: <strong style="color: #7B2FBE;">${workspace}</strong>
      </p>
      <a href="https://ukuuhr.app/login" style="display: inline-block; background: linear-gradient(135deg,#7B2FBE,#6A24A8); color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 22px; border-radius: 10px;">Sign in to your workspace</a>
    `
  );
}

export function accessCodeRedeemedEmailHtml(opts: {
  code: string;
  orgName: string;
  plan: string;
  expiresAt: Date | string | null;
  redeemedAt: Date | string;
}): string {
  const when = new Date(opts.redeemedAt).toLocaleString("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const expires = opts.expiresAt
    ? new Date(opts.expiresAt).toLocaleDateString("en", { day: "2-digit", month: "short", year: "numeric" })
    : "Never";
  const row = (label: string, value: string) => `
    <tr>
      <td style="padding: 8px 12px; font-size: 12.5px; color: #8b87a0; font-weight: 600; white-space: nowrap;">${label}</td>
      <td style="padding: 8px 12px; font-size: 13.5px; font-weight: 700; color: #1a1a2e;">${value}</td>
    </tr>
  `;
  return SHELL(
    "Access code redeemed",
    `
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        A workspace has redeemed an access code. The subscription is now active and
        the code can no longer be used.
      </p>
      <table style="border-collapse: collapse; width: 100%; margin: 0 0 20px; border: 1px solid #ece8f4; border-radius: 10px; overflow: hidden;">
        ${row("Access code", `<span style="font-family: ui-monospace, Menlo, monospace;">${opts.code}</span>`)}
        ${row("Workspace", opts.orgName)}
        ${row("Plan", opts.plan)}
        ${row("Expires", expires)}
        ${row("Redeemed", when)}
      </table>
      <p style="font-size: 12px; color: #8b87a0; margin: 0; line-height: 1.5;">
        Manage and issue new access codes in your Ukuu HR admin portal.
      </p>
    `
  );
}

export function passwordResetEmailHtml(name: string, resetUrl: string): string {
  return SHELL(
    "Reset your password",
    `
      <p style="font-size: 14px; line-height: 1.6; margin: 0 0 16px;">
        Hi${name ? ` ${name}` : ""}, we received a request to reset the password for your Ukuu HR account.
      </p>
      <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg,#7B2FBE,#6A24A8); color: #fff; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 22px; border-radius: 10px;">Reset password</a>
      <p style="font-size: 12px; color: #8b87a0; margin: 18px 0 0; line-height: 1.5;">
        If you didn't request this, you can safely ignore this email.
      </p>
    `
  );
}