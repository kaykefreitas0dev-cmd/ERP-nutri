// POST /api/auth/signin-password — login por email+senha (workaround pro SMTP)
//
// O magic link via SMTP padrão do Supabase tem rate limit 2/h e baixa entrega.
// Esta rota permite login direto enquanto Resend SMTP não está configurado
// no Supabase Auth.
//
// Lock 7 ainda vale: o user já precisa ter conta criada (via Studio ou invite).

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SigninSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(6).max(72),
});

export async function POST(request: NextRequest) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = SigninSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Email ou senha inválidos" },
      { status: 400 },
    );
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Não vaza se foi email errado vs senha errada
    return NextResponse.json(
      { error: "Email ou senha incorretos" },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
