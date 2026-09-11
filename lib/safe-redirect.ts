// Guards against open-redirect: only ever redirect to a same-origin,
// path-only destination. Rejects protocol-relative ("//evil.com") and
// backslash ("/\evil.com" — some browsers treat this as protocol-relative
// too) variants, and anything that isn't a plain path.
export function safeRedirectPath(raw: string | null, fallback = "/dashboard") {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }
  return raw;
}
