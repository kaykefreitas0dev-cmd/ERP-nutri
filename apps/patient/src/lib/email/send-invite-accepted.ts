/**
 * Email de notificação para o nutricionista quando um paciente aceita o convite.
 *
 * - Provider: Resend (mesmo RESEND_API_KEY configurado no projeto)
 * - Graceful degradation: sem RESEND_API_KEY → { skipped: true }
 * - Destinatário: org_owner (nutricionista responsável)
 * - Template inline HTML sem dependências extras
 */

import { Resend } from "resend";

export interface SendInviteAcceptedResult {
  ok: boolean;
  skipped?: boolean;
  emailId?: string;
  error?: string;
}

interface SendInviteAcceptedParams {
  to: string; // email do nutricionista
  nutriFullName?: string; // nome do nutri (pode ser undefined se não cadastrado)
  organizationName: string;
  patientFullName: string;
  patientEmail: string;
}

export async function sendInviteAcceptedEmail(
  params: SendInviteAcceptedParams,
): Promise<SendInviteAcceptedResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, skipped: true };

  const fromAddress =
    process.env.RESEND_FROM_ADDRESS ?? "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  const subject = `${params.patientFullName} aceitou seu convite no NutriCore`;

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject,
      html: renderHtml(params),
      text: renderText(params),
      headers: { "X-Entity-Ref-ID": "invite-accepted" },
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

function renderHtml(p: SendInviteAcceptedParams): string {
  const greeting = p.nutriFullName
    ? `Olá, <strong style="color:#0f172a;">${escapeHtml(p.nutriFullName.split(" ")[0]!)}</strong>!`
    : "Olá!";

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
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">
                Novo paciente conectado! 🎉
              </h1>
              <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#475569;">${greeting}</p>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
                <strong style="color:#0f172a;">${escapeHtml(p.patientFullName)}</strong>
                aceitou seu convite e já está conectado à
                <strong style="color:#0f172a;">${escapeHtml(p.organizationName)}</strong>
                no NutriCore.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;border-radius:8px;padding:16px;margin:0 0 20px;">
                <tr>
                  <td style="font-size:14px;line-height:1.8;color:#334155;">
                    <strong style="display:block;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:6px;">Paciente</strong>
                    <span style="display:block;">Nome: <strong>${escapeHtml(p.patientFullName)}</strong></span>
                    <span style="display:block;">Email: ${escapeHtml(p.patientEmail)}</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#64748b;">
                Você já pode prescrever um plano alimentar, agendar consultas e enviar documentos pelo portal do nutricionista.
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
              Notificação enviada pela plataforma NutriCore &mdash; ${escapeHtml(p.organizationName)}
            </td>
          </tr>
        </table>
        <div style="margin-top:16px;font-size:11px;color:#94a3b8;">NutriCore &middot; plataforma de gestão clínica para nutricionistas</div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderText(p: SendInviteAcceptedParams): string {
  return `Novo paciente conectado — ${p.organizationName}

Olá${p.nutriFullName ? `, ${p.nutriFullName.split(" ")[0]}` : ""}!

${p.patientFullName} aceitou seu convite e já está conectado à ${p.organizationName} no NutriCore.

Paciente: ${p.patientFullName} (${p.patientEmail})

Você já pode prescrever planos alimentares, agendar consultas e enviar documentos pelo portal.

—
NutriCore · plataforma de gestão clínica para nutricionistas`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
