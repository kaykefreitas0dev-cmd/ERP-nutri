/**
 * POST /api/internal/workers/appointments/remind
 *
 * Worker invocado pelo QStash ~24h antes de cada consulta.
 * - Verifica assinatura QStash (proteção contra replay/spam)
 * - Valida que a consulta ainda está SCHEDULED ou CONFIRMED
 * - Valida janela de tempo: startsAt deve estar 0–30h no futuro
 *   (garante que lembretes de consultas reagendadas são ignorados)
 * - Envia email de lembrete ao paciente via Resend
 *
 * Graceful degradation:
 *   - QSTASH_CURRENT_SIGNING_KEY ausente → aceita sem verificação (dev)
 *   - RESEND_API_KEY ausente → skipped
 *   - Paciente sem email → skipped
 */

import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { prisma } from "@nutricore/db";
import { sendAppointmentReminderEmail } from "@/lib/email/send-appointment-notification";

export const dynamic = "force-dynamic";

// Janela máxima: aceitar se consulta for até 30h no futuro
const MAX_HOURS_AHEAD = 30;

async function handler(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    !body ||
    typeof body !== "object" ||
    !("appointmentId" in body) ||
    typeof (body as Record<string, unknown>).appointmentId !== "string"
  ) {
    return NextResponse.json(
      { error: "missing_appointmentId" },
      { status: 400 },
    );
  }

  const { appointmentId } = body as { appointmentId: string };

  const appt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      startsAt: true,
      endsAt: true,
      status: true,
      modality: true,
      timezone: true,
      patientId: true,
    },
  });

  // Consulta não encontrada (pode ter sido deletada — improvável mas possível)
  if (!appt) {
    return NextResponse.json({ skipped: "not_found" });
  }

  // Pular se não está mais em estado agendável
  if (!["SCHEDULED", "CONFIRMED"].includes(appt.status)) {
    return NextResponse.json({ skipped: `status_${appt.status}` });
  }

  // Janela de tempo: consulta deve acontecer nos próximos 0–30h
  // Isso filtra lembretes de consultas que foram reagendadas para o futuro distante
  const hoursUntil = (appt.startsAt.getTime() - Date.now()) / 3_600_000;
  if (hoursUntil < 0) {
    return NextResponse.json({ skipped: "already_past" });
  }
  if (hoursUntil > MAX_HOURS_AHEAD) {
    return NextResponse.json({
      skipped: "out_of_window",
      hoursUntil: Math.round(hoursUntil),
    });
  }

  // Paciente sem vínculo (consulta externa sem patientId)
  if (!appt.patientId) {
    return NextResponse.json({ skipped: "no_patient_id" });
  }

  const patient = await prisma.patient.findFirst({
    where: { id: appt.patientId },
    select: {
      email: true,
      fullName: true,
      organization: { select: { name: true } },
    },
  });

  if (!patient?.email) {
    return NextResponse.json({ skipped: "no_patient_email" });
  }

  const result = await sendAppointmentReminderEmail({
    to: patient.email,
    patientFullName: patient.fullName,
    organizationName: patient.organization.name,
    startsAt: appt.startsAt,
    endsAt: appt.endsAt,
    modality: appt.modality,
    timezone: appt.timezone,
  });

  return NextResponse.json({
    ok: result.ok,
    skipped: result.skipped,
    emailId: result.emailId,
    error: result.error,
  });
}

// QStash signature verification — no dev mode (QSTASH_CURRENT_SIGNING_KEY not set)
// verifySignatureAppRouter falls back to no-op when signing keys are absent.
export const POST = verifySignatureAppRouter(handler);
