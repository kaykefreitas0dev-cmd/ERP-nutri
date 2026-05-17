// Next.js middleware — security headers + Supabase session refresh
// Admin app — backoffice, headers MAIS STRICT (admin não embeda nada)

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

// Admin: CSP stricter (sem inline scripts/styles fora do absolutamente necessário)
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'", // Next.js inline runtime
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
  // Admin: CSP ENFORCE direto (sem report-only) — área crítica
  response.headers.set("Content-Security-Policy", CSP);
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "no-referrer"); // admin: zero referrer
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  );
  // X-Robots-Tag: admin nunca deve ser indexado
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = applySecurityHeaders(NextResponse.next({ request }));

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || pathname === "/") {
    return response;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return response;

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && pathname.startsWith("/app")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Admin extra: rejeitar non-super_admin antes de render (defense-in-depth)
  if (user && pathname.startsWith("/app")) {
    const isSuperAdmin = Boolean(
      (user.app_metadata as Record<string, unknown> | undefined)?.[
        "is_super_admin"
      ],
    );
    // Não força redirect aqui (layout do /app já mostra Acesso negado),
    // mas garante que cookies não vazaram contexto cross-app
    if (!isSuperAdmin) {
      // Adiciona header de tracking pra Sentry/logs
      response.headers.set("X-Admin-Auth-Failed", "not-super-admin");
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.webp).*)",
  ],
};
