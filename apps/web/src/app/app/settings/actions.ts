"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

// ─── helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string, suffix: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 30) +
    "-" +
    suffix
  );
}

export interface SettingsResult {
  ok: boolean;
  message?: string;
}

const BrandingSchema = z.object({
  logoUrl: z.string().url().or(z.literal("")).optional(),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Cor deve ser hex válido (ex: #0F766E)"),
  emailFromName: z.string().min(2).max(80).trim(),
});

export async function updateBrandingAction(input: {
  logoUrl: string;
  primaryColor: string;
  emailFromName: string;
}): Promise<SettingsResult> {
  const parsed = BrandingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }

  try {
    await withTenantAction(async ({ tx, organizationId, userId, role }) => {
      // Apenas org_owner / clinic_admin podem editar branding
      if (role !== "org_owner" && role !== "clinic_admin") {
        throw new ActionTenantError(
          "Sem permissão pra editar branding",
          "FORBIDDEN",
        );
      }

      await tx.organizationBranding.upsert({
        where: { organizationId },
        update: {
          logoUrl: parsed.data.logoUrl || null,
          primaryColor: parsed.data.primaryColor,
          emailFromName: parsed.data.emailFromName,
        },
        create: {
          organizationId,
          logoUrl: parsed.data.logoUrl || null,
          primaryColor: parsed.data.primaryColor,
          emailFromName: parsed.data.emailFromName,
        },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          'organization.update_branding'::text, 'OrganizationBranding'::text,
          ${organizationId}::text, NULL::uuid,
          ARRAY['logoUrl','primaryColor','emailFromName']::text[],
          '{}'::jsonb
        )
      `;
    });

    revalidatePath("/app/settings");
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}

// ─── Professional profile (BookingPage) ──────────────────────────────────────

const UF_VALUES = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

const ProfessionalProfileSchema = z.object({
  displayName: z.string().min(2, "Nome muito curto").max(120).trim(),
  crn: z
    .string()
    .max(20)
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  crnUf: z
    .enum(UF_VALUES)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  bio: z
    .string()
    .max(800)
    .trim()
    .optional()
    .transform((v) => (v === "" ? undefined : v)),
  /** Comma-separated list of specialty tags */
  specialtiesRaw: z
    .string()
    .max(500)
    .optional()
    .transform((v) =>
      v
        ? v
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    ),
});

export async function upsertProfessionalProfileAction(input: {
  displayName: string;
  crn: string;
  crnUf: string;
  bio: string;
  specialtiesRaw: string;
}): Promise<SettingsResult & { slug?: string }> {
  const parsed = ProfessionalProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }
  const d = parsed.data;

  try {
    const slug = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const existing = await tx.bookingPage.findFirst({
          where: { professionalUserId: userId, organizationId },
          select: { id: true, slug: true },
        });

        if (existing) {
          await tx.bookingPage.update({
            where: { id: existing.id },
            data: {
              displayName: d.displayName,
              crn: d.crn ?? null,
              crnUf: d.crnUf ?? null,
              bio: d.bio ?? null,
              specialties: d.specialtiesRaw,
            },
          });
          await tx.$executeRaw`
            SELECT audit.append_log(
              ${organizationId}::uuid, ${userId}::uuid,
              'nutritionist'::text, NULL::inet, NULL::text,
              'booking_page.update_profile'::text, 'BookingPage'::text,
              ${existing.id}::text, NULL::uuid,
              ARRAY['displayName','crn','crnUf','bio','specialties']::text[],
              '{}'::jsonb
            )
          `;
          return existing.slug;
        } else {
          // Auto-generate a unique slug from displayName + short userId
          const suffix = userId.slice(0, 6);
          const generatedSlug = slugify(d.displayName, suffix);

          // Safety: check uniqueness and append extra chars if taken
          const taken = await tx.bookingPage.findUnique({
            where: { slug: generatedSlug },
          });
          const finalSlug = taken
            ? `${generatedSlug}-${userId.slice(6, 10)}`
            : generatedSlug;

          const bp = await tx.bookingPage.create({
            data: {
              organizationId,
              professionalUserId: userId,
              slug: finalSlug,
              displayName: d.displayName,
              crn: d.crn ?? null,
              crnUf: d.crnUf ?? null,
              bio: d.bio ?? null,
              specialties: d.specialtiesRaw,
              timezone: "America/Sao_Paulo",
              isPublished: false,
            },
          });
          await tx.$executeRaw`
            SELECT audit.append_log(
              ${organizationId}::uuid, ${userId}::uuid,
              'nutritionist'::text, NULL::inet, NULL::text,
              'booking_page.create'::text, 'BookingPage'::text,
              ${bp.id}::text, NULL::uuid,
              ARRAY['displayName','crn','crnUf','slug']::text[],
              '{}'::jsonb
            )
          `;
          return bp.slug;
        }
      },
    );

    revalidatePath("/app/settings");
    return { ok: true, slug };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao salvar perfil",
    };
  }
}

export { UF_VALUES };
