/**
 * Sanitizes a post-sign-in redirect target. Only same-origin relative paths are allowed,
 * which blocks open redirects such as `?next=https://evil.example` or `?next=//evil.example`.
 */
export function safeNext(value: string | string[] | null | undefined, fallback = "/tasks"): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || typeof raw !== "string") return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  if (raw.startsWith("/auth/") || raw.startsWith("/api/")) return fallback;
  try {
    const url = new URL(raw, "http://local.invalid");
    if (url.origin !== "http://local.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
