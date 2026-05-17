"use server";

import { z } from "zod";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { prisma } from "@nutricore/db";

const PublicBookingSchema = z.object({
  bookingPageId: z.string().uuid(),
  serviceOfferingId: z.string().uuid(),
  startsAt: z.string(), // ISO
  patientName: z.string().min(2).max(120).trim(),
  patientEmail: z.string().email().toLowerCase().trim(),
  patientPhone: z.string().max(40).optional().or(z.literal("")),
  notes: z.string().max(2000).optional().or(z.literal("")),
});

export interface PublicBookingResult {
  ok: boolean;
  message?: string;
  appointmentId?: string;
}

export async function submitPublicBookingAction(
  formData: FormData,
): Promise<PublicBookingResult> {
  const raw = {
    bookingPageId: formData.get("bookingPageId"),
    serviceOfferingId: formData.get("serviceOfferingId"),
    startsAt: formData.get("startsAt"),
    patientName: formData.get("patientName"),
    patientEmail: formData.get("patientEmail"),
    patientPhone: formData.get("patientPhone") || "",
    notes: formData.get("notes") || "",
  };

  const parsed = PublicBookingSchema.safeParse(raw);
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

  try {
    // Buscar booking page + service (validação de existência + min_notice + max_advance)
    const bp = await prisma.bookingPage.findFirst({
      where: { id: d.bookingPageId, isPublished: true },
      select: {
        id: true,
        organizationId: true,
        professionalUserId: true,
        timezone: true,
        minNoticeHours: true,
        maxAdvanceDays: true,
        acceptsNewPatients: true,
      },
    });

    if (!bp) return { ok: false, message: "Profissional não encontrado" };
    if (!bp.acceptsNewPatients) {
      return { ok: false, message: "Profissional não está aceitando novos pacientes" };
    }

    const service = await prisma.serviceOffering.findFirst({
      where: { id: d.serviceOfferingId, bookingPageId: d.bookingPageId, isActive: true },
      select: { durationMinutes: true },
    });

    if (!service) return { ok: false, message: "Serviço indisponível" };

    const startsAt = new Date(d.startsAt);
    const now = new Date();
    const minStart = new Date(now.getTime() + bp.minNoticeHours * 3600_000);
    const maxStart = new Date(now.getTime() + bp.maxAdvanceDays * 24 * 3600_000);

    if (startsAt < minStart) {
      return {
        ok: false,
        message: `Agendamento exige pelo menos ${bp.minNoticeHours}h de antecedência`,
      };
    }
    if (startsAt > maxStart) {
      return {
        ok: false,
        message: `Agendamento permitido até ${bp.maxAdvanceDays} dias`,
      };
    }

    const endsAt = new Date(startsAt.getTime() + service.durationMinutes * 60_000);

    // Idempotency key (mesmo email + horário = único)
    const idempotencyKey = createHash("sha256")
      .update(`${d.bookingPageId}|${d.patientEmail}|${d.startsAt}`)
      .digest("hex")
      .slice(0, 32);

    const h = await headers();
    const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    try {
      const appt = await prisma.appointment.create({
        data: {
          organizationId: bp.organizationId,
          professionalUserId: bp.professionalUserId,
          bookingPageId: bp.id,
          serviceOfferingId: d.serviceOfferingId,
          startsAt,
          endsAt,
          timezone: bp.timezone,
          externalPatientName: d.patientName,
          externalPatientEmail: d.patientEmail,
          externalPatientPhone: d.patientPhone || null,
          notes: d.notes || null,
          status: "SCHEDULED",
          source: "public_booking",
          idempotencyKey,
        },
      });

      // Status event
      await prisma.appointmentStatusEvent.create({
        data: {
          appointmentId: appt.id,
          fromStatus: null,
          toStatus: "SCHEDULED",
          changedByUserId: null,
          reason: "Public booking",
          metadata: {
            ip,
            source: "public_booking",
            email: d.patientEmail,
          },
        },
      });

      // Audit (sem actor_user_id — booking público)
      await prisma.$executeRaw`
        SELECT audit.append_log(
          ${bp.organizationId}::uuid, NULL::uuid,
          'public_booking'::text, ${ip}::inet, NULL::text,
          'appointment.public_booking'::text, 'Appointment'::text,
          ${appt.id}::text, NULL::uuid,
          ARRAY['externalPatientEmail','startsAt']::text[],
          ${JSON.stringify({ idempotencyKey })}::jsonb
        )
      `;

      // TODO S12b: enviar email de confirmação via Resend
      // TODO S6+: webhook Google Calendar para criar evento espelho

      return { ok: true, appointmentId: appt.id };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "?";
      if (msg.includes("appointments_no_overlap")) {
        return {
          ok: false,
          message: "Horário já ocupado. Escolha outro slot disponível.",
        };
      }
      if (msg.includes("idempotency_key")) {
        return {
          ok: true,
          message: "Esse agendamento já foi feito anteriormente (idempotent).",
        };
      }
      throw err;
    }
  } catch (err) {
    console.error("[/c/:slug booking]", err);
    return { ok: false, message: "Erro ao agendar. Tente novamente." };
  }
}

// Helper exposto: calcular slots disponíveis em uma data
// (chamado pelo BookingForm via separate Server Action)
export async function getAvailableSlotsAction(input: {
  bookingPageId: string;
  date: string; // YYYY-MM-DD
  durationMinutes: number;
}): Promise<{ ok: boolean; slots?: string[]; message?: string }> {
  try {
    const bp = await prisma.bookingPage.findFirst({
      where: { id: input.bookingPageId, isPublished: true },
      select: {
        organizationId: true,
        professionalUserId: true,
        timezone: true,
        bufferBeforeMinutes: true,
        bufferAfterMinutes: true,
        minNoticeHours: true,
      },
    });
    if (!bp) return { ok: false, message: "BookingPage não encontrada" };

    const date = new Date(input.date);
    const dayOfWeek = date.getDay();

    // Regras de disponibilidade para esse dia
    const rules = await prisma.availabilityRule.findMany({
      where: { bookingPageId: input.bookingPageId, dayOfWeek },
      select: { startTime: true, endTime: true },
    });

    if (rules.length === 0) return { ok: true, slots: [] };

    // Appointments existentes nesse dia
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const existing = await prisma.appointment.findMany({
      where: {
        professionalUserId: bp.professionalUserId,
        startsAt: { gte: startOfDay, lte: endOfDay },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
      },
      select: { startsAt: true, endsAt: true },
    });

    // Calcular slots
    const slots: string[] = [];
    const now = new Date();
    const minStart = new Date(now.getTime() + bp.minNoticeHours * 3600_000);

    for (const rule of rules) {
      const [startHRaw, startMRaw] = rule.startTime.split(":");
      const [endHRaw, endMRaw] = rule.endTime.split(":");
      const startH = startHRaw ?? "0";
      const startM = startMRaw ?? "0";
      const endH = endHRaw ?? "23";
      const endM = endMRaw ?? "59";

      const slotStart = new Date(date);
      slotStart.setHours(Number(startH), Number(startM), 0, 0);
      const slotEnd = new Date(date);
      slotEnd.setHours(Number(endH), Number(endM), 0, 0);

      const step = input.durationMinutes + bp.bufferBeforeMinutes + bp.bufferAfterMinutes;
      let cursor = new Date(slotStart);

      while (cursor.getTime() + input.durationMinutes * 60_000 <= slotEnd.getTime()) {
        const slotEndCandidate = new Date(cursor.getTime() + input.durationMinutes * 60_000);

        // Min notice
        if (cursor < minStart) {
          cursor = new Date(cursor.getTime() + step * 60_000);
          continue;
        }

        // Overlap com existentes?
        const conflict = existing.some(
          (e) =>
            cursor < new Date(e.endsAt) &&
            slotEndCandidate > new Date(e.startsAt),
        );

        if (!conflict) {
          slots.push(cursor.toISOString());
        }

        cursor = new Date(cursor.getTime() + step * 60_000);
      }
    }

    return { ok: true, slots };
  } catch (err) {
    console.error("[/c/:slug slots]", err);
    return { ok: false, message: "Erro ao buscar horários" };
  }
}
