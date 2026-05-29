// POST /api/auth/change-password — troca de senha do user autenticado.
//
// Requer:
// - Sessão Supabase válida (cookie ou Authorization header)
// - currentPassword (validada via re-sign-in para confirmar identidade)
// - newPassword (min 8 chars; Supabase Auth aplica HIBP check se ativado)
//
// CORREÇÃO QA: rate limit per-user (5 trocas/h previne abuse).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});

export async function POST(request: NextRequest) {
  // Parse + validate
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ChangePasswordSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validação falhou",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { currentPassword, newPassword } = parsed.data;

  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "Nova senha deve ser diferente da atual" },
      { status: 400 },
    );
  }

  // Verifica sessão autenticada
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Rate limit per-user — 5 trocas/h
  const limit = await checkRateLimit(request, "auth:change-password", {
    max: 5,
    windowSec: 3600,
    identifier: user.id,
  });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Limite de 5 trocas/h atingido. Aguarde." },
      { status: 429 },
    );
  }

  // Re-confirma identidade via signIn com senha atual.
  // Isso evita "session hijack" — atacante com token roubado não troca senha
  // sem conhecer a senha atual.
  const { error: signinError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (signinError) {
    return NextResponse.json(
      { error: "Senha atual incorreta" },
      { status: 401 },
    );
  }

  // Trocar senha. Supabase Auth aplica policy de senha (incluindo HIBP se ativado).
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });
  if (updateError) {
    // Mensagens conhecidas: "Password is too weak" / "Password has been pwned"
    return NextResponse.json(
      { error: updateError.message || "Falha ao atualizar senha" },
      { status: 400 },
    );
  }

  // Log sem PII
  console.log("[auth/change-password] OK", { userId: user.id });

  return NextResponse.json({ ok: true });
}
