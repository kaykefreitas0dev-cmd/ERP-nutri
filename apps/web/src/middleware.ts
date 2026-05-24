// Next.js middleware — refresh sessão Supabase + redirect protegido + headers segurança
// ADR 0045 — Helmet equivalente via middleware + CSP report-only
//
// CORREÇÃO QA #6 + #7:
//   #6 — `pathname.startsWith("/app")` matchava /applications, /appointments etc.
//        Agora usa matchProtected() com prefixo exato.
//   #7 — Headers de segurança eram duplicados 3 vezes (drift garantido a cada
//        mudança). Extraídos para applySecurityHeaders().

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth",
  "/api/public",
  "/api/health",
  "/_next",
  "/favicon.ico",
];

// CSP em report-only durante S2b-S10; enforce após.
// v11.2 Diff B.9 — domínios whitelistados (Sanity/PostHog/Sentry)
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.sentry.io https://*.posthog.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://cdn.sanity.io",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://*.sentry.io https://*.i.posthog.com wss://*.supabase.co",
  "frame-src 'self' https://*.sanity.io",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "report-uri /api/csp-report",
].join("; ");

/**
 * CORREÇÃO QA #7 — extração do bloco de 6 headers que era repetido 3x.
 * Idempotente: pode chamar duas vezes no mesmo response sem efeitos colaterais.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy-Report-Only", CSP_REPORT_ONLY);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  return response;
}

/**
 * CORREÇÃO QA #6 — match exato de prefixo de rota protegida.
 * `startsWith("/app")` matchava /applications, /appointments, /app-store etc.
 * Agora aceita só "/app" ou "/app/…".
 */
function isProtectedRoute(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Inicia response com headers de segurança aplicados
  let response = applySecurityHeaders(NextResponse.next({ request }));

  // Public paths: apenas headers, sem auth check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return response;
  }

  // Auth check para rotas protegidas (/app + /app/*)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Sem Supabase configurado, deixar passar (build/CI sem env)
    return response;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = applySecurityHeaders(NextResponse.next({ request }));
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANTE: chamar getUser() (não getSession) para revalidar token com Supabase Auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Rotas que exigem autenticação
  if (!user && isProtectedRoute(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except:
    // - _next/static (static files)
    // - _next/image (image optimization)
    // - favicon.ico
    // - public files (svg, png, etc.)
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.webp).*)",
  ],
};
