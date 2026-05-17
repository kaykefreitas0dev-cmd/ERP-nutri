# Runbook 05 — Resend / AWS SES ambos indisponíveis

**Severidade:** P2
**MTTR alvo:** <30min

## Sintoma

- Magic links não chegam (Resend status confirma incidente OU)
- Bounce rate >50% em PostHog
- Sentry alerta `email.send.failed` consistente
- AWS SES retorna 500/timeout

## Mitigação imediata

Trocar provider primário via env (Lock 9 ADR 0050):

| Estado atual | Trocar para |
|---|---|
| `EMAIL_PROVIDER=ses` | `EMAIL_PROVIDER=resend` |
| `EMAIL_PROVIDER=resend` | `EMAIL_PROVIDER=ses` |
| Ambos down | Ativar fallback Twilio SMS para auth (já no Lock 9) |

Vercel Dashboard → erp-nutri-web → Environment Variables → atualizar → auto-redeploy.

## Mitigação alternativa

Se ambos providers down e SMS Twilio também:
1. Status page comunica explicitamente "Autenticação temporariamente indisponível"
2. Suporte por email (caso ironicamente disponível) ou WhatsApp pessoal do PM
3. Pacientes existentes continuam usando sessão ativa (não precisam relogar — Lock 16 IndexedDB encryption preserva refresh token até 7d iOS / 30d Android)

## Causa raiz

- Status page do provider (status.resend.com / status.aws.amazon.com)
- Sentry events `email.send.failed` últimas 24h por padrão de erro
- PostHog funnel auth quebrado em qual etapa

## Prevenção

- [ ] ADR 0050 — adapter pattern com switch via env (já implementado S2a)
- [ ] PostHog alerta quando `email.delivery_rate` < 95% em 1h
- [ ] Em S12b (Lock 9) implementar fallback automático: hard bounce → tenta outro provider
