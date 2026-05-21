"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHash } from "node:crypto";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { renderClinicalDocumentPdf } from "@/lib/pdf/clinical-document-pdf";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const DOC_BUCKET = "clinical-documents";

// ─── Patient search ───────────────────────────────────────────────────────────

export async function searchPatientsForPaymentAction(query: string): Promise<{
  ok: boolean;
  patients?: Array<{ id: string; fullName: string; email: string | null }>;
  message?: string;
}> {
  if (!query || query.trim().length < 2) {
    return { ok: true, patients: [] };
  }

  try {
    const patients = await withTenantAction(async ({ tx }) => {
      return tx.patient.findMany({
        where: {
          status: "ACTIVE",
          fullName: { contains: query.trim(), mode: "insensitive" },
        },
        orderBy: { fullName: "asc" },
        take: 8,
        select: { id: true, fullName: true, email: true },
      });
    });
    return { ok: true, patients };
  } catch {
    return { ok: false, message: "Erro ao buscar pacientes" };
  }
}

// ─── Standalone payment creation ──────────────────────────────────────────────

const StandalonePaymentSchema = z.object({
  patientId: z.string().uuid("ID do paciente inválido"),
  amountCents: z.coerce.number().int().min(1).max(10_000_000),
  paymentMethod: z.enum([
    "PIX",
    "CARD_EXTERNAL",
    "CASH",
    "BANK_TRANSFER",
    "OTHER",
  ]),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
  description: z.string().max(300).default("Consulta nutricional"),
  externalReference: z.string().max(160).optional(),
  generateReceipt: z.coerce.boolean().default(true),
});

export interface StandalonePaymentResult {
  ok: boolean;
  message?: string;
  paymentId?: string;
  receiptDocumentId?: string;
}

/**
 * Registra um pagamento avulso (sem appointment) com status EXTERNAL_RECORDED.
 * Opcionalmente gera recibo simples PDF (S15a pattern).
 */
export async function createStandalonePaymentAction(
  input: z.input<typeof StandalonePaymentSchema>,
): Promise<StandalonePaymentResult> {
  const parsed = StandalonePaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Dados inválidos",
    };
  }
  const d = parsed.data;

  let pdfRender: { buffer: Buffer; sha256: string } | null = null;
  let receiptStorageKey: string | null = null;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // 1. Verificar paciente (RLS garante tenant isolation)
        const patient = await tx.patient.findFirst({
          where: { id: d.patientId },
          select: { id: true, fullName: true, cpf: true },
        });
        if (!patient) throw new Error("Paciente não encontrado");

        const paymentDate = new Date(d.paymentDate + "T12:00:00Z");

        // 2. Criar PatientPayment sem appointmentId
        const payment = await tx.patientPayment.create({
          data: {
            organizationId,
            patientId: patient.id,
            recordedByUserId: userId,
            appointmentId: null,
            amountCents: d.amountCents,
            currency: "BRL",
            status: "EXTERNAL_RECORDED",
            externalPaymentMethod: d.paymentMethod,
            externalReference: d.externalReference || null,
            paidAt: new Date(),
            paymentDate,
            description: d.description || "Consulta nutricional",
          },
        });

        // 3. Audit log
        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'patient_payment.create'::text, 'PatientPayment'::text,
            ${payment.id}::text, ${patient.id}::uuid,
            ARRAY['amountCents','externalPaymentMethod']::text[],
            ${JSON.stringify({ amountCents: d.amountCents, method: d.paymentMethod, standalone: true })}::jsonb
          )
        `;

        // 4. Gerar recibo (opcional)
        let receiptDocId: string | null = null;
        if (d.generateReceipt) {
          const bookingPage = await tx.bookingPage.findFirst({
            where: { professionalUserId: userId, organizationId },
            select: { crn: true, crnUf: true, displayName: true },
          });
          const user = await tx.user.findFirst({
            where: { id: userId },
            select: { fullName: true },
          });
          const issuerName =
            user?.fullName ?? bookingPage?.displayName ?? "Nutricionista";

          // Numeração sequencial por nutri
          const count = await tx.clinicalDocument.count({
            where: { issuedByUserId: userId, documentType: "RECIBO" },
          });
          const seqNo = count + 1;

          const formattedAmount = (d.amountCents / 100).toLocaleString(
            "pt-BR",
            { minimumFractionDigits: 2, maximumFractionDigits: 2 },
          );

          const methodLabels: Record<string, string> = {
            PIX: "PIX",
            CARD_EXTERNAL: "Cartão (externo)",
            CASH: "Dinheiro",
            BANK_TRANSFER: "Transferência bancária",
            OTHER: "Outro",
          };

          const body = `Recibo Nº **${String(seqNo).padStart(4, "0")}**

Recebi de **${patient.fullName}** a importância de **R$ ${formattedAmount}**, referente a:

**Serviço:** ${d.description || "Consulta nutricional"}
**Data do pagamento:** ${paymentDate.toLocaleDateString("pt-BR")}
**Forma de pagamento:** ${methodLabels[d.paymentMethod]}
${d.externalReference ? `**Referência:** ${d.externalReference}` : ""}

Para clareza firmo o presente recibo.

⚠️ **Aviso:** este é um recibo simples. A nota fiscal eletrônica (NF-e) deve ser emitida separadamente pelo profissional em seu sistema fiscal próprio.`;

          const issuedAt = new Date();
          const secret = process.env.DOC_SIGNATURE_SECRET ?? "dev-mock-secret";
          const signatureValue = createHash("sha256")
            .update(
              [
                body,
                issuedAt.toISOString(),
                bookingPage?.crn ?? "",
                issuerName,
                secret,
              ].join("|"),
            )
            .digest("hex");

          pdfRender = await renderClinicalDocumentPdf({
            title: `Recibo Nº ${String(seqNo).padStart(4, "0")}`,
            documentType: "RECIBO",
            issuerName,
            issuerCrn: bookingPage?.crn ?? null,
            issuerCrnUf: bookingPage?.crnUf ?? null,
            patientNameSnapshot: patient.fullName,
            patientCpfSnapshot: patient.cpf,
            bodyMarkdown: body,
            cids: [],
            issuedAt,
            validUntil: null,
            signatureValue,
          });

          const doc = await tx.clinicalDocument.create({
            data: {
              organizationId,
              patientId: patient.id,
              issuedByUserId: userId,
              documentType: "RECIBO",
              title: `Recibo Nº ${String(seqNo).padStart(4, "0")}`,
              bodyMarkdown: body,
              issuerName,
              issuerCrn: bookingPage?.crn ?? null,
              issuerCrnUf: bookingPage?.crnUf ?? null,
              patientNameSnapshot: patient.fullName,
              patientCpfSnapshot: patient.cpf,
              appointmentId: null,
              status: "ISSUED",
              issuedAt,
              pdfHash: pdfRender.sha256,
              pdfGeneratedAt: issuedAt,
            },
          });

          receiptStorageKey = `${organizationId}/${patient.id}/${doc.id}.pdf`;
          await tx.clinicalDocument.update({
            where: { id: doc.id },
            data: { pdfStorageKey: receiptStorageKey },
          });
          await tx.digitalSignature.create({
            data: {
              documentId: doc.id,
              signatureValue,
              signedAt: issuedAt,
              signerName: issuerName,
              signerCrn: bookingPage?.crn ?? null,
              signerCrnUf: bookingPage?.crnUf ?? null,
              algorithm: "SHA256-MOCK",
            },
          });

          await tx.patientPayment.update({
            where: { id: payment.id },
            data: { receiptDocumentId: doc.id },
          });

          await tx.$executeRaw`
            SELECT audit.append_log(
              ${organizationId}::uuid, ${userId}::uuid,
              'nutritionist'::text, NULL::inet, NULL::text,
              'clinical_document.issue'::text, 'ClinicalDocument'::text,
              ${doc.id}::text, ${patient.id}::uuid,
              ARRAY['status','pdfHash']::text[],
              ${JSON.stringify({ source: "standalone_recibo", pdfHash: pdfRender.sha256 })}::jsonb
            )
          `;

          receiptDocId = doc.id;
        }

        return { paymentId: payment.id, receiptDocId };
      },
    );

    // Upload PDF fora da TX (falha não-fatal)
    const renderedPdf = pdfRender as { buffer: Buffer; sha256: string } | null;
    if (renderedPdf && receiptStorageKey && result.receiptDocId) {
      const supabaseAdmin = createSupabaseServiceClient();
      const { error: upErr } = await supabaseAdmin.storage
        .from(DOC_BUCKET)
        .upload(receiptStorageKey, renderedPdf.buffer, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) {
        console.error("[recibo standalone] upload PDF falhou:", upErr.message);
      }
    }

    revalidatePath("/app/financeiro");
    revalidatePath("/app");
    return {
      ok: true,
      paymentId: result.paymentId,
      receiptDocumentId: result.receiptDocId ?? undefined,
    };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : "Erro ao registrar pagamento",
    };
  }
}
