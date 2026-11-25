# 0006: Security headers without a script-src CSP (for now)

Date: 2026-11-24 · Status: accepted

**Context.** A strict `script-src` CSP needs per-request nonces, which force dynamic rendering of every
page and conflict with Cache Components' static shells.

**Decision.** `next.config.ts` sends HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`,
`Permissions-Policy`, COOP and a CSP limited to `frame-ancestors`, `base-uri`, `form-action` and
`object-src`.

**Consequences.** XSS protection relies on React's escaping. Revisit when Next.js ships hash-based CSP
for prerendered pages.
