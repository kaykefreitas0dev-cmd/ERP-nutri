"use server";

// Server Actions de Documentos Clínicos (CFN 599/2018 + Lei 13.787/2018)
//
// CORREÇÃO QA Rodada 4:
//   #38 — DOC_SIGNATURE_SECRET obrigatório em prod (não usa fallback inseguro)
//   #39 — appendAuditLog helper em vez de raw $executeRaw (3 ocorrências)
//   #40+#44 — defense-in-depth: where clause inclui organizationId
//   #41+#42 — searchCids rate limit + maxLength input
//   #47 — assinatura usa HMAC-SHA256 (não hash com secret prefix)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { renderClinicalDocumentPdf } from "@/lib/pdf/clinical-document-pdf";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { appendAuditLog } from "@nutricore/db/audit";
import { checkRateLimitById } from "@/lib/rate-limit";

const DOC_BUCKET = "clinical-documents";

export interface DocActionResult {
  ok: boolean;
  message?: string;
  documentId?: string;
}

/** CORREÇÃO QA #38: secret deve ser explicitamente setado em prod.
 * Sem isso, todas as "assinaturas" emitidas seriam forjáveis por qualquer
 * pessoa com acesso ao código-fonte (= público no MVP open-source-friendly). */
function getDocSecret(): string {
  const secret = process.env.DOC_SIGNATURE_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DOC_SIGNATURE_SECRET missing or too short (min 32 chars)",
      );
    }
    // Dev only — warn loud
    console.warn(
      "[clinical-documents] WARNING: DOC_SIGNATURE_SECRET not configured. Using insecure dev placeholder.",
    );
    return "dev-only-do-not-use-in-production-min-32-chars";
  }
  return secret;
}

// -------- CREATE (rascunho) --------
const CreateDocSchema = z.object({
  patientId: z.string().uuid(),
  documentType: z.enum([
    "PLANO_ALIMENTAR",
    "ATESTADO",
    "RECEITA_SUPLEMENTO",
    "ENCAMINHAMENTO",
    "RECIBO",
  ]),
  title: z.string().min(2).max(160).trim(),
  bodyMarkdown: z.string().min(5).max(20000),
  validUntil: z.string().optional().or(z.literal("")),
  mealPlanId: z.string().uuid().optional().or(z.literal("")),
  cidIds: z.array(z.string().uuid()).max(20).optional(),
});

export async function createDocumentAction(
  formData: FormData,
): Promise<DocActionResult> {
  const cidIdsRaw = formData.get("cidIds");
  const cidIds =
    typeof cidIdsRaw === "string" && cidIdsRaw.length > 0
      ? cidIdsRaw.split(",").filter(Boolean)
      : [];

  const raw = {
    patientId: formData.get("patientId"),
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    bodyMarkdown: formData.get("bodyMarkdown"),
    validUntil: formData.get("validUntil") || "",
    mealPlanId: formData.get("mealPlanId") || "",
    cidIds,
  };
  const parsed = CreateDocSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }
  const d = parsed.data;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // CORREÇÃO QA #40: explicit organizationId check (defense-in-depth).
        const patient = await tx.patient.findFirst({
          where: { id: d.patientId, organizationId },
          select: { id: true, fullName: true, cpf: true },
        });
        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");

        // Se mealPlanId fornecido, validar que pertence à mesma org/paciente.
        if (d.mealPlanId) {
          const mp = await tx.mealPlan.findFirst({
            where: {
              id: d.mealPlanId,
              organizationId,
              patientId: d.patientId,
            },
            select: { id: true },
          });
          if (!mp) throw new Error("Plano alimentar inválido");
        }

        const user = await tx.user.findFirst({
          where: { id: userId },
          select: { fullName: true },
        });
        // CRN reside em BookingPage (S6). Buscar página do profissional na org atual.
        const bookingPage = await tx.bookingPage.findFirst({
          where: { professionalUserId: userId, organizationId },
          select: { crn: true, crnUf: true, displayName: true },
        });

        const doc = await tx.clinicalDocument.create({
          data: {
            organizationId,
            patientId: d.patientId,
            issuedByUserId: userId,
            documentType: d.documentType,
            title: d.title,
            bodyMarkdown: d.bodyMarkdown,
            issuerName: user?.fullName ?? bookingPage?.displayName ?? "—",
            issuerCrn: bookingPage?.crn ?? null,
            issuerCrnUf: bookingPage?.crnUf ?? null,
            patientNameSnapshot: patient.fullName,
            patientCpfSnapshot: patient.cpf,
            validUntil: d.validUntil ? new Date(d.validUntil) : null,
            mealPlanId: d.mealPlanId || null,
            status: "DRAFT",
          },
        });

        if (d.cidIds && d.cidIds.length > 0) {
          await tx.clinicalDocumentCid.createMany({
            data: d.cidIds.map((cidId) => ({ documentId: doc.id, cidId })),
            skipDuplicates: true,
          });
        }

        // CORREÇÃO QA #39: appendAuditLog helper (parameter binding correto).
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "clinical_document.create",
          entityType: "ClinicalDocument",
          entityId: doc.id,
          patientId: d.patientId,
          fieldsAccessed: ["documentType", "title"],
          payload: { documentType: d.documentType },
        });

        return doc;
      },
    );

    revalidatePath(`/app/patients/${d.patientId}/documents`);
    return { ok: true, documentId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

// -------- ISSUE (assina + gera PDF + upload Storage + grava hash) --------
export async function issueDocumentAction(
  documentId: string,
): Promise<DocActionResult> {
  // CORREÇÃO QA #39 (UUID validation antes do withTenantAction)
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  ) {
    return { ok: false, message: "documentId inválido" };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // CORREÇÃO QA #44: organizationId explícito no where.
        const doc = await tx.clinicalDocument.findFirst({
          where: { id: documentId, organizationId },
          include: { cidCodes: { include: { cid: true } } },
        });
        if (!doc) throw new Error("Documento não encontrado nesta organização");
        if (doc.status !== "DRAFT") {
          throw new Error(
            `Status atual ${doc.status} — não pode ser emitido novamente`,
          );
        }
        if (doc.issuedByUserId !== userId) {
          throw new Error("Apenas o emissor original pode assinar");
        }

        const issuedAt = new Date();

        const cidsForPdf = doc.cidCodes.map(
          (c: { cid: { code: string; description: string } }) => ({
            code: c.cid.code,
            description: c.cid.description,
          }),
        );

        // CORREÇÃO QA #47: HMAC-SHA256 (não hash com secret prefix).
        // Hash(secret || data) vulnerável a length-extension; HMAC é o
        // construct correto para autenticação de mensagem com chave secreta.
        const secret = getDocSecret();
        const signatureValue = createHmac("sha256", secret)
          .update(
            [
              doc.bodyMarkdown,
              issuedAt.toISOString(),
              doc.issuerCrn ?? "",
              doc.issuerName,
              doc.id,
            ].join("|"),
          )
          .digest("hex");

        const { buffer, sha256 } = await renderClinicalDocumentPdf({
          title: doc.title,
          documentType: doc.documentType,
          issuerName: doc.issuerName,
          issuerCrn: doc.issuerCrn,
          issuerCrnUf: doc.issuerCrnUf,
          patientNameSnapshot: doc.patientNameSnapshot,
          patientCpfSnapshot: doc.patientCpfSnapshot,
          bodyMarkdown: doc.bodyMarkdown,
          cids: cidsForPdf,
          issuedAt,
          validUntil: doc.validUntil,
          signatureValue,
        });

        const supabaseAdmin = createSupabaseServiceClient();
        const storageKey = `${organizationId}/${doc.patientId}/${doc.id}.pdf`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(DOC_BUCKET)
          .upload(storageKey, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (upErr) throw new Error(`Upload PDF falhou: ${upErr.message}`);

        await tx.clinicalDocument.update({
          where: { id: doc.id },
          data: {
            status: "ISSUED",
            issuedAt,
            pdfStorageKey: storageKey,
            pdfHash: sha256,
            pdfGeneratedAt: issuedAt,
          },
        });

        await tx.digitalSignature.create({
          data: {
            documentId: doc.id,
            signatureValue,
            signedAt: issuedAt,
            signerName: doc.issuerName,
            signerCrn: doc.issuerCrn,
            signerCrnUf: doc.issuerCrnUf,
            algorithm: "HMAC-SHA256-MOCK",
          },
        });

        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "clinical_document.issue",
          entityType: "ClinicalDocument",
          entityId: doc.id,
          patientId: doc.patientId,
          fieldsAccessed: ["status", "pdfHash", "signatureValue"],
          payload: { pdfHash: sha256 },
        });

        return doc;
      },
    );

    revalidatePath(`/app/patients/${result.patientId}/documents`);
    revalidatePath(`/app/patients/${result.patientId}/documents/${documentId}`);
    return { ok: true, documentId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

// -------- REVOKE (apenas após ISSUED) --------
export async function revokeDocumentAction(
  documentId: string,
  reason: string,
): Promise<DocActionResult> {
  if (!reason || reason.trim().length < 3 || reason.length > 500) {
    return { ok: false, message: "Motivo obrigatório (3-500 chars)" };
  }
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      documentId,
    )
  ) {
    return { ok: false, message: "documentId inválido" };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // CORREÇÃO QA #44: organizationId explícito.
        const doc = await tx.clinicalDocument.findFirst({
          where: { id: documentId, organizationId },
        });
        if (!doc) throw new Error("Documento não encontrado nesta organização");
        if (doc.status !== "ISSUED") {
          throw new Error("Apenas documentos ISSUED podem ser revogados");
        }

        await tx.clinicalDocument.update({
          where: { id: doc.id },
          data: {
            status: "REVOKED",
            revokedAt: new Date(),
            revokedReason: reason.trim(),
          },
        });

        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "clinical_document.revoke",
          entityType: "ClinicalDocument",
          entityId: doc.id,
          patientId: doc.patientId,
          fieldsAccessed: ["status", "revokedReason"],
          payload: { reason: reason.trim() },
        });

        return doc;
      },
    );

    revalidatePath(`/app/patients/${result.patientId}/documents`);
    revalidatePath(`/app/patients/${result.patientId}/documents/${documentId}`);
    return { ok: true, documentId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return { ok: false, message: err instanceof Error ? err.message : "Erro" };
  }
}

// -------- SEARCH CIDs --------
const SearchCidsSchema = z.object({
  query: z.string().min(1).max(64),
  limit: z.number().int().min(1).max(50).optional(),
});

export async function searchCidsAction(input: {
  query: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  cids?: Array<{ id: string; code: string; description: string }>;
  message?: string;
}> {
  // CORREÇÃO QA #41+#42: validação Zod (maxLen) + rate limit per-IP.
  const parsed = SearchCidsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: "Query inválida" };
  }
  // Rate limit barato: 60 buscas / min / IP (UI faz 1 por keystroke debounced).
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      h.get("x-real-ip") ??
      "unknown";
    const limit = await checkRateLimitById("cid:search:ip", ip, {
      max: 60,
      windowSec: 60,
    });
    if (!limit.ok) {
      return { ok: false, message: "Muitas buscas. Aguarde 1 minuto." };
    }
  } catch {
    // headers() pode falhar em build — ignorar
  }

  try {
    const cids = await withTenantAction(async ({ tx }) => {
      const q = parsed.data.query.toUpperCase();
      return tx.cid10Code.findMany({
        where: {
          OR: [
            { code: { startsWith: q, mode: "insensitive" } },
            {
              description: { contains: parsed.data.query, mode: "insensitive" },
            },
          ],
        },
        orderBy: [{ isCommonInNutrition: "desc" }, { code: "asc" }],
        take: parsed.data.limit ?? 15,
        select: { id: true, code: true, description: true },
      });
    });
    return { ok: true, cids };
  } catch {
    return { ok: false, message: "Erro na busca" };
  }
}
