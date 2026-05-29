// Helper para validar URLs de redirect contra open-redirect attacks.
//
// CORREÇÃO QA #10 — /auth/callback usava `new URL(next, origin)` que aceita
// URLs absolutas (https://evil.com), permitindo phishing pós-OAuth.

export function safeNextRedirect(
  next: string | null | undefined,
  fallback = "/app",
): string {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return fallback;
  if (!/^\/[^/\\]/.test(trimmed)) return fallback;
  return trimmed;
}
