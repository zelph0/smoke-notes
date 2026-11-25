import { createPublicKey, type JsonWebKey, verify } from "node:crypto";

/**
 * Verifies a Neon Auth webhook: detached JWS signed with Ed25519, public keys from the branch's
 * JWKS (`<NEON_AUTH_BASE_URL>/.well-known/jwks.json`). See https://neon.com/docs/auth/guides/webhooks.
 * Signing input: `<jws header>.<base64url(timestamp + "." + base64url(rawBody))>`.
 */

export const MAX_AGE_MS = 5 * 60 * 1000;

type Jwk = JsonWebKey & { kid?: string };
export type FetchJwks = () => Promise<{ keys: Jwk[] }>;

const b64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

export type VerifyInput = {
  rawBody: string;
  signature: string | null;
  kid: string | null;
  timestamp: string | null;
  now?: number;
};

export type VerifyResult = { ok: true } | { ok: false; reason: string };

export function createVerifier(fetchJwks: FetchJwks) {
  let cache: Jwk[] = [];
  let lastRefresh = 0;

  async function keyFor(kid: string): Promise<Jwk | undefined> {
    let key = cache.find((k) => k.kid === kid);
    // Unknown kid: refresh (rate-limited to once a minute) to pick up key rotation.
    if (!key && Date.now() - lastRefresh > 60_000) {
      lastRefresh = Date.now();
      cache = (await fetchJwks()).keys;
      key = cache.find((k) => k.kid === kid);
    }
    return key;
  }

  return async function verifyWebhook(input: VerifyInput): Promise<VerifyResult> {
    const { rawBody, signature, kid, timestamp } = input;
    if (!signature || !kid || !timestamp) return { ok: false, reason: "missing signature headers" };

    const sentAt = Number(timestamp);
    if (!Number.isFinite(sentAt) || Math.abs((input.now ?? Date.now()) - sentAt) > MAX_AGE_MS) {
      return { ok: false, reason: "stale or invalid timestamp" };
    }

    const [header, middle, sig] = signature.split(".");
    if (!header || middle !== "" || !sig) return { ok: false, reason: "malformed signature" };

    const jwk = await keyFor(kid);
    if (!jwk) return { ok: false, reason: "unknown key id" };

    const signingInput = `${header}.${b64url(`${timestamp}.${b64url(rawBody)}`)}`;
    const valid = verify(
      null,
      Buffer.from(signingInput),
      createPublicKey({ key: jwk, format: "jwk" }),
      Buffer.from(sig, "base64url"),
    );
    return valid ? { ok: true } : { ok: false, reason: "bad signature" };
  };
}
