"use server";

// Templates de documentos clínicos (DocumentTemplate). O nutri salva o corpo
// de um documento como modelo reutilizável (por tipo) e aplica em novos
// documentos. Tenant-scoped (withTenantAction). Placeholders ({paciente})
// são resolvidos no cliente ao aplicar.

import { z } from "zod";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DOC_TYPES = [
  "PLANO_ALIMENTAR",
  "ATESTADO",
  "RECEITA_SUPLEMENTO",
  "ENCAMINHAMENTO",
  "RECIBO",
] as const;
type DocType = (typeof DOC_TYPES)[number];

export interface DocTemplateSummary {
  id: string;
  documentType: string;
  name: string;
  bodyMarkdown: string;
}

export interface DocTemplateResult {
  ok: boolean;
  message?: string;
  templateId?: string;
}

export async function listDocTemplatesAction(
  documentType?: string,
): Promise<DocTemplateSummary[]> {
  try {
    return await withTenantAction(async ({ tx }) => {
      const where =
        documentType && (DOC_TYPES as readonly string[]).includes(documentType)
          ? { documentType: documentType as DocType }
          : {};
      const rows = await tx.documentTemplate.findMany({
        where,
        orderBy: [{ usageCount: "desc" }, { name: "asc" }],
        take: 100,
        select: {
          id: true,
          documentType: true,
          name: true,
          bodyMarkdown: true,
        },
      });
      return rows.map(
        (r: {
          id: string;
          documentType: string;
          name: string;
          bodyMarkdown: string;
        }) => ({
          id: r.id,
          documentType: r.documentType,
          name: r.name,
          bodyMarkdown: r.bodyMarkdown,
        }),
      );
    });
  } catch {
    return [];
  }
}

const CreateSchema = z.object({
  documentType: z.enum(DOC_TYPES),
  name: z.string().min(2).max(120).trim(),
  bodyMarkdown: z.string().min(5).max(20000),
});

export async function createDocTemplateAction(input: {
  documentType: string;
  name: string;
  bodyMarkdown: string;
}): Promise<DocTemplateResult> {
  const parsed = CreateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }
  const d = parsed.data;
  try {
    const tpl = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        return tx.documentTemplate.create({
          data: {
            organizationId,
            createdByUserId: userId,
            documentType: d.documentType,
            name: d.name,
            bodyMarkdown: d.bodyMarkdown,
          },
        });
      },
    );
    return { ok: true, templateId: tpl.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

export async function incrementDocTemplateUsageAction(
  templateId: string,
): Promise<{ ok: boolean }> {
  if (!templateId || !UUID_REGEX.test(templateId)) return { ok: false };
  try {
    await withTenantAction(async ({ tx, organizationId }) => {
      await tx.documentTemplate.updateMany({
        where: { id: templateId, organizationId },
        data: { usageCount: { increment: 1 } },
      });
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function deleteDocTemplateAction(
  templateId: string,
): Promise<DocTemplateResult> {
  if (!templateId || !UUID_REGEX.test(templateId)) {
    return { ok: false, message: "Modelo inválido" };
  }
  try {
    await withTenantAction(async ({ tx, organizationId }) => {
      const deleted = await tx.documentTemplate.deleteMany({
        where: { id: templateId, organizationId },
      });
      if (deleted.count === 0)
        throw new Error("Modelo não encontrado nesta organização");
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}
