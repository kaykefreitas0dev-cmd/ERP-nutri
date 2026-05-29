// CORREÇÃO QA #10: validação de `next` contra open redirect (phishing).

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeNextRedirect } from "@/lib/safe-redirect";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  // CORREÇÃO QA #10: bloqueia ?next=https://evil.com.
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
