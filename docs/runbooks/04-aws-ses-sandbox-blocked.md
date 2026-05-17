# Runbook 04 — AWS SES bloqueia envio fora sandbox

**Severidade:** P2
**MTTR alvo:** <1h (mudar para Resend) ou 2-3 dias úteis (sair de sandbox)

## Sintoma

- Magic links não chegam para email não-verificado
- Sentry: `MessageRejected: Email address is not verified`
- PostHog `auth.email_sent` cai mas `auth.email_delivered` zero
- Novos cadastros travam em /login

## Causa

AWS SES inicia em **sandbox mode** — só envia para emails/domínios **previamente verificados** no console.

## Mitigação imediata (PM, ~5min)

Trocar provider para Resend via env var (Lock 9 ADR 0050 — adapter pattern):

1. Vercel Dashboard → erp-nutri-web → Settings → Environment Variables
2. Atualizar `EMAIL_PROVIDER` de `ses` para `resend`
3. Confirmar `RESEND_API_KEY` está configurada
4. Redeploy (auto após salvar env)
5. Teste fluxo magic link com email externo

Resend Free permite 100 emails/dia. Suficiente para emergência.

## Mitigação alternativa

Adicionar email do PM (ou clientes específicos) à allowlist SES:

1. AWS Console → SES → Verified identities → Create identity
2. Email address: `kayke@example.com`
3. Aguarde email de verificação + clique link

Só funciona para volumes pequenos (cada email manual).

## Causa raiz / Saída do sandbox

Solicitar production access:

1. AWS Console → SES → Account dashboard → "Request production access"
2. Use case: "B2B SaaS for nutrition professionals — magic link auth + transactional emails"
3. Volume estimado: 5k/mês inicial
4. Tipo: transactional (não-marketing)
5. Tempo: 2-3 dias úteis aprovação

Após aprovado:
- Vercel env: `EMAIL_PROVIDER=ses` novamente
- PostHog event `email.provider_switch` (telemetria)
- Resend fica como fallback (bounce handler v11.2 Diff)

## Prevenção

- [ ] Sprint 0 (S2): solicitar SES production access em paralelo ao MEI
- [ ] Adapter pattern (ADR 0050) garante swap sem code change
- [ ] Sentry alerta `MessageRejected` com texto explícito mencionando este runbook
