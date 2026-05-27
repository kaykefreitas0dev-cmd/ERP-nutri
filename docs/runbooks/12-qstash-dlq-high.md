# Runbook 12 — QStash DLQ (Dead Letter Queue) Alta

**Severidade:** P2 (jobs falhando silenciosamente)
**MTTR alvo:** < 30min

## Sintoma

- Upstash Console → QStash → DLQ > 10 mensagens
- Sentry com erros recorrentes em `apps/web/src/app/api/internal/workers/*`
- Lembretes D-1 não chegando aos pacientes
- Webhook payments não sendo processados
- PostHog: `worker.failed` event spike

## Causa raiz comum

1. Bug em código de worker (deploy quebrado)
2. Dependência externa down (DB, Resend, Asaas)
3. Payload malformado (mudança de schema sem migration)
4. Timeout (Vercel Functions = 10s no Hobby)
5. Signature verification falhando (env var trocada)
6. Idempotency key conflict

## Mitigação imediata (5 min)

### 1. Identificar workers afetados

Upstash Console → QStash → DLQ:

- Group by `destination` URL
- Top 3 endpoints com mais falhas

### 2. Ler último erro de cada worker

Click numa msg DLQ → "Last error message":

- HTTP 401: signature verification → checar QSTASH_CURRENT_SIGNING_KEY
- HTTP 500: bug interno → ver Sentry
- HTTP 503: dependência down → ver runbook específico
- Timeout: payload muito grande ou query lenta

### 3. Decisão: replay ou descartar

**Replay** (se erro foi transient):

```bash
# Upstash CLI / API
curl -X POST "https://qstash.upstash.io/v2/dlq/$DLQ_ID/replay" \
  -H "Authorization: Bearer $QSTASH_TOKEN"
```

**Descartar** (se erro era de dados — não vai resolver com replay):

```bash
curl -X DELETE "https://qstash.upstash.io/v2/dlq/$DLQ_ID" \
  -H "Authorization: Bearer $QSTASH_TOKEN"
```

### 4. Bulk replay (se >50 mensagens do mesmo worker)

```bash
# Loop via script (TODO: criar scripts/qstash-replay-dlq.mjs)
for id in $(curl -s "https://qstash.upstash.io/v2/dlq?destination=/api/internal/workers/appointments/remind" \
  -H "Authorization: Bearer $QSTASH_TOKEN" | jq -r '.messages[].messageId'); do
  curl -X POST "https://qstash.upstash.io/v2/dlq/$id/replay" \
    -H "Authorization: Bearer $QSTASH_TOKEN"
  sleep 0.1
done
```

## Investigação por worker

### `appointments/remind`

```bash
# Sentry filter:
# project:apps-web environment:production tag:worker:appointments.remind
```

Causas comuns:

- Patient/Appointment deletado entre schedule e fire (race) → ignorar
- `RESEND_API_KEY` ausente ou inválido → checar Vercel env

### `payments/webhook-process` (S22+)

Causas comuns:

- Asaas signature mismatch → checar `ASAAS_WEBHOOK_SECRET`
- Database constraint violation (duplicate idempotency_key) → ignorar
- Asaas API down → ver runbook 10

### `notifications/send`

Causas comuns:

- Resend rate limit (3k/mês free) → upgrade ou queue back-pressure
- Email bounce hard → marcar usuário como `email_invalid`

## Mitigação prolongada

1. **Adicionar idempotency** em TODO worker handler (key = qstash message ID)
2. **Dead-man's switch**: alerta Sentry se DLQ > 0 por mais de 1 hora
3. **Worker timeout** aumentado para Vercel Pro (60s) — workers de PDF gen estão no limite
4. **Retry backoff** customizado: workers de email = 3 tentativas, webhook = 5

## Recuperação

```sql
-- Verificar se payload processado realmente
SELECT * FROM patient_payments WHERE id = '<id-da-msg-dlq>';
-- Se já existe, descartar DLQ (era idempotency)
-- Se não, replay
```

## Prevenção

- **Worker testing**: cada handler tem teste Vitest com payload mockado
- **Schema validation** com Zod no input de TODO worker
- **Sentry breadcrumbs** registrando cada etapa do worker
- **Circuit breaker** para chamadas externas (Asaas, Resend)
- **Replay tools**: scripts em `scripts/qstash-*.mjs` (a criar)
