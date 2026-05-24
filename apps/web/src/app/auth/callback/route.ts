// GET /auth/callback — magic link redirect target
// Supabase Auth troca o code do query string por session cookie
//
// CORREÇÃO QA #10: validação de `next` contra open redirect (phishing).

import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextRedirect } from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  // CORREÇÃO QA #10: bloqueia ?next=https://evil.com.
  const next = safeNextRedirect(searchParams.get("next"), "/app");

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", origin));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[auth/callback]", error);
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, origin),
    );
  }

  // Após login bem-sucedido, redirecionar para next (default: /app)
  // /app vai precisar setar current_org se user tiver múltiplas memberships
  return NextResponse.redirect(new URL(next, origin));
}
