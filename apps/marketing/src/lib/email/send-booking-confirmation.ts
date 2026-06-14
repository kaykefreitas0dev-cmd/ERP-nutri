/**
 * Email de confirmação de agendamento público (/c/:slug).
 *
 * - Provider: Resend (mesma infra do app web)
 * - Graceful degradation: sem RESEND_API_KEY → skipped: true (nunca lança)
 * - Template inline HTML, sem dependências extras
 *
 * Enviado ao paciente logo após criar o agendamento pela página pública.
 */

import { Resend } from "resend";

export interface BookingConfirmationResult {
  ok: boolean;
  skipped?: boolean;
  emailId?: string;
  error?: string;
}

export interface BookingConfirmationParams {
  to: string;
  patientName: string;
  organizationName: string;
  serviceName?: string | null;
  startsAt: Date;
  endsAt: Date;
  timezone?: string;
}

export async function sendBookingConfirmationEmail(
  params: BookingConfirmationParams,
): Promise<BookingConfirmationResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const fromAddress =
    process.env.RESEND_FROM_ADDRESS ?? "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  const subject = `Agendamento recebido — ${formatDateTime(
    params.startsAt,
    params.timezone,
  )}`;

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject,
      html: renderHtml(params),
      text: renderText(params),
      headers: { "X-Entity-Ref-ID": "booking-confirmation" },
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

function renderHtml(p: BookingConfirmationParams): string {
  const firstName = p.patientName.split(" ")[0] ?? p.patientName;
  const tz = p.timezone ?? "America/Sao_Paulo";
  const serviceLine = p.serviceName
    ? `<span style="display:block;"><strong>Serviço:</strong> ${escapeHtml(p.serviceName)}</span>`
    : "";
  const body = `
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">
      Agendamento recebido! 📅
    </h1>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Olá, <strong style="color:#0f172a;">${escapeHtml(firstName)}</strong>!
    </p>
    <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">
      Seu agendamento com <strong>${escapeHtml(p.organizationName)}</strong> foi registrado.
      Você receberá uma confirmação caso o profissional precise ajustar algo.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;padding:16px;margin:16px 0;">
      <tr>
        <td style="font-size:14px;line-height:1.8;color:#334155;">
          <strong style="display:block;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;">Detalhes</strong>
          <span style="display:block;"><strong>Data e hora:</strong> ${escapeHtml(formatDateTime(p.startsAt, tz))} &ndash; ${escapeHtml(formatTime(p.endsAt, tz))}</span>
          <span style="display:block;"><strong>Profissional/Clínica:</strong> ${escapeHtml(p.organizationName)}</span>
          ${serviceLine}
        </td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#64748b;">
      Se precisar cancelar ou reagendar, entre em contato com ${escapeHtml(p.organizationName)}.
    </p>`;
  const footer = `Você recebeu este email porque agendou uma consulta com ${escapeHtml(p.organizationName)} pela NutriCore.`;
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
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(p: BookingConfirmationParams): string {
  const firstName = p.patientName.split(" ")[0] ?? p.patientName;
  const tz = p.timezone ?? "America/Sao_Paulo";
  const serviceLine = p.serviceName ? `Serviço: ${p.serviceName}\n` : "";
  return `Agendamento recebido — ${p.organizationName}

Olá, ${firstName}!

Seu agendamento com ${p.organizationName} foi registrado.

Data e hora: ${formatDateTime(p.startsAt, tz)} – ${formatTime(p.endsAt, tz)}
Profissional/Clínica: ${p.organizationName}
${serviceLine}
Se precisar cancelar ou reagendar, entre em contato com ${p.organizationName}.

—
NutriCore · acompanhamento nutricional digital`;
}
