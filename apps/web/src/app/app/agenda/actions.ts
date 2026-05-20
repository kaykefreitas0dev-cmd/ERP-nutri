"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { prisma } from "@nutricore/db";
import {
  sendAppointmentScheduledEmail,
  sendAppointmentConfirmedEmail,
  sendAppointmentCancelledEmail,
} from "@/lib/email/send-appointment-notification";

const ScheduleSchema = z.object({
  startsAt: z.string(), // ISO
  durationMinutes: z.coerce.number().int().min(15).max(480),
  patientId: z.string().uuid().optional(),
  externalPatientName: z.string().max(120).optional(),
  externalPatientEmail: z.string().email().optional().or(z.literal("")),
  externalPatientPhone: z.string().max(40).optional(),
  serviceOfferingId: z.string().uuid().optional(),
  modality: z.enum(["in_person", "video", "phone"]).default("in_person"),
  notes: z.string().max(2000).optional(),
  timezone: z.string().default("America/Sao_Paulo"),
});

export interface ScheduleResult {
  ok: boolean;
  message?: string;
  appointmentId?: string;
}

export async function scheduleAppointmentAction(
  formData: FormData,
): Promise<ScheduleResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = ScheduleSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Campos invalidos: " +
        Object.entries(parsed.error.flatten().fieldErrors)
          .map(([k, v]) => `${k}: ${v?.join(",")}`)
          .join("; "),
    };
  }

  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  const endsAt = new Date(startsAt.getTime() + d.durationMinutes * 60_000);

  try {
    const result = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        try {
          const appt = await tx.appointment.create({
            data: {
              organizationId,
              professionalUserId: userId,
              patientId: d.patientId ?? null,
              serviceOfferingId: d.serviceOfferingId ?? null,
              startsAt,
              endsAt,
              timezone: d.timezone,
              externalPatientName: d.externalPatientName ?? null,
              externalPatientEmail: d.externalPatientEmail || null,
              externalPatientPhone: d.externalPatientPhone ?? null,
              modality: d.modality,
              notes: d.notes ?? null,
              status: "SCHEDULED",
              source: "manual",
            },
          });

          // Status event (state machine)
          await tx.appointmentStatusEvent.create({
            data: {
              appointmentId: appt.id,
              fromStatus: null,
              toStatus: "SCHEDULED",
              changedByUserId: userId,
              reason: "Initial scheduling",
            },
          });

          // Audit
          await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'appointment.create'::text, 'Appointment'::text,
            ${appt.id}::text, ${d.patientId ?? null}::uuid,
            ARRAY['startsAt','endsAt','patientId']::text[],
            '{}'::jsonb
          )
        `;

          return appt;
        } catch (err) {
          // GiST exclusion constraint violation = overlap
          if (
            err instanceof Error &&
            err.message.includes("appointments_no_overlap")
          ) {
            throw new Error(
              "Conflito de horário: já existe consulta marcada nesse intervalo.",
            );
          }
          throw err;
        }
      },
    );

    // Fire-and-forget: notificar paciente vinculado por email
    if (d.patientId) {
      void (async () => {
        try {
          const patient = await prisma.patient.findFirst({
            where: { id: d.patientId! },
            select: {
              email: true,
              fullName: true,
              organization: { select: { name: true } },
            },
          });
          if (patient?.email) {
            await sendAppointmentScheduledEmail({
              to: patient.email,
              patientFullName: patient.fullName,
              organizationName: patient.organization.name,
              startsAt,
              endsAt,
              modality: d.modality,
              timezone: d.timezone,
            });
          }
        } catch {
          // Email failure nunca bloqueia o agendamento
        }
      })();
    }

    revalidatePath("/app/agenda");
    return { ok: true, appointmentId: result.id };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao agendar",
    };
  }
}

const UpdateAppointmentSchema = z.object({
  appointmentId: z.string().uuid(),
  startsAt: z.string(), // ISO
  durationMinutes: z.coerce.number().int().min(15).max(480),
  modality: z.enum(["in_person", "video", "phone"]),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export async function updateAppointmentAction(
  formData: FormData,
): Promise<ScheduleResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = UpdateAppointmentSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        "Campos inválidos: " +
        Object.entries(parsed.error.flatten().fieldErrors)
          .map(([k, v]) => `${k}: ${v?.join(",")}`)
          .join("; "),
    };
  }

  const d = parsed.data;
  const startsAt = new Date(d.startsAt);
  const endsAt = new Date(startsAt.getTime() + d.durationMinutes * 60_000);

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      try {
        const current = await tx.appointment.findFirst({
          where: { id: d.appointmentId },
          select: { status: true, patientId: true },
        });
        if (!current) throw new Error("Agendamento não encontrado");
        if (current.status === "COMPLETED" || current.status === "CANCELLED") {
          throw new Error(
            "Não é possível editar um agendamento concluído ou cancelado.",
          );
        }

        await tx.appointment.update({
          where: { id: d.appointmentId },
          data: {
            startsAt,
            endsAt,
            modality: d.modality,
            notes: d.notes || null,
          },
        });

        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'appointment.update'::text, 'Appointment'::text,
            ${d.appointmentId}::text,
            ${current.patientId}::uuid,
            ARRAY['startsAt','endsAt','modality','notes']::text[],
            '{}'::jsonb
          )
        `;
      } catch (err) {
        if (
          err instanceof Error &&
          err.message.includes("appointments_no_overlap")
        ) {
          throw new Error(
            "Conflito de horário: já existe consulta marcada nesse intervalo.",
          );
        }
        throw err;
      }
    });

    revalidatePath("/app/agenda");
    return { ok: true, appointmentId: d.appointmentId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao atualizar",
    };
  }
}

const StatusUpdateSchema = z.object({
  appointmentId: z.string().uuid(),
  toStatus: z.enum([
    "SCHEDULED",
    "CONFIRMED",
    "CHECKED_IN",
    "COMPLETED",
    "CANCELLED",
    "NO_SHOW",
  ]),
  reason: z.string().max(500).optional(),
});

export async function updateAppointmentStatusAction(input: {
  appointmentId: string;
  toStatus:
    | "SCHEDULED"
    | "CONFIRMED"
    | "CHECKED_IN"
    | "COMPLETED"
    | "CANCELLED"
    | "NO_SHOW";
  reason?: string;
}): Promise<ScheduleResult> {
  const parsed = StatusUpdateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados invalidos" };

  // Estado da consulta após a transação (para email pós-commit)
  interface AppointmentNotifyData {
    patientId: string;
    startsAt: Date;
    endsAt: Date;
    modality: string;
    timezone: string;
    toStatus: "CONFIRMED" | "CANCELLED";
    reason?: string;
  }
  let notifyData: AppointmentNotifyData | null = null;

  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      const current = await tx.appointment.findFirst({
        where: { id: parsed.data.appointmentId },
        select: {
          status: true,
          patientId: true,
          startsAt: true,
          endsAt: true,
          modality: true,
          timezone: true,
        },
      });
      if (!current) throw new Error("Agendamento não encontrado");

      const extraData: Record<string, Date | string | null> = {
        status: parsed.data.toStatus,
      };
      if (parsed.data.toStatus === "CANCELLED") {
        extraData.cancelledAt = new Date();
        extraData.cancelledByUserId = userId;
        extraData.cancellationReason = parsed.data.reason ?? null;
      } else if (parsed.data.toStatus === "COMPLETED") {
        extraData.completedAt = new Date();
      }

      await tx.appointment.update({
        where: { id: parsed.data.appointmentId },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: extraData as any,
      });

      await tx.appointmentStatusEvent.create({
        data: {
          appointmentId: parsed.data.appointmentId,
          fromStatus: current.status,
          toStatus: parsed.data.toStatus,
          changedByUserId: userId,
          reason: parsed.data.reason ?? null,
        },
      });

      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid, ${userId}::uuid,
          'nutritionist'::text, NULL::inet, NULL::text,
          ${`appointment.status.${parsed.data.toStatus.toLowerCase()}`}::text,
          'Appointment'::text,
          ${parsed.data.appointmentId}::text,
          ${current.patientId}::uuid,
          ARRAY['status']::text[],
          '{}'::jsonb
        )
      `;

      // Capturar dados para email pós-transação
      if (
        (parsed.data.toStatus === "CONFIRMED" ||
          parsed.data.toStatus === "CANCELLED") &&
        current.patientId
      ) {
        notifyData = {
          patientId: current.patientId,
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          modality: current.modality,
          timezone: current.timezone,
          toStatus: parsed.data.toStatus as "CONFIRMED" | "CANCELLED",
          reason: parsed.data.reason,
        };
      }
    });

    // Fire-and-forget: email de notificação pós-commit
    if (notifyData) {
      const nd = notifyData as AppointmentNotifyData;
      void (async () => {
        try {
          const patient = await prisma.patient.findFirst({
            where: { id: nd.patientId! },
            select: {
              email: true,
              fullName: true,
              organization: { select: { name: true } },
            },
          });
          if (!patient?.email) return;

          const base = {
            to: patient.email,
            patientFullName: patient.fullName,
            organizationName: patient.organization.name,
            startsAt: nd.startsAt,
            endsAt: nd.endsAt,
            modality: nd.modality,
            timezone: nd.timezone,
          };

          if (nd.toStatus === "CONFIRMED") {
            await sendAppointmentConfirmedEmail(base);
          } else if (nd.toStatus === "CANCELLED") {
            await sendAppointmentCancelledEmail({ ...base, reason: nd.reason });
          }
        } catch {
          // Email failure nunca bloqueia a atualização de status
        }
      })();
    }

    revalidatePath("/app/agenda");
    return { ok: true, appointmentId: parsed.data.appointmentId };
  } catch (err) {
    if (err instanceof ActionTenantError)
      return { ok: false, message: err.message };
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro",
    };
  }
}
