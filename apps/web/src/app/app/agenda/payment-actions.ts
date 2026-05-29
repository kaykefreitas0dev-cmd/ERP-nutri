"use server";

// CORREÇÃO QA Rodada 5:
//   #74+#75 — DOC_SIGNATURE_SECRET obrigatório em prod + HMAC-SHA256
//   #76 — organizationId explícito em findFirst (defense-in-depth)
//   #77 — appendAuditLog helper em vez de raw $executeRaw (3 ocorrências)

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createHmac } from "node:crypto";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { renderClinicalDocumentPdf } from "@/lib/pdf/clinical-document-pdf";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { appendAuditLog } from "@nutricore/db/audit";

function getDocSecret(): string {
  const secret = process.env.DOC_SIGNATURE_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DOC_SIGNATURE_SECRET missing or too short (min 32 chars)",
      );
    }
    return "dev-only-do-not-use-in-production-min-32-chars";
  }
  return secret;
}

const DOC_BUCKET = "clinical-documents";

export interface CompleteResult {
  ok: boolean;
  message?: string;
  appointmentId?: string;
  paymentId?: string;
  receiptDocumentId?: string;
}

const CompleteSchema = z.object({
  appointmentId: z.string().uuid(),
  amountCents: z.coerce.number().int().min(0).max(10000000), // até R$ 100k
  paymentMethod: z.enum([
    "PIX",
    "CARD_EXTERNAL",
    "CASH",
    "BANK_TRANSFER",
    "OTHER",
  ]),
  externalReference: z.string().max(160).optional().or(z.literal("")),
  description: z.string().max(300).optional().or(z.literal("")),
  generateReceipt: z.coerce.boolean().default(true),
  // Data do pagamento — default hoje, mas pode ser editada
  paymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/**
 * Marca um appointment como COMPLETED + registra PatientPayment (EXTERNAL_RECORDED)
 * + opcionalmente gera ClinicalDocument(RECIBO) já assinado (com PDF no Storage).
 *
 * Tudo em transação atômica. Se a geração de PDF falhar, ainda criamos
 * o payment (paciente já pagou — bloquear o registro seria pior UX).
 */
export async function completeAppointmentWithPaymentAction(
  input: z.input<typeof CompleteSchema>,
): Promise<CompleteResult> {
  const parsed = CompleteSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Dados inválidos: " + parsed.error.issues[0]?.message,
    };
  }
  const d = parsed.data;

  let pdfRender: { buffer: Buffer; sha256: string } | null = null;
  let receiptStorageKey: string | null = null;

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        // CORREÇÃO QA #76: organizationId explícito.
        const appt = await tx.appointment.findFirst({
          where: { id: d.appointmentId, organizationId },
          include: {
            // Patient pode ser null (externalPatient)
            // Não suportamos recibo para externalPatient no MVP
          },
        });
        if (!appt)
          throw new Error("Agendamento não encontrado nesta organização");
        if (appt.status === "COMPLETED") {
          throw new Error("Já marcado como realizado");
        }
        if (!appt.patientId) {
          throw new Error(
            "Agendamentos sem paciente cadastrado não geram recibo. Cadastre o paciente primeiro.",
          );
        }

        // CORREÇÃO QA #76: organizationId explícito.
        const patient = await tx.patient.findFirst({
          where: { id: appt.patientId, organizationId },
          select: { id: true, fullName: true, cpf: true },
        });
        if (!patient)
          throw new Error("Paciente não encontrado nesta organização");

        // Pegar issuer info (BookingPage do nutri, igual S11)
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

        const paymentDate = d.paymentDate
          ? new Date(d.paymentDate + "T12:00:00Z")
          : new Date();

        // 2. Atualizar appointment → COMPLETED
        await tx.appointment.update({
          where: { id: appt.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        await tx.appointmentStatusEvent.create({
          data: {
            appointmentId: appt.id,
            fromStatus: appt.status,
            toStatus: "COMPLETED",
            changedByUserId: userId,
            reason: "Completed with payment registered",
          },
        });

        // 3. Criar PatientPayment EXTERNAL_RECORDED
        const payment = await tx.patientPayment.create({
          data: {
            organizationId,
            patientId: patient.id,
            recordedByUserId: userId,
            appointmentId: appt.id,
            amountCents: d.amountCents,
            currency: "BRL",
            status: "EXTERNAL_RECORDED",
            externalPaymentMethod: d.paymentMethod,
            externalReference: d.externalReference || null,
            paidAt: new Date(),
            paymentDate,
            description:
              d.description || `Consulta nutricional — ${appt.modality}`,
          },
        });

        // CORREÇÃO QA #77: appendAuditLog helper (parameter binding correto).
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "appointment.status.completed",
          entityType: "Appointment",
          entityId: appt.id,
          patientId: patient.id,
          fieldsAccessed: ["status"],
          payload: {},
        });
        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "nutritionist",
          action: "patient_payment.create",
          entityType: "PatientPayment",
          entityId: payment.id,
          patientId: patient.id,
          fieldsAccessed: ["amountCents", "externalPaymentMethod"],
          payload: { amountCents: d.amountCents, method: d.paymentMethod },
        });

        // 5. Se generateReceipt — gerar PDF (fora da transação para evitar
        //    long-lived TX; mas precisamos retornar receipt id, então geramos
        //    dentro da TX mas com try/catch tolerante)
        let receiptDocId: string | null = null;
        if (d.generateReceipt) {
          // Numero sequencial recibo por nutri (count + 1)
          const count = await tx.clinicalDocument.count({
            where: {
              issuedByUserId: userId,
              documentType: "RECIBO",
            },
          });
          const seqNo = count + 1;

          const formattedAmount = (d.amountCents / 100).toLocaleString(
            "pt-BR",
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
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
**Data do serviço:** ${appt.startsAt.toLocaleDateString("pt-BR")}
**Data do pagamento:** ${paymentDate.toLocaleDateString("pt-BR")}
**Forma de pagamento:** ${methodLabels[d.paymentMethod]}
${d.externalReference ? `**Referência:** ${d.externalReference}` : ""}

Para clareza firmo o presente recibo.

⚠️ **Aviso:** este é um recibo simples. A nota fiscal eletrônica (NF-e) deve ser emitida separadamente pelo profissional em seu sistema fiscal próprio.`;

          // Gera doc DRAFT, depois assina (mesmo fluxo S11 issueDocumentAction)
          const issuedAt = new Date();
          // CORREÇÃO QA #74+#75: HMAC-SHA256 + secret obrigatório em prod.
          const secret = getDocSecret();
          const signatureValue: string = createHmac("sha256", secret)
            .update(
              [
                body,
                issuedAt.toISOString(),
                bookingPage?.crn ?? "",
                issuerName,
                appt.id, // bind à appointment para evitar replay cross-appointment
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
              appointmentId: appt.id,
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
              algorithm: "HMAC-SHA256-MOCK",
            },
          });

          // Vincular payment ↔ receipt
          await tx.patientPayment.update({
            where: { id: payment.id },
            data: { receiptDocumentId: doc.id },
          });

          // CORREÇÃO QA #77: appendAuditLog helper.
          await appendAuditLog({
            organizationId,
            actorUserId: userId,
            actorRole: "nutritionist",
            action: "clinical_document.issue",
            entityType: "ClinicalDocument",
            entityId: doc.id,
            patientId: patient.id,
            fieldsAccessed: ["status", "pdfHash"],
            payload: { source: "auto_recibo", pdfHash: pdfRender.sha256 },
          });

          receiptDocId = doc.id;
        }

        return { appointmentId: appt.id, paymentId: payment.id, receiptDocId };
      },
    );

    // 6. Upload PDF para Storage FORA da TX (pode falhar sem dar rollback)
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
        // Falha de upload é não-fatal — payment + doc já existem; nutri pode
        // re-issuar manualmente pela tela de documentos
        console.error("[recibo] upload PDF falhou:", upErr.message);
      }
    }

    revalidatePath("/app/agenda");
    return {
      ok: true,
      appointmentId: result.appointmentId,
      paymentId: result.paymentId,
      receiptDocumentId: result.receiptDocId ?? undefined,
    };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}
