# 0002: Neon Auth (managed Better Auth), passwordless sign-in

Date: 2026-11-24 · Status: accepted

**Context.** We want users and sessions in Postgres so they branch with the data (each preview gets
its own users), and no auth server to run.

**Decision.**
- Use `@neon/auth` (the docs' current package; `@neondatabase/auth` is a stale beta), pinned exactly because it's pre-1.0.
- Sign-in is email one-time code plus Google. Neon's shared Google credentials work for dev and previews; production needs the app's own Google OAuth client.
- Email goes through Neon's shared sender by default. Branded email (Resend) is optional and configured on Neon Auth when the app needs it.
- `Task.ownerId` (and every owned table) stores the `neon_auth.user.id` as a plain string with an index. There is no cross-schema foreign key: Neon owns the `neon_auth` schema, and no FK keeps the no-auth variant identical.
- E2E uses email+password users created by the seed (password sign-in stays enabled but isn't shown in the UI).

**Consequences.**
- Deleting a user doesn't cascade to their rows. Add cleanup when an app supports account deletion.
- Google sign-in on per-PR previews uses the shared credentials, because Google doesn't allow wildcard redirect URIs.
- Auth is removable (`pnpm auth:remove`; see docs/template-contract.md).
