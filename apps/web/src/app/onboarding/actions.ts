"use server";

// CORREÇÃO QA Rodada 6: appendAuditLog helper.

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@nutricore/db";
import { appendAuditLog } from "@nutricore/db/audit";

const StepDataSchema = z.object({
  step: z.number().int().min(1).max(5),
  data: z.record(z.string(), z.unknown()),
});

export interface SaveStepResult {
  ok: boolean;
  message?: string;
  nextStep?: number;
}

export async function saveStepAction(input: {
  step: number;
  data: Record<string, unknown>;
}): Promise<SaveStepResult> {
  const parsed = StepDataSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Dados inválidos" };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado" };

  const existing = await prisma.onboardingProgress.findUnique({
    where: { userId: user.id },
    select: { data: true, currentStep: true },
  });

  // JSON.parse(JSON.stringify(...)) garante que merged é JSON-serializable
  // (Prisma's Json type só aceita InputJsonValue, não unknown)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const merged: any = JSON.parse(
    JSON.stringify({
      ...(existing?.data as Record<string, unknown>),
      ...parsed.data.data,
    }),
  );

  const nextStep = Math.max(parsed.data.step + 1, existing?.currentStep ?? 1);

  await prisma.onboardingProgress.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      currentStep: nextStep,
      data: merged,
    },
    update: {
      currentStep: nextStep,
      data: merged,
    },
  });

  return { ok: true, nextStep };
}

const CompleteSchema = z.object({
  orgName: z.string().min(2).max(120).trim(),
  orgSlug: z
    .string()
    .min(3)
    .max(40)
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen"),
  fullName: z.string().min(2).max(120).trim(),
  professionalType: z.enum(["nutricionista_autonomo", "clinica", "outro"]),
  crn: z.string().max(40).optional().or(z.literal("")),
  acceptedTerms: z.literal(true),
});

export async function completeOnboardingAction(
  formData: FormData,
): Promise<{ ok: boolean; message?: string; orgSlug?: string }> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Não autenticado" };

  // Buscar progresso pra mesclar com dados finais
  const progress = await prisma.onboardingProgress.findUnique({
    where: { userId: user.id },
  });
  const collected = (progress?.data as Record<string, unknown>) ?? {};

  const merged = {
    orgName: formData.get("orgName") ?? collected.orgName,
    orgSlug: formData.get("orgSlug") ?? collected.orgSlug,
    fullName: formData.get("fullName") ?? collected.fullName,
    professionalType:
      formData.get("professionalType") ?? collected.professionalType,
    crn: formData.get("crn") ?? collected.crn ?? "",
    acceptedTerms:
      formData.get("acceptedTerms") === "on" ||
      collected.acceptedTerms === true,
  };

  const parsed = CompleteSchema.safeParse(merged);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Campos inválidos: " +
        Object.entries(parsed.error.flatten().fieldErrors)
          .map(([k, v]) => `${k} (${v?.join(", ")})`)
          .join("; "),
    };
  }

  const data = parsed.data;

  // Slug uniqueness check
  const exists = await prisma.organization.findUnique({
    where: { slug: data.orgSlug },
  });
  if (exists) {
    return {
      ok: false,
      message: `Slug "${data.orgSlug}" já está em uso. Escolha outro.`,
    };
  }

  // Criar organização + membership ativa em transação
  const org = await prisma.$transaction(async (tx) => {
    const newOrg = await tx.organization.create({
      data: {
        slug: data.orgSlug,
        name: data.orgName,
        plan: "starter",
        subscriptionStatus: "TRIALING",
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 dias
      },
    });

    // Atualizar User.fullName se ainda não tinha
    await tx.user.update({
      where: { id: user.id },
      data: { fullName: data.fullName },
    });

    // Criar membership como org_owner
    await tx.membership.create({
      data: {
        userId: user.id,
        organizationId: newOrg.id,
        role: "org_owner",
        status: "ACTIVE",
        acceptedAt: new Date(),
      },
    });

    // Marcar onboarding como completo
    await tx.onboardingProgress.update({
      where: { userId: user.id },
      data: {
        completedAt: new Date(),
        organizationId: newOrg.id,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: JSON.parse(JSON.stringify(data)) as any,
      },
    });

    return newOrg;
  });

  // Provisionar DEK no Vault para envelope encryption de PHI (clinical notes, exames)
  try {
    const { ensureOrgDek } = await import("@nutricore/db/phi");
    await ensureOrgDek(org.id);
  } catch (err) {
    // Não bloqueia onboarding — DEK pode ser criada lazily na primeira clinical note
    console.error("[onboarding] DEK provisioning failed", err);
  }

  // CORREÇÃO QA #84: appendAuditLog helper.
  try {
    await appendAuditLog({
      organizationId: org.id,
      actorUserId: user.id,
      actorRole: "org_owner",
      action: "onboarding.completed",
      entityType: "Organization",
      entityId: org.id,
      patientId: null,
      fieldsAccessed: [],
      payload: {},
    });
  } catch (err) {
    // Audit não pode bloquear UX — log e segue
    console.error("[onboarding] audit failed", err);
  }

  revalidatePath("/app");

  // Não dá redirect direto aqui (server action); retorna pro client redirecionar
  return { ok: true, orgSlug: data.orgSlug };
}
