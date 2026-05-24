// Helper para validar URLs de redirect contra open-redirect attacks.
//
// CORREÇÃO QA #10 — /auth/callback usava `new URL(next, origin)` que aceita
// URLs absolutas (https://evil.com), permitindo phishing pós-OAuth.

/**
 * Valida e normaliza um path de redirect. Aceita apenas paths absolutos
 * dentro do app (começando com `/`, sem ser `//` ou `/\`).
 *
 * - "/app" → "/app"
 * - "/auth/accept-invite?token=abc" → "/auth/accept-invite?token=abc"
 * - "https://evil.com" → fallback (rejeita URL absoluta)
 * - "//evil.com" → fallback (protocol-relative URL)
 * - "/\\evil.com" → fallback (windows-style)
 * - null / "" / undefined → fallback
 */
export function safeNextRedirect(
  next: string | null | undefined,
  fallback = "/app",
): string {
  if (!next || typeof next !== "string") return fallback;
  const trimmed = next.trim();
  if (trimmed.length === 0 || trimmed.length > 2048) return fallback;
  // Reject anything that doesn't start with a single forward slash followed
  // by a path char (not / or \). Cobre: //evil.com, /\evil.com, ./../, ?abc.
  if (!/^\/[^/\\]/.test(trimmed)) return fallback;
  return trimmed;
}
