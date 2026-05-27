# Runbook 10 — Asaas BaaS Down

**Severidade:** P1 (em prod, após S22)
**MTTR alvo:** < 30min (degradação para EXTERNAL_RECORDED)

## Sintoma

- Status page Asaas (https://status.asaas.com) reportando issues
- Webhooks falhando ou atrasados (lag > 5 min)
- API Asaas retornando 5xx
- Sentry com erros em `apps/web/src/app/api/v1/payments/*`
- Pacientes reportando "pagamento não chegou"

## Causa raiz comum

1. Asaas em manutenção programada (raro — anunciado com 48h antecedência)
2. Asaas degradação de produção (5xx)
3. Webhook delivery delay (Asaas → nosso endpoint)
4. Rate limit excedido (nossa subconta)
5. Subconta suspensa por compliance

## Mitigação imediata (5 min)

### 1. Confirmar incident é Asaas (não nosso)

```bash
# Testar API Asaas direto (sandbox ou prod)
curl -s -o /dev/null -w "%{http_code}\n" https://api.asaas.com/api/v3/payments \
  -H "access_token: $ASAAS_API_KEY"
# Esperado: 200 ou 401. 5xx = lado Asaas.
```

### 2. Ativar modo degraded — accept EXTERNAL_RECORDED

UI já suporta EXTERNAL_RECORDED como fallback. Ativar banner:

```bash
# Set flag via PostHog feature flag (UI sem deploy)
# Flag: payments_use_external_recorded_only = true
```

OU via Vercel env var (requer redeploy):

```bash
cd apps/web
printf "true" | npx vercel env add PAYMENTS_DEGRADED_MODE production
# Redeploy automatico
```

Comportamento esperado:

- Nutri marca consulta como "Realizada" + registra pagamento manual (PIX/cartão externo)
- Sistema NÃO tenta Asaas
- Recibo PDF é gerado normalmente

### 3. Notificar nutricionistas afetados

```bash
# Lista nutris que tentaram cobrar via Asaas nas últimas 2h:
SELECT DISTINCT u.email
FROM patient_payments pp
JOIN users u ON u.id = pp.recorded_by_user_id
WHERE pp.created_at > now() - interval '2 hours'
  AND pp.status IN ('PENDING', 'FAILED')
LIMIT 50;
```

Enviar email transacional via Resend:

> "Asaas está com instabilidade. Você pode cobrar normalmente (PIX/cartão) e registrar manualmente na plataforma. Voltamos com cobrança automática assim que normalizar."

## Investigação (15 min)

### Verificar lag de webhooks

```sql
SELECT
  count(*) FILTER (WHERE created_at > now() - interval '5 min') AS last_5min,
  count(*) FILTER (WHERE created_at > now() - interval '1 hour') AS last_hour,
  max(created_at) AS most_recent
FROM payment_webhook_events;
```

Se `most_recent` > 10 min atrás → Asaas não está enviando webhooks. Próximo passo: contato comercial Asaas.

### Verificar fila de retries

QStash dashboard: <https://console.upstash.com>

- Filtrar por destination contendo `/payments/`
- Mensagens em "Retrying" indicam lag de processamento nosso (não Asaas)
- Mensagens em "Failed" depois de 3 retries → escalar

### Verificar rate limit Asaas

```bash
# Headers retornados pelo Asaas em qualquer request:
# X-RateLimit-Limit, X-RateLimit-Remaining
curl -I https://api.asaas.com/api/v3/customers -H "access_token: $ASAAS_API_KEY"
```

Se Remaining < 100, estamos próximos do limite → reduzir frequência de polling.

## Recuperação

Quando Asaas voltar:

1. **Replay webhooks pendentes** (Asaas reenvia automaticamente, mas confirmar):
   - Dashboard Asaas → Webhooks → "Reenviar falhos"
2. **Desativar modo degraded**:
   ```bash
   cd apps/web
   npx vercel env rm PAYMENTS_DEGRADED_MODE production
   ```
3. **Reconciliar pagamentos**: cron job `payments.reconcile-asaas` (a implementar — TODO MVP+1) compara payments locais vs Asaas balance
4. **Atualizar status page**: marcar `payments` como `operational`

## Prevenção

- Setar alertas Sentry para erro rate > 5% em `api/v1/payments/*` (5min window)
- Webhook deduplication via `idempotency_key` (já implementado)
- Circuit breaker em chamadas Asaas (TODO se virar problema recorrente)
- Subconta de backup em provider alternativo (Stripe Connect) — Fase 7

## Contatos

- Asaas suporte comercial (BaaS): contato pelo dashboard
- Asaas Status: <https://status.asaas.com>
- Asaas Docs: <https://docs.asaas.com>
