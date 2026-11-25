// @auth-module: file (deleted by scripts/remove-auth.ts).
import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { otpEmail } from "@/modules/auth/email/templates";
import { createVerifier, MAX_AGE_MS } from "@/modules/auth/email/verify";

// Signs exactly like Neon's documented scheme, with a throwaway Ed25519 key.
const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1" };
const b64url = (s: string) => Buffer.from(s).toString("base64url");

function signed(body: string, timestamp: number) {
  const header = b64url(JSON.stringify({ alg: "EdDSA", typ: "JWS", kid: "key-1" }));
  const signingInput = `${header}.${b64url(`${timestamp}.${b64url(body)}`)}`;
  const sig = sign(null, Buffer.from(signingInput), privateKey).toString("base64url");
  return { signature: `${header}..${sig}`, kid: "key-1", timestamp: String(timestamp) };
}

describe("Neon Auth webhook verification", () => {
  const body = JSON.stringify({ event_type: "send.otp", user: { email: "a@example.test" } });
  const now = 1_800_000_000_000;

  it("accepts a correctly signed, fresh request", async () => {
    const verifyWebhook = createVerifier(async () => ({ keys: [jwk] }));
    await expect(verifyWebhook({ rawBody: body, ...signed(body, now), now })).resolves.toEqual({ ok: true });
  });

  it("rejects a tampered body", async () => {
    const verifyWebhook = createVerifier(async () => ({ keys: [jwk] }));
    const headers = signed(body, now);
    const result = await verifyWebhook({ rawBody: body.replace("a@", "b@"), ...headers, now });
    expect(result).toEqual({ ok: false, reason: "bad signature" });
  });

  it("rejects stale timestamps (replay)", async () => {
    const verifyWebhook = createVerifier(async () => ({ keys: [jwk] }));
    const result = await verifyWebhook({ rawBody: body, ...signed(body, now), now: now + MAX_AGE_MS + 1 });
    expect(result).toMatchObject({ ok: false });
  });

  it("rejects unknown keys and missing headers, fetching JWKS at most once per minute", async () => {
    const fetchJwks = vi.fn(async () => ({ keys: [{ ...jwk, kid: "other" }] }));
    const verifyWebhook = createVerifier(fetchJwks);
    await expect(verifyWebhook({ rawBody: body, ...signed(body, now), now })).resolves.toMatchObject({ ok: false });
    await expect(verifyWebhook({ rawBody: body, ...signed(body, now), now })).resolves.toMatchObject({ ok: false });
    expect(fetchJwks).toHaveBeenCalledTimes(1);
    await expect(verifyWebhook({ rawBody: body, signature: null, kid: null, timestamp: null })).resolves.toMatchObject({
      ok: false,
    });
  });
});

describe("otpEmail", () => {
  it("escapes the app name and includes the code in text and html", () => {
    const email = otpEmail({ appName: "<Acme>", code: "123456", type: "sign-in" });
    expect(email.subject).toBe("Your sign-in code for <Acme>");
    expect(email.text).toContain("123456");
    expect(email.html).toContain("&lt;Acme&gt;");
  });
});
