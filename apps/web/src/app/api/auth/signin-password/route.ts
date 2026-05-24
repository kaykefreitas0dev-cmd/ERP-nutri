// POST /api/auth/signin-password — login por email+senha (workaround pro SMTP)
//
// O magic link via SMTP padrão do Supabase tem rate limit 2/h e baixa entrega.
// Esta rota permite login direto enquanto Resend SMTP não está configurado
// no Supabase Auth.
//
// Lock 7 ainda vale: o user já precisa ter conta criada (via Studio ou invite).
//
// CORREÇÃO QA #2 — rate limit per-IP + per-email contra brute force.
// Política: 5 tentativas por email a cada 10 min, 20 por IP a cada 10 min.

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
  // CORREÇÃO QA: forçar política mínima de senha. Supabase default já é 6.
  // Aceitamos 8+ para reduzir surface de brute force (sem prejuízo se Supabase
  // foi configurado com menos).
  password: z.string().min(8).max(72),
});

export async function POST(request: NextRequest) {
  // 1. Rate limit por IP — 20 tentativas / 10min
  const ipLimit = await checkRateLimit(request, "auth:password:ip", {
    max: 20,
    windowSec: 600,
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
    // Mensagem genérica para não vazar se foi email ou senha que falhou.
    return NextResponse.json(
      { error: "Email ou senha inválidos" },
      { status: 400 },
    );
  }

  // 3. Rate limit por email — 5 tentativas / 10min (anti brute force focado)
  const emailLimit = await checkRateLimit(request, "auth:password:email", {
    max: 5,
    windowSec: 600,
    identifier: parsed.data.email,
  });
  if (!emailLimit.ok) {
    // Resposta com 429 explícito (cliente pode mostrar "Aguarde X segundos")
    return rateLimitResponse(emailLimit);
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Log sem PII — não logamos email nem senha.
    console.error("[auth/signin-password] failed", {
      code: error.code,
      status: error.status,
      ip: getClientId(request),
    });
    return NextResponse.json(
      { error: "Email ou senha incorretos" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
