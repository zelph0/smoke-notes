import "server-only";
import { templateConfig } from "@template/config";
import { Resend } from "resend";
import { z } from "zod";
import { env } from "@/env";
import { reportError } from "@/lib/observability";
import { magicLinkEmail, otpEmail } from "./templates";
import { createVerifier } from "./verify";

/**
 * Branded auth emails via Resend. INACTIVE unless both RESEND_API_KEY and EMAIL_FROM are set
 * AND the branch's Neon Auth webhook points here (`send.otp`, `send.magic_link`):
 *   neon neon-auth config webhook update --enabled --url https://<domain>/api/auth/email-hook \
 *     --enabled-events send.otp --enabled-events send.magic_link
 * Without it, Neon's shared sender delivers auth emails. Neon needs a public HTTPS URL, so
 * this only runs on deployed environments.
 */

const linkType = z.enum(["sign-in", "email-verification", "forget-password"]);
const eventSchema = z.discriminatedUnion("event_type", [
  z.object({
    event_type: z.literal("send.otp"),
    user: z.object({ email: z.email() }),
    context: z.object({ project_name: z.string().optional() }).optional(),
    event_data: z.object({ otp_code: z.string().min(4).max(12), otp_type: linkType }),
  }),
  z.object({
    event_type: z.literal("send.magic_link"),
    user: z.object({ email: z.email() }),
    context: z.object({ project_name: z.string().optional() }).optional(),
    event_data: z.object({ link_url: z.url(), link_type: linkType }),
  }),
]);

const verifyWebhook = createVerifier(async () => {
  const response = await fetch(`${env.NEON_AUTH_BASE_URL}/.well-known/jwks.json`);
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
  return response.json();
});

// Retries reuse the event id. Best effort per instance; Resend's idempotency key covers the rest.
const seen = new Set<string>();

export async function handleEmailHook(request: Request): Promise<Response> {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    return Response.json({ error: "email hook not configured" }, { status: 503 });
  }

  const rawBody = await request.text();
  const verified = await verifyWebhook({
    rawBody,
    signature: request.headers.get("x-neon-signature"),
    kid: request.headers.get("x-neon-signature-kid"),
    timestamp: request.headers.get("x-neon-timestamp"),
  });
  if (!verified.ok) return Response.json({ error: verified.reason }, { status: 401 });

  const eventId = request.headers.get("x-neon-event-id") ?? "";
  if (eventId && seen.has(eventId)) return Response.json({ ok: true, duplicate: true });

  const parsed = eventSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) return Response.json({ ok: true, ignored: true }); // not an email event we handle

  const event = parsed.data;
  const appName = templateConfig.name;
  const message =
    event.event_type === "send.otp"
      ? otpEmail({ appName, code: event.event_data.otp_code, type: event.event_data.otp_type })
      : magicLinkEmail({ appName, url: event.event_data.link_url, type: event.event_data.link_type });

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send(
    { from: env.EMAIL_FROM, to: event.user.email, ...message },
    eventId ? { idempotencyKey: `neon-auth-${eventId}` } : undefined,
  );
  if (error) {
    reportError(new Error(`Resend failed: ${error.message}`), { eventId, eventType: event.event_type });
    return Response.json({ error: "send failed" }, { status: 502 }); // 5xx -> Neon retries
  }
  if (eventId) {
    seen.add(eventId);
    if (seen.size > 1000) seen.clear();
  }
  return Response.json({ ok: true });
}
