// Next.js middleware — security headers + Supabase session refresh
// Patient app — escopo público (não tem RBAC complexo) + headers strict

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/invite",
  "/auth/callback",
  "/auth/accept-invite",
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/manifest.webmanifest",
];

// CSP report-only durante hardening — enforce após 2 sprints
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("Content-Security-Policy-Report-Only", CSP);
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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = applySecurityHeaders(NextResponse.next({ request }));

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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

  // CORREÇÃO QA #6: startsWith("/app") matchava /applications etc.
  // Aceita só /app ou /app/...
  const isProtected = pathname === "/app" || pathname.startsWith("/app/");
  if (!user && isProtected) {
    const loginUrl = new URL("/login", request.url);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.webp).*)",
  ],
};
