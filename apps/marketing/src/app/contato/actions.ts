"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { prisma } from "@nutricore/db";

const ContactSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.string().email().toLowerCase().trim(),
  phone: z.string().max(40).optional().or(z.literal("")),
  subject: z.enum(["commercial", "support", "partnership", "press", "other"]),
  message: z.string().min(10).max(5000).trim(),
});

export interface SubmitContactResult {
  ok: boolean;
  message: string;
}

export async function submitContactAction(
  formData: FormData,
): Promise<SubmitContactResult> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || "",
    subject: formData.get("subject"),
    message: formData.get("message"),
  };

  const parsed = ContactSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Verifique os campos: " +
        Object.values(parsed.error.flatten().fieldErrors).flat().join(", "),
    };
  }

  const data = parsed.data;
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = h.get("user-agent") ?? null;

  try {
    await prisma.contactSubmission.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        subject: data.subject,
        message: data.message,
        ipAddress: ip,
        userAgent: ua,
        status: "pending",
      },
    });

    // TODO S12b: trigger queue para enviar email via Resend/SES
    // Por enquanto fica em status=pending e PM revisa no Supabase Studio.

    return {
      ok: true,
      message:
        "Recebemos sua mensagem. Vamos responder em até 1 dia útil para o email informado.",
    };
  } catch (err) {
    console.error("[contato] submit", err);
    return {
      ok: false,
      message:
        "Erro ao enviar. Tente novamente em alguns minutos ou escreva direto para suporte@nutricore.app.",
    };
  }
}
