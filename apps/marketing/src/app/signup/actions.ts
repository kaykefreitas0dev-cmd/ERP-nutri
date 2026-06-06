"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@nutricore/db";

// Cadastro do nutri é invite-only no MVP (Lock 7, shouldCreateUser:false).
// Esta página captura o lead de "Começar grátis" como ContactSubmission
// (subject=commercial) — o PM libera o acesso. Evita o 404 do /signup.

const SignupSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().max(40).optional().or(z.literal("")),
  plan: z.string().max(40).optional().or(z.literal("")),
  note: z.string().max(2000).optional().or(z.literal("")),
});

export interface SubmitSignupResult {
  ok: boolean;
  message: string;
}

export async function submitSignupAction(
  formData: FormData,
): Promise<SubmitSignupResult> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    plan: formData.get("plan") || "",
    note: formData.get("note") || "",
  };

  const parsed = SignupSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Verifique os campos: " +
        Object.values(parsed.error.flatten().fieldErrors).flat().join(", "),
    };
  }
  const d = parsed.data;

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent") ?? null;

  const message = [
    `Solicitação de acesso (Começar grátis).`,
    d.plan ? `Plano de interesse: ${d.plan}.` : null,
    d.note ? `Observação: ${d.note}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  try {
    await prisma.contactSubmission.create({
      data: {
        name: d.name,
        email: d.email,
        phone: d.phone || null,
        subject: "commercial",
        message,
        ipAddress: ip,
        userAgent: ua,
        status: "pending",
      },
    });

    return {
      ok: true,
      message:
        "Recebemos sua solicitação! Vamos liberar seu acesso e entrar em contato pelo email informado em até 1 dia útil.",
    };
  } catch (err) {
    console.error("[signup] submit", err);
    return {
      ok: false,
      message:
        "Erro ao enviar. Tente novamente em alguns minutos ou escreva para suporte@nutricore.app.",
    };
  }
}
