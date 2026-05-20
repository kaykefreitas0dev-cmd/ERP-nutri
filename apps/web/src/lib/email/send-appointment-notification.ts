/**
 * Notificações de email para eventos de consulta.
 *
 * - Provider: Resend (mesma infra de send-invite.ts)
 * - Graceful degradation: sem RESEND_API_KEY → skipped: true
 * - Templates inline HTML sem dependências extras
 *
 * Eventos cobertos:
 *   • appointment.scheduled   — nova consulta criada para paciente vinculado
 *   • appointment.rescheduled — data/hora/modalidade alterados pelo profissional
 *   • appointment.confirmed   — status SCHEDULED → CONFIRMED
 *   • appointment.cancelled   — status → CANCELLED
 */

import { Resend } from "resend";

export interface AppointmentNotificationResult {
  ok: boolean;
  skipped?: boolean;
  emailId?: string;
  error?: string;
}

// Modalidade → label PT-BR
const MODALITY_LABEL: Record<string, string> = {
  in_person: "Presencial",
  video: "Videoconferência",
  phone: "Telefone",
};

// ─── Tipo base para todos os eventos ─────────────────────────────────────────

interface AppointmentEmailBase {
  to: string; // email do paciente
  patientFullName: string;
  organizationName: string;
  startsAt: Date;
  endsAt: Date;
  modality: string;
  timezone?: string;
}

// ─── scheduled ───────────────────────────────────────────────────────────────

export async function sendAppointmentScheduledEmail(
  params: AppointmentEmailBase,
): Promise<AppointmentNotificationResult> {
  return sendNotification({
    ...params,
    subject: `Nova consulta agendada — ${formatDateTime(params.startsAt, params.timezone)}`,
    html: renderScheduledHtml(params),
    text: renderScheduledText(params),
  });
}

// ─── rescheduled ─────────────────────────────────────────────────────────────

export async function sendAppointmentRescheduledEmail(
  params: AppointmentEmailBase,
): Promise<AppointmentNotificationResult> {
  return sendNotification({
    ...params,
    subject: `Consulta reagendada — ${formatDateTime(params.startsAt, params.timezone)}`,
    html: renderRescheduledHtml(params),
    text: renderRescheduledText(params),
  });
}

// ─── confirmed ───────────────────────────────────────────────────────────────

export async function sendAppointmentConfirmedEmail(
  params: AppointmentEmailBase,
): Promise<AppointmentNotificationResult> {
  return sendNotification({
    ...params,
    subject: `Consulta confirmada — ${formatDateTime(params.startsAt, params.timezone)}`,
    html: renderConfirmedHtml(params),
    text: renderConfirmedText(params),
  });
}

// ─── cancelled ───────────────────────────────────────────────────────────────

interface CancelledParams extends AppointmentEmailBase {
  reason?: string | null;
}

export async function sendAppointmentCancelledEmail(
  params: CancelledParams,
): Promise<AppointmentNotificationResult> {
  return sendNotification({
    ...params,
    subject: `Consulta cancelada — ${formatDateTime(params.startsAt, params.timezone)}`,
    html: renderCancelledHtml(params),
    text: renderCancelledText(params),
  });
}

// ─── Core sender ─────────────────────────────────────────────────────────────

async function sendNotification(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}): Promise<AppointmentNotificationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const fromAddress =
    process.env.RESEND_FROM_ADDRESS ?? "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      headers: { "X-Entity-Ref-ID": "appointment-notification" },
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, emailId: result.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(date: Date, tz = "America/Sao_Paulo"): string {
  return date.toLocaleString("pt-BR", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTime(date: Date, tz = "America/Sao_Paulo"): string {
  return date.toLocaleTimeString("pt-BR", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─── HTML templates ───────────────────────────────────────────────────────────

function baseLayout(body: string, footer: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background:#0f766e;padding:24px 32px;color:#ffffff;">
              <div style="font-size:20px;font-weight:bold;">NutriCore</div>
              <div style="font-size:12px;opacity:0.9;margin-top:4px;">Acompanhamento nutricional digital</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">${body}</td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">${footer}</td>
          </tr>
        </table>
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;">NutriCore &middot; plataforma de gestão clínica para nutricionistas</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function apptInfoBlock(p: AppointmentEmailBase): string {
  const tz = p.timezone ?? "America/Sao_Paulo";
  const modalityLabel = MODALITY_LABEL[p.modality] ?? p.modality;
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;">
      <tr>
        <td style="font-size:14px;line-height:1.8;color:#334155;">
          <strong style="display:block;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;">Detalhes da consulta</strong>
          <span style="display:block;">
            <strong>Data e hora:</strong> ${escapeHtml(formatDateTime(p.startsAt, tz))} &ndash; ${escapeHtml(formatTime(p.endsAt, tz))}
          </span>
          <span style="display:block;"><strong>Modalidade:</strong> ${escapeHtml(modalityLabel)}</span>
          <span style="display:block;"><strong>Profissional/Clínica:</strong> ${escapeHtml(p.organizationName)}</span>
        </td>
      </tr>
    </table>`;
}

function renderRescheduledHtml(p: AppointmentEmailBase): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#d97706;">
      Consulta reagendada 🗓️
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Olá, <strong style="color:#0f172a;">${escapeHtml(firstName)}</strong>!
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Sua consulta com <strong>${escapeHtml(p.organizationName)}</strong> foi reagendada para uma nova data e horário.
    </p>
    ${apptInfoBlock(p)}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
      Se tiver dúvidas, entre em contato com ${escapeHtml(p.organizationName)} ou acesse o app.
    </p>`;
  const footer = `Aviso de reagendamento de consulta com ${escapeHtml(p.organizationName)}.`;
  return baseLayout(body, footer);
}

function renderScheduledHtml(p: AppointmentEmailBase): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">
      Nova consulta agendada! 📅
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Olá, <strong style="color:#0f172a;">${escapeHtml(firstName)}</strong>!
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      <strong>${escapeHtml(p.organizationName)}</strong> agendou uma consulta para você.
    </p>
    ${apptInfoBlock(p)}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
      Acesse o app para ver todos os detalhes e acompanhar sua consulta.
    </p>`;
  const footer = `Você recebeu este email porque tem uma consulta agendada com ${escapeHtml(p.organizationName)}.`;
  return baseLayout(body, footer);
}

function renderConfirmedHtml(p: AppointmentEmailBase): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#0f766e;">
      Consulta confirmada! ✅
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Olá, <strong style="color:#0f172a;">${escapeHtml(firstName)}</strong>!
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Sua consulta com <strong>${escapeHtml(p.organizationName)}</strong> foi confirmada.
    </p>
    ${apptInfoBlock(p)}
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
      Até lá! Acesse o app para acompanhar seu plano nutricional enquanto isso.
    </p>`;
  const footer = `Confirmação de consulta com ${escapeHtml(p.organizationName)}.`;
  return baseLayout(body, footer);
}

function renderCancelledHtml(p: CancelledParams): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  const reasonBlock = p.reason
    ? `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#475569;background:#fef2f2;border-left:3px solid #f87171;padding:10px 14px;border-radius:0 6px 6px 0;">
        <strong>Motivo:</strong> ${escapeHtml(p.reason)}
      </p>`
    : "";
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#dc2626;">
      Consulta cancelada
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Olá, <strong style="color:#0f172a;">${escapeHtml(firstName)}</strong>.
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Sua consulta com <strong>${escapeHtml(p.organizationName)}</strong> foi cancelada.
    </p>
    ${apptInfoBlock(p)}
    ${reasonBlock}
    <p style="margin:8px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
      Para reagendar, entre em contato com ${escapeHtml(p.organizationName)} ou acesse o app.
    </p>`;
  const footer = `Aviso de cancelamento de consulta com ${escapeHtml(p.organizationName)}.`;
  return baseLayout(body, footer);
}

// ─── Plain text templates ─────────────────────────────────────────────────────

function apptInfoText(p: AppointmentEmailBase): string {
  const tz = p.timezone ?? "America/Sao_Paulo";
  return `Data e hora: ${formatDateTime(p.startsAt, tz)} – ${formatTime(p.endsAt, tz)}
Modalidade: ${MODALITY_LABEL[p.modality] ?? p.modality}
Profissional/Clínica: ${p.organizationName}`;
}

function renderRescheduledText(p: AppointmentEmailBase): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  return `Consulta reagendada — ${p.organizationName}

Olá, ${firstName}!

Sua consulta com ${p.organizationName} foi reagendada.

${apptInfoText(p)}

Se tiver dúvidas, entre em contato ou acesse o app.

—
NutriCore · acompanhamento nutricional digital`;
}

function renderScheduledText(p: AppointmentEmailBase): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  return `Nova consulta agendada — ${p.organizationName}

Olá, ${firstName}!

${p.organizationName} agendou uma consulta para você.

${apptInfoText(p)}

Acesse o app para ver todos os detalhes.

—
NutriCore · acompanhamento nutricional digital`;
}

function renderConfirmedText(p: AppointmentEmailBase): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  return `Consulta confirmada — ${p.organizationName}

Olá, ${firstName}!

Sua consulta com ${p.organizationName} foi confirmada.

${apptInfoText(p)}

Até lá!

—
NutriCore · acompanhamento nutricional digital`;
}

function renderCancelledText(p: CancelledParams): string {
  const firstName = p.patientFullName.split(" ")[0]!;
  const reasonLine = p.reason ? `\nMotivo: ${p.reason}\n` : "";
  return `Consulta cancelada — ${p.organizationName}

Olá, ${firstName}.

Sua consulta com ${p.organizationName} foi cancelada.

${apptInfoText(p)}
${reasonLine}
Para reagendar, entre em contato com ${p.organizationName} ou acesse o app.

—
NutriCore · acompanhamento nutricional digital`;
}
