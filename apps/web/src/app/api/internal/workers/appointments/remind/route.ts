/**
 * POST /api/internal/workers/appointments/remind
 *
 * Worker invocado pelo QStash ~24h antes de cada consulta.
 * - Verifica assinatura QStash quando QSTASH_CURRENT_SIGNING_KEY está presente
 *   (em dev/CI sem keys configuradas a verificação é ignorada)
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
import { prisma } from "@nutricore/db";
import { sendAppointmentReminderEmail } from "@/lib/email/send-appointment-notification";

export const dynamic = "force-dynamic";

// Janela máxima: aceitar se consulta for até 30h no futuro
const MAX_HOURS_AHEAD = 30;

/**
 * Verifica assinatura QStash se as signing keys estiverem configuradas.
 * Retorna false se a assinatura for inválida quando as keys estão presentes.
 * Retorna true (sem verificação) se as keys não estiverem configuradas.
 */
async function verifyQStashSignature(
  req: NextRequest,
  rawBody: string,
): Promise<boolean> {
  const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY;

  // Dev mode / not configured — skip verification
  if (!currentKey || !nextKey) return true;

  try {
    const { Receiver } = await import("@upstash/qstash");
    const receiver = new Receiver({
      currentSigningKey: currentKey,
      nextSigningKey: nextKey,
    });
    const signature = req.headers.get("upstash-signature") ?? "";
    await receiver.verify({ signature, body: rawBody });
    return true;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  // Read body as text first (needed for signature verification)
  const rawBody = await req.text();

  const isValid = await verifyQStashSignature(req, rawBody);
  if (!isValid) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
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
