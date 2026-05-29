// Auth callback — Supabase Auth OAuth/magic-link return point.
//
// CORREÇÃO QA #10: validação de `next` contra open redirect.
// Sem isso: ?next=https://evil.com seria seguido pelo navegador.

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextRedirect } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // CORREÇÃO QA #10: rejeitar URLs absolutas/protocol-relative em `next`.
  const next = safeNextRedirect(url.searchParams.get("next"), "/app");

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
