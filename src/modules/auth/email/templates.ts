/** Plain, accessible auth emails. Restyle per app; keep the text version. */

export type OtpType = "sign-in" | "email-verification" | "forget-password";

const SUBJECTS: Record<OtpType, string> = {
  "sign-in": "Your sign-in code",
  "email-verification": "Verify your email",
  "forget-password": "Reset your password",
};

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);

export function otpEmail({ appName, code, type }: { appName: string; code: string; type: OtpType }) {
  const subject = `${SUBJECTS[type]} for ${appName}`;
  const text = `${SUBJECTS[type]}: ${code}\n\nThe code expires in a few minutes. If you didn't ask for it, ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px">
<p>${escapeHtml(SUBJECTS[type])} for ${escapeHtml(appName)}:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:6px">${escapeHtml(code)}</p>
<p style="color:#555">The code expires in a few minutes. If you didn't ask for it, ignore this email.</p>
</div>`;
  return { subject, text, html };
}

export function magicLinkEmail({ appName, url, type }: { appName: string; url: string; type: OtpType }) {
  const subject = `${SUBJECTS[type]} for ${appName}`;
  const text = `${SUBJECTS[type]}: ${url}\n\nIf you didn't ask for it, ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px">
<p><a href="${escapeHtml(url)}">${escapeHtml(SUBJECTS[type])}</a> for ${escapeHtml(appName)}.</p>
<p style="color:#555">If you didn't ask for it, ignore this email.</p>
</div>`;
  return { subject, text, html };
}
