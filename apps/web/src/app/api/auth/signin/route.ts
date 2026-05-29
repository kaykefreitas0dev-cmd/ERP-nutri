// POST /api/auth/signin — Magic link via email (Supabase Auth)
// Lock 7 (Invite-Only) — fluxo apenas para nutris já com Membership ativa
// Para pacientes, ver apps/patient/src/app/api/patient/invite (S12b)
//
// CORREÇÃO QA #2 — rate limit per-IP + per-email para conter brute force/spray.

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  checkRateLimit,
  getClientId,
  rateLimitResponse,
} from "@/lib/rate-limit";

const SigninSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
});

export async function POST(request: NextRequest) {
  // 1. Rate limit por IP — 10 magic links / 5min / IP (cobre ataque distribuído)
  const ipLimit = await checkRateLimit(request, "auth:signin:ip", {
    max: 10,
    windowSec: 300,
  });
  if (!ipLimit.ok) return rateLimitResponse(ipLimit);

  // 2. Parse + validação
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SigninSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid email", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // 3. Rate limit por email — 3 magic links / 5min / email (anti-spray + anti-spam)
  const emailLimit = await checkRateLimit(request, "auth:signin:email", {
    max: 3,
    windowSec: 300,
    identifier: parsed.data.email,
  });
  if (!emailLimit.ok) {
    // Resposta genérica (não revela se email existe ou está rate-limited).
    return NextResponse.json(
      {
        message:
          "Se você tem acesso a uma organização NutriCore, verifique seu email em até 5 minutos.",
      },
      { status: 200 },
    );
  }

  const supabase = await createSupabaseServerClient();
  const origin = request.headers.get("origin") ?? request.nextUrl.origin;

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
      shouldCreateUser: false, // Lock 7 — só users já convidados (Membership criada por nutri)
    },
  });

  if (error) {
    // Não logar o email — pode aparecer em log público e violar LGPD.
    console.error("[auth/signin] otp_error", {
      code: error.code,
      status: error.status,
      ip: getClientId(request),
    });
    return NextResponse.json(
      {
        message:
          "Se você tem acesso a uma organização NutriCore, verifique seu email em até 5 minutos.",
      },
      { status: 200 },
    );
  }

  return NextResponse.json(
    {
      message:
        "Se você tem acesso a uma organização NutriCore, verifique seu email em até 5 minutos.",
    },
    { status: 200 },
  );
}
