"use server";

// Exportação org-wide (LGPD Art. 18, II + portabilidade / offboarding do dono).
// Apenas org_owner. Gera um ZIP com todos os dados da organização e disponibiliza
// via signed URL (Supabase Storage, TTL 24h). Modelado em export por paciente.
//
// Escopo bounded para caber em serverless: dados org + equipe + pacientes
// (campos + anamnese + índice de planos/documentos) + agendamentos + pagamentos
// + audit log recente. Exportações detalhadas por paciente (planos completos,
// PDFs) continuam disponíveis individualmente em cada paciente.

import JSZip from "jszip";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { appendAuditLog } from "@nutricore/db/audit";

const EXPORT_BUCKET = "lgpd-exports";
const SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
const ALLOWED_EXPORT_ROLES = new Set(["org_owner"]);

export interface OrgExportResult {
  ok: boolean;
  message?: string;
  signedUrl?: string;
  expiresAt?: string;
  counts?: Record<string, number>;
}

export async function exportOrganizationDataAction(): Promise<OrgExportResult> {
  try {
    const gathered = await withTenantAction(
      async ({ tx, organizationId, userId, role }) => {
        if (!ALLOWED_EXPORT_ROLES.has(role)) {
          throw new ActionTenantError(
            "Apenas o proprietário da organização (org_owner) pode exportar todos os dados.",
            "FORBIDDEN",
          );
        }

        const organization = await tx.organization.findUnique({
          where: { id: organizationId },
          include: { branding: true, subscriptionEvents: true },
        });
        if (!organization) throw new Error("Organização não encontrada");

        const memberships = await tx.membership.findMany({
          where: { organizationId },
          select: {
            id: true,
            userId: true,
            role: true,
            status: true,
            createdAt: true,
            user: { select: { email: true, fullName: true } },
          },
        });

        const patients = await tx.patient.findMany({
          where: { organizationId },
          take: 2000,
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            fullName: true,
            preferredName: true,
            cpf: true,
            email: true,
            phone: true,
            birthDate: true,
            biologicalSex: true,
            status: true,
            city: true,
            state: true,
            createdAt: true,
            anonymizedAt: true,
            allergies: { include: { allergen: true } },
            dietaryRestrictions: true,
            clinicalConditions: true,
            anthropometryRecords: {
              orderBy: { measuredAt: "desc" },
              take: 50,
            },
            mealPlans: {
              select: {
                id: true,
                name: true,
                status: true,
                startDate: true,
                endDate: true,
                targetKcal: true,
              },
            },
            clinicalDocuments: {
              select: {
                id: true,
                title: true,
                documentType: true,
                status: true,
                issuedAt: true,
              },
            },
            payments: true,
          },
        });

        const appointments = await tx.appointment.findMany({
          where: { organizationId },
          orderBy: { startsAt: "desc" },
          take: 2000,
          select: {
            id: true,
            patientId: true,
            externalPatientName: true,
            startsAt: true,
            endsAt: true,
            status: true,
            modality: true,
            timezone: true,
            completedAt: true,
            cancelledAt: true,
          },
        });

        const auditLogs = await tx.$queryRaw<Array<Record<string, unknown>>>`
          SELECT id, action, resource_type, resource_id, actor_user_id,
                 actor_role, occurred_at
          FROM audit.audit_logs
          WHERE organization_id = ${organizationId}::uuid
          ORDER BY occurred_at DESC
          LIMIT 5000
        `;

        await appendAuditLog({
          organizationId,
          actorUserId: userId,
          actorRole: "org_owner",
          action: "organization.data_export",
          entityType: "Organization",
          entityId: organizationId,
          patientId: null,
          fieldsAccessed: ["org_wide_export"],
          payload: {
            patients: patients.length,
            memberships: memberships.length,
            appointments: appointments.length,
            auditEntries: auditLogs.length,
          },
        });

        return {
          organization,
          memberships,
          patients,
          appointments,
          auditLogs,
          organizationId,
        };
      },
    );

    const {
      organization,
      memberships,
      patients,
      appointments,
      auditLogs,
      organizationId,
    } = gathered;

    const generatedAt = new Date();
    const counts: Record<string, number> = {
      memberships: memberships.length,
      patients: patients.length,
      appointments: appointments.length,
      auditEntries: auditLogs.length,
    };

    const zip = new JSZip();

    zip.file(
      "manifest.json",
      JSON.stringify(
        {
          schemaVersion: 1,
          kind: "organization-export",
          generatedAt: generatedAt.toISOString(),
          organizationId,
          organizationName: organization.name,
          counts,
          notes: [
            "Exportação completa da organização na plataforma NutriCore (LGPD — portabilidade).",
            "Cada paciente está em patients/<id>.json com dados pessoais, anamnese, índice de planos e documentos, antropometria, pagamentos.",
            "Planos alimentares completos (refeições/itens) e PDFs de documentos podem ser exportados individualmente em cada paciente (botão 'Exportar dados').",
            "Anotações clínicas criptografadas não estão incluídas (envelope encryption).",
            "Audit log limitado aos 5.000 eventos mais recentes da organização.",
          ],
        },
        null,
        2,
      ),
    );

    zip.file(
      "organization.json",
      JSON.stringify(
        {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          plan: organization.plan,
          subscriptionStatus: organization.subscriptionStatus,
          trialEndsAt: organization.trialEndsAt,
          createdAt: organization.createdAt,
          branding: organization.branding,
          subscriptionEvents: organization.subscriptionEvents,
        },
        null,
        2,
      ),
    );

    zip.file(
      "team.json",
      JSON.stringify(
        memberships.map(
          (m: {
            id: string;
            userId: string;
            role: string;
            status: string;
            createdAt: Date;
            user: { email: string; fullName: string } | null;
          }) => ({
            id: m.id,
            userId: m.userId,
            role: m.role,
            status: m.status,
            createdAt: m.createdAt,
            email: m.user?.email ?? null,
            fullName: m.user?.fullName ?? null,
          }),
        ),
        null,
        2,
      ),
    );

    const patientsFolder = zip.folder("patients");
    patientsFolder?.file(
      "_index.json",
      JSON.stringify(
        patients.map(
          (p: {
            id: string;
            fullName: string;
            email: string | null;
            status: string;
            createdAt: Date;
          }) => ({
            id: p.id,
            fullName: p.fullName,
            email: p.email,
            status: p.status,
            createdAt: p.createdAt,
          }),
        ),
        null,
        2,
      ),
    );
    for (const p of patients) {
      patientsFolder?.file(`${p.id}.json`, JSON.stringify(p, null, 2));
    }

    zip.file("appointments.json", JSON.stringify(appointments, null, 2));
    zip.file(
      "audit-log.json",
      JSON.stringify(
        {
          entries: auditLogs,
          disclaimer:
            "Audit log da organização (5.000 eventos mais recentes), ordenado do mais novo ao mais antigo.",
        },
        null,
        2,
      ),
    );

    const zipBuffer = await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const exportKey = `${organizationId}/_org/${generatedAt
      .toISOString()
      .replace(/[:.]/g, "-")}.zip`;

    await ensureExportBucketExists();

    const supabaseAdmin = createSupabaseServiceClient();
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

    return {
      ok: true,
      signedUrl: signed.signedUrl,
      expiresAt: new Date(
        Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      ).toISOString(),
      counts,
    };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao exportar",
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
      fileSizeLimit: 100 * 1024 * 1024,
      allowedMimeTypes: ["application/zip"],
    });
  } catch {
    // best-effort
  }
}
