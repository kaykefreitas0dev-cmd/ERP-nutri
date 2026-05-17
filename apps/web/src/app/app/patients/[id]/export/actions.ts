"use server";

import JSZip from "jszip";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const EXPORT_BUCKET = "lgpd-exports";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60; // 24h

export interface ExportResult {
  ok: boolean;
  message?: string;
  signedUrl?: string;
  expiresAt?: string;
  manifest?: {
    patientId: string;
    counts: Record<string, number>;
    generatedAt: string;
  };
}

/**
 * Exporta todos os dados de um paciente em formato ZIP (LGPD Art. 18, II —
 * direito à portabilidade dos dados).
 *
 * Estrutura do ZIP:
 *   /manifest.json             — contagens + metadata
 *   /patient.json              — dados pessoais
 *   /anamnese/                 — allergies, restrictions, conditions
 *   /clinical-notes/           — anotações clínicas (encrypted ainda;
 *                                paciente precisa solicitar decrypt separado)
 *   /meal-plans/               — planos (1 JSON por plano + estrutura completa)
 *   /documents/                — recibos, atestados (JSON + PDFs anexos)
 *   /checkins.json             — todos check-ins User-scoped
 *   /anthropometry.json        — medidas antropométricas
 *   /payments.json             — pagamentos
 *   /appointments.json         — agendamentos
 *   /audit-log.json            — eventos de audit deste paciente
 *
 * Tudo dentro de transação tenant-aware. ZIP é uploaded ao Supabase Storage
 * com signed URL TTL 24h.
 */
export async function exportPatientDataAction(input: {
  patientId: string;
}): Promise<ExportResult> {
  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const patient = await tx.patient.findFirst({
          where: { id: input.patientId },
          include: {
            allergies: { include: { allergen: true } },
            dietaryRestrictions: true,
            clinicalConditions: true,
            anthropometryRecords: { orderBy: { measuredAt: "desc" } },
            mealPlans: {
              include: {
                days: {
                  include: {
                    meals: {
                      include: { items: true },
                    },
                  },
                },
              },
            },
            clinicalDocuments: {
              include: {
                cidCodes: { include: { cid: true } },
                signature: true,
              },
            },
            payments: true,
            invites: {
              select: {
                id: true,
                email: true,
                expiresAt: true,
                acceptedAt: true,
                revokedAt: true,
                createdAt: true,
              },
            },
            clinicalNotes: {
              select: {
                id: true,
                title: true,
                noteType: true,
                createdAt: true,
                updatedAt: true,
                // encryptedBody intencionalmente omitido — paciente
                // recebe placeholder explicando como decryptar
              },
            },
            examAttachments: {
              select: {
                id: true,
                fileName: true,
                fileType: true,
                fileSizeBytes: true,
                uploadedAt: true,
              },
            },
          },
        });
        if (!patient) throw new Error("Paciente não encontrado");

        // Appointments (não tem FK direto a Patient com cascade — busca à parte)
        const appointments = await tx.appointment.findMany({
          where: { patientId: patient.id },
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            status: true,
            modality: true,
            timezone: true,
            notes: true,
            completedAt: true,
            cancelledAt: true,
            cancellationReason: true,
          },
          orderBy: { startsAt: "desc" },
          take: 500,
        });

        // Check-ins (User-scoped, Lock 6)
        const checkins = patient.userId
          ? await tx.userHealthCheckin.findMany({
              where: { userId: patient.userId },
              orderBy: { checkinDate: "desc" },
              take: 1000,
            })
          : [];

        // Audit log relativo a este paciente
        const auditLogs = await tx.$queryRaw<
          Array<{
            id: string;
            action: string;
            resource_type: string;
            resource_id: string;
            actor_user_id: string;
            occurred_at: Date;
            metadata: unknown;
          }>
        >`
          SELECT id, action, resource_type, resource_id, actor_user_id,
                 occurred_at, metadata
          FROM audit.audit_logs
          WHERE patient_subject_id = ${patient.id}::uuid
             OR resource_id = ${patient.id}::text
          ORDER BY occurred_at DESC
          LIMIT 1000
        `;

        // Audit log do export em si (Art. 41 — DPO precisa rastrear)
        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'patient.data_export'::text, 'Patient'::text,
            ${patient.id}::text, ${patient.id}::uuid,
            ARRAY['lgpd_export']::text[],
            ${JSON.stringify({
              format: "zip",
              entityCounts: {
                allergies: patient.allergies.length,
                dietary: patient.dietaryRestrictions.length,
                conditions: patient.clinicalConditions.length,
                anthropometry: patient.anthropometryRecords.length,
                mealPlans: patient.mealPlans.length,
                documents: patient.clinicalDocuments.length,
                payments: patient.payments.length,
                checkins: checkins.length,
                appointments: appointments.length,
                auditEntries: auditLogs.length,
              },
            })}::jsonb
          )
        `;

        return {
          patient,
          appointments,
          checkins,
          auditLogs,
          organizationId,
        };
      },
    );

    const { patient, appointments, checkins, auditLogs, organizationId } =
      result;
    const generatedAt = new Date();
    const counts: Record<string, number> = {
      allergies: patient.allergies.length,
      dietaryRestrictions: patient.dietaryRestrictions.length,
      clinicalConditions: patient.clinicalConditions.length,
      anthropometryRecords: patient.anthropometryRecords.length,
      mealPlans: patient.mealPlans.length,
      clinicalDocuments: patient.clinicalDocuments.length,
      payments: patient.payments.length,
      invites: patient.invites.length,
      clinicalNotes: patient.clinicalNotes.length,
      examAttachments: patient.examAttachments.length,
      appointments: appointments.length,
      checkins: checkins.length,
      auditEntries: auditLogs.length,
    };

    // ---- Montar ZIP ----
    const zip = new JSZip();

    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          generatedAt: generatedAt.toISOString(),
          patientId: patient.id,
          patientName: patient.fullName,
          organizationId,
          counts,
          notes: [
            "Este ZIP contém todos os dados pessoais e clínicos registrados na plataforma NutriCore para este paciente.",
            "Anotações clínicas (clinical-notes) estão criptografadas e os corpos não estão incluídos. Para decryptá-las, abra um chamado com o controlador (sua nutricionista).",
            "Documentos ISSUED (atestados, recibos) têm versão JSON + PDF (quando disponíveis no Storage).",
            "Audit log inclui apenas eventos relativos a este paciente (criação, atualização, leitura, anonimização).",
          ],
        },
        null,
        2,
      ),
    );

    zip.file(
      "patient.json",
      JSON.stringify(
        {
          id: patient.id,
          fullName: patient.fullName,
          preferredName: patient.preferredName,
          cpf: patient.cpf,
          email: patient.email,
          phone: patient.phone,
          birthDate: patient.birthDate,
          biologicalSex: patient.biologicalSex,
          genderIdentity: patient.genderIdentity,
          address: {
            city: patient.city,
            state: patient.state,
            postalCode: patient.postalCode,
            street: patient.street,
            number: patient.number,
            complement: patient.complement,
            neighborhood: patient.neighborhood,
          },
          occupation: patient.occupation,
          notes: patient.notes,
          status: patient.status,
          archivedAt: patient.archivedAt,
          anonymizedAt: patient.anonymizedAt,
          createdAt: patient.createdAt,
          updatedAt: patient.updatedAt,
        },
        null,
        2,
      ),
    );

    // Anamnese
    const anamnese = zip.folder("anamnese");
    anamnese?.file(
      "allergies.json",
      JSON.stringify(patient.allergies, null, 2),
    );
    anamnese?.file(
      "dietary-restrictions.json",
      JSON.stringify(patient.dietaryRestrictions, null, 2),
    );
    anamnese?.file(
      "clinical-conditions.json",
      JSON.stringify(patient.clinicalConditions, null, 2),
    );

    // Antropometria
    zip.file(
      "anthropometry.json",
      JSON.stringify(patient.anthropometryRecords, null, 2),
    );

    // Meal plans (1 file per plan)
    const plansFolder = zip.folder("meal-plans");
    plansFolder?.file(
      "_index.json",
      JSON.stringify(
        patient.mealPlans.map((p: (typeof patient.mealPlans)[number]) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          startDate: p.startDate,
          endDate: p.endDate,
          targetKcal: p.targetKcal,
        })),
        null,
        2,
      ),
    );
    for (const plan of patient.mealPlans) {
      plansFolder?.file(`${plan.id}.json`, JSON.stringify(plan, null, 2));
    }

    // Clinical documents (JSON + PDF se disponível)
    const docsFolder = zip.folder("documents");
    docsFolder?.file(
      "_index.json",
      JSON.stringify(
        patient.clinicalDocuments.map(
          (d: (typeof patient.clinicalDocuments)[number]) => ({
            id: d.id,
            title: d.title,
            documentType: d.documentType,
            status: d.status,
            issuedAt: d.issuedAt,
            pdfHash: d.pdfHash,
            pdfStorageKey: d.pdfStorageKey,
          }),
        ),
        null,
        2,
      ),
    );
    const supabaseAdmin = createSupabaseServiceClient();
    for (const doc of patient.clinicalDocuments) {
      docsFolder?.file(`${doc.id}.json`, JSON.stringify(doc, null, 2));
      // PDF se ISSUED
      if (doc.status === "ISSUED" && doc.pdfStorageKey) {
        try {
          const { data: pdfBlob } = await supabaseAdmin.storage
            .from("clinical-documents")
            .download(doc.pdfStorageKey);
          if (pdfBlob) {
            const buf = Buffer.from(await pdfBlob.arrayBuffer());
            docsFolder?.file(`${doc.id}.pdf`, buf);
          }
        } catch {
          // PDF indisponível — segue (já temos JSON)
        }
      }
    }

    // Clinical notes (metadata only)
    zip.file(
      "clinical-notes-metadata.json",
      JSON.stringify(
        {
          notes: patient.clinicalNotes,
          disclaimer:
            "Corpo das anotações clínicas está criptografado (envelope encryption via pgcrypto + Supabase Vault). Para receber o conteúdo decryptado, solicite à sua nutricionista por outro canal.",
        },
        null,
        2,
      ),
    );

    // Exam attachments (metadata only — arquivos brutos requerem signed URL e
    // potencialmente são grandes; emitir lista para que o paciente saiba
    // o que pode pedir separadamente)
    zip.file(
      "exam-attachments.json",
      JSON.stringify(
        {
          attachments: patient.examAttachments,
          disclaimer:
            "Arquivos de exames não estão incluídos neste ZIP. Solicite signed URLs individuais via sua nutricionista.",
        },
        null,
        2,
      ),
    );

    // Payments
    zip.file("payments.json", JSON.stringify(patient.payments, null, 2));

    // Appointments
    zip.file("appointments.json", JSON.stringify(appointments, null, 2));

    // Check-ins
    zip.file(
      "checkins.json",
      JSON.stringify(
        {
          checkins,
          disclaimer: patient.userId
            ? null
            : "Paciente sem conta vinculada — sem check-ins.",
        },
        null,
        2,
      ),
    );

    // Invites
    zip.file("invites.json", JSON.stringify(patient.invites, null, 2));

    // Audit log
    zip.file(
      "audit-log.json",
      JSON.stringify(
        {
          entries: auditLogs,
          disclaimer:
            "Audit log filtrado por patient_subject_id ou resource_id = patient.id. Cobre todas as operações conhecidas neste paciente.",
        },
        null,
        2,
      ),
    );

    // ---- Compilar + Upload ----
    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const exportKey = `${organizationId}/${patient.id}/${generatedAt.toISOString().replace(/[:.]/g, "-")}.zip`;

    // Cria bucket se não existir (best-effort)
    await ensureExportBucketExists();

    const { error: upErr } = await supabaseAdmin.storage
      .from(EXPORT_BUCKET)
      .upload(exportKey, zipBuffer, {
        contentType: "application/zip",
        upsert: true,
      });
    if (upErr) {
      return { ok: false, message: `Upload falhou: ${upErr.message}` };
    }

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from(EXPORT_BUCKET)
      .createSignedUrl(exportKey, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      return { ok: false, message: signErr?.message ?? "Sem signed URL" };
    }

    const expiresAt = new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString();

    return {
      ok: true,
      signedUrl: signed.signedUrl,
      expiresAt,
      manifest: {
        patientId: patient.id,
        counts,
        generatedAt: generatedAt.toISOString(),
      },
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

async function ensureExportBucketExists(): Promise<void> {
  try {
    const admin = createSupabaseServiceClient();
    const { data: buckets } = await admin.storage.listBuckets();
    if (buckets?.find((b) => b.id === EXPORT_BUCKET)) return;
    await admin.storage.createBucket(EXPORT_BUCKET, {
      public: false,
      fileSizeLimit: 100 * 1024 * 1024, // 100 MB
      allowedMimeTypes: ["application/zip"],
    });
  } catch {
    // best-effort — upload subsequente falha com erro claro se bucket faltar
  }
}
