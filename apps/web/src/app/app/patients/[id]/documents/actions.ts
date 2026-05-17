"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { renderClinicalDocumentPdf } from "@/lib/pdf/clinical-document-pdf";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const DOC_BUCKET = "clinical-documents";

export interface DocActionResult {
  ok: boolean;
  message?: string;
  documentId?: string;
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
        const patient = await tx.patient.findFirst({
          where: { id: d.patientId },
          select: { id: true, fullName: true, cpf: true },
        });
        if (!patient) throw new Error("Paciente não encontrado");

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

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'clinical_document.create'::text, 'ClinicalDocument'::text,
            ${doc.id}::text, ${d.patientId}::uuid,
            ARRAY['documentType','title']::text[],
            '{}'::jsonb
          )
        `;

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
  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const doc = await tx.clinicalDocument.findFirst({
          where: { id: documentId },
          include: { cidCodes: { include: { cid: true } } },
        });
        if (!doc) throw new Error("Documento não encontrado");
        if (doc.status !== "DRAFT") {
          throw new Error(
            `Status atual ${doc.status} — não pode ser emitido novamente`,
          );
        }
        if (doc.issuedByUserId !== userId) {
          throw new Error("Apenas o emissor original pode assinar");
        }

        const issuedAt = new Date();

        // 1. Render PDF (sem assinatura ainda) — só para obter hash do conteúdo
        const cidsForPdf = doc.cidCodes.map(
          (c: { cid: { code: string; description: string } }) => ({
            code: c.cid.code,
            description: c.cid.description,
          }),
        );

        // 2. Gerar signature mock (SHA-256(bodyMarkdown + issuedAt + crn + secret))
        const secret = process.env.DOC_SIGNATURE_SECRET ?? "dev-mock-secret";
        const signatureValue = createHash("sha256")
          .update(
            [
              doc.bodyMarkdown,
              issuedAt.toISOString(),
              doc.issuerCrn ?? "",
              doc.issuerName,
              secret,
            ].join("|"),
          )
          .digest("hex");

        // 3. Render PDF final com assinatura
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

        // 4. Upload Supabase Storage (bucket privado)
        const supabaseAdmin = createSupabaseServiceClient();
        const storageKey = `${organizationId}/${doc.patientId}/${doc.id}.pdf`;
        const { error: upErr } = await supabaseAdmin.storage
          .from(DOC_BUCKET)
          .upload(storageKey, buffer, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (upErr) throw new Error(`Upload PDF falhou: ${upErr.message}`);

        // 5. Atualizar documento → ISSUED + hash + storage key
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

        // 6. Persistir signature
        await tx.digitalSignature.create({
          data: {
            documentId: doc.id,
            signatureValue,
            signedAt: issuedAt,
            signerName: doc.issuerName,
            signerCrn: doc.issuerCrn,
            signerCrnUf: doc.issuerCrnUf,
            algorithm: "SHA256-MOCK",
          },
        });

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'clinical_document.issue'::text, 'ClinicalDocument'::text,
            ${doc.id}::text, ${doc.patientId}::uuid,
            ARRAY['status','pdfHash','signatureValue']::text[],
            ${JSON.stringify({ pdfHash: sha256 })}::jsonb
          )
        `;

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
  if (!reason || reason.trim().length < 3) {
    return { ok: false, message: "Motivo obrigatório (mínimo 3 chars)" };
  }

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const doc = await tx.clinicalDocument.findFirst({
          where: { id: documentId },
        });
        if (!doc) throw new Error("Documento não encontrado");
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

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'clinical_document.revoke'::text, 'ClinicalDocument'::text,
            ${doc.id}::text, ${doc.patientId}::uuid,
            ARRAY['status','revokedReason']::text[],
            ${JSON.stringify({ reason })}::jsonb
          )
        `;

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
export async function searchCidsAction(input: {
  query: string;
  limit?: number;
}): Promise<{
  ok: boolean;
  cids?: Array<{ id: string; code: string; description: string }>;
  message?: string;
}> {
  if (input.query.length < 1) return { ok: true, cids: [] };

  try {
    const cids = await withTenantAction(async ({ tx }) => {
      const q = input.query.toUpperCase();
      return tx.cid10Code.findMany({
        where: {
          OR: [
            { code: { startsWith: q, mode: "insensitive" } },
            { description: { contains: input.query, mode: "insensitive" } },
          ],
        },
        orderBy: [{ isCommonInNutrition: "desc" }, { code: "asc" }],
        take: input.limit ?? 15,
        select: { id: true, code: true, description: true },
      });
    });
    return { ok: true, cids };
  } catch {
    return { ok: false, message: "Erro na busca" };
  }
}
