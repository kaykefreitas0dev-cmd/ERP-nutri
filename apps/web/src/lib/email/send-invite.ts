/**
 * Envio de email do convite ao paciente.
 *
 * - Provider primário: Resend (free 100/dia, 3k/mês)
 * - Provider fallback: AWS SES (não habilitado MVP — sandbox)
 * - Se nenhuma env var disponível, retorna { skipped: true } — UI mostra URL
 *   pra copy-paste como degraded mode.
 *
 * Template inline HTML (sem React Email pra evitar deps extras no MVP).
 */

import { Resend } from "resend";

export interface SendInviteResult {
  ok: boolean;
  skipped?: boolean; // sem provider configurado
  emailId?: string;
  error?: string;
}

interface SendInviteParams {
  to: string;
  patientFullName: string;
  organizationName: string;
  inviteUrl: string;
  expiresAt: Date;
}

export async function sendPatientInviteEmail(
  params: SendInviteParams,
): Promise<SendInviteResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, skipped: true };
  }

  const fromAddress =
    process.env.RESEND_FROM_ADDRESS ?? "onboarding@resend.dev";
  const resend = new Resend(apiKey);

  const subject = `${params.organizationName} convidou você para acompanhar seu plano nutricional`;

  const html = renderInviteHtml(params);
  const text = renderInviteText(params);

  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: params.to,
      subject,
      html,
      text,
      headers: {
        "X-Entity-Ref-ID": "patient-invite",
      },
    });

    if (result.error) {
      return { ok: false, error: result.error.message };
    }
    return { ok: true, emailId: result.data?.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}

function renderInviteHtml(p: SendInviteParams): string {
  const firstName = p.patientFullName.split(" ")[0];
  const expiresStr = p.expiresAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Template HTML inline, table-based para compat com clientes de email
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Convite NutriCore</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background:#0f766e;padding:24px 32px;color:#ffffff;">
              <div style="font-size:20px;font-weight:bold;">NutriCore</div>
              <div style="font-size:12px;opacity:0.9;margin-top:4px;">Acompanhamento nutricional digital</div>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">
                Olá, ${escapeHtml(firstName)}! 👋
              </h1>
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#475569;">
                <strong style="color:#0f172a;">${escapeHtml(p.organizationName)}</strong>
                convidou você para acompanhar seu plano alimentar pela plataforma NutriCore.
              </p>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#475569;">
                Pelo app você pode:
              </p>
              <ul style="margin:0 0 24px;padding-left:20px;font-size:15px;line-height:1.8;color:#475569;">
                <li>Ver seu plano alimentar com receitas e quantidades</li>
                <li>Fazer check-in diário (humor, água, peso)</li>
                <li>Acompanhar consultas e baixar recibos</li>
                <li>Acessar documentos clínicos (atestados, receitas)</li>
              </ul>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 24px;">
                    <a href="${escapeAttr(p.inviteUrl)}"
                       style="display:inline-block;background:#0f766e;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:16px;font-weight:600;">
                      📧 Aceitar convite
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#64748b;">
                Se o botão não funcionar, copie e cole este link no navegador:
              </p>
              <p style="margin:0 0 16px;font-size:11px;line-height:1.5;word-break:break-all;color:#0f766e;font-family:monospace;background:#f1f5f9;padding:8px 12px;border-radius:6px;">
                ${escapeHtml(p.inviteUrl)}
              </p>
              <p style="margin:0;font-size:12px;color:#64748b;">
                ⏰ Este convite é válido até <strong>${expiresStr}</strong>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center;">
              Você recebeu este email porque foi convidado(a) por ${escapeHtml(p.organizationName)}.
              Se não reconhece este convite, simplesmente ignore — nenhuma conta será criada.
            </td>
          </tr>
        </table>

        <div style="margin-top:16px;font-size:11px;color:#94a3b8;">
          NutriCore · plataforma de gestão clínica para nutricionistas
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderInviteText(p: SendInviteParams): string {
  const firstName = p.patientFullName.split(" ")[0];
  const expiresStr = p.expiresAt.toLocaleDateString("pt-BR");

  return `Olá, ${firstName}!

${p.organizationName} convidou você para acompanhar seu plano alimentar pela plataforma NutriCore.

Pelo app você pode:
- Ver seu plano alimentar
- Fazer check-in diário
- Acompanhar consultas e baixar recibos
- Acessar documentos clínicos

Aceitar convite:
${p.inviteUrl}

Este convite é válido até ${expiresStr}.

Se não reconhece este convite, simplesmente ignore.

—
NutriCore · acompanhamento nutricional digital`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, "&quot;");
}
