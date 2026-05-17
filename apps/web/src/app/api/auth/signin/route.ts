// POST /api/auth/signin — Magic link via email (Supabase Auth)
// Lock 7 (Invite-Only) — fluxo apenas para nutris já com Membership ativa
// Para pacientes, ver apps/patient/src/app/api/patient/invite (S12b)

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const SigninSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
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
      { error: "Invalid email", details: parsed.error.flatten() },
      { status: 400 },
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
    console.error("[auth/signin]", error);
    // Não revelar se email existe ou não (security best practice)
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
