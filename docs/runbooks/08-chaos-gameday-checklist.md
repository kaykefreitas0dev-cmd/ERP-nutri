# Runbook 08 — Chaos Gameday checklist (S19)

## Quando rodar

- Mensal em prod (após GA)
- Pre-S21 (antes do beta UX)
- Após qualquer mudança grande em infra (upgrade Pro, troca de provider)

## Setup

1. Avise o time 24h antes
2. Crie issue tracking com timestamps de cada cenário
3. Page-on-call em standby
4. Tenha o status page (/status no marketing) aberto

## Cenários (rodar 1 por vez, observar 15 min depois)

### Cenário 1 — Supabase pausa silenciosa

**Trigger**: Supabase Dashboard → Project Settings → Pause Project (Free
tier). Em dev local: parar o pg client docker.

**Expectativa**:

- `/api/health/db` retorna 503 em <10s
- Cloudflare Worker cron detecta + alerta (logs)
- App mostra fallback gracioso (não white screen)
- Operação volta automaticamente ao re-ativar

**Mitigação testada**: Runbook 01-supabase-paused.md

**Métricas pra coletar**: MTTR detecção, tempo até apps recuperarem
após re-ativação.

---

### Cenário 2 — Email provider (Resend) down

**Trigger**: trocar `RESEND_API_KEY` pra string inválida em env Vercel
(env override no preview deploy).

**Expectativa**:

- `sendPatientInviteEmail` retorna `{ ok: false }`, NÃO crash
- UI mostra "Link gerado (sem provider configurado — envie manualmente)"
- Link manual fica disponível pra copy/paste
- Nenhum 500 no Server Action

**Mitigação testada**: Runbook 05-resend-down.md

---

### Cenário 3 — Cross-tenant leak (simulação)

**Trigger**: drop temporário de policy de RLS em tabela `patients`:

```sql
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
```

**Expectativa**:

- Isolation suite (multi-tenant-isolation.spec.ts) deve **falhar** em <30s
- CI bloqueia merge
- Em prod: PostHog event `cross_tenant_warning` deve disparar (após
  implementar telemetry — TODO S22)

**Reverter imediatamente**:

```sql
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;
```

**Mitigação testada**: Runbook 03-rls-leak-detected.md +
06-rls-migration-emergency.md

---

### Cenário 4 — Worker travado (futuro Asaas)

**Trigger**: simular HTTP 5xx no webhook handler de Asaas (ainda não
implementado — S22). Atualmente N/A.

**Expectativa**: QStash retry com exponential backoff, DLQ após N
tentativas, alerta em Sentry quando DLQ > 0.

---

### Cenário 5 — Pico de carga (5x normal)

**Trigger**: rodar 100 requests/seg contra `/api/v1/patients` via wrk:

```bash
wrk -t4 -c50 -d30s -H "Cookie: sb-access-token=..." \
  http://localhost:3000/api/v1/patients
```

**Expectativa**:

- p99 < 1s
- Rate limit do Upstash deve kick em se > N req/s/IP (próxima iteração)
- 0 erros 5xx (apenas 429 se rate limit hit)

**Atual**: rate limit não implementado. TODO Sprint pós-S19.

---

### Cenário 6 — Backup integrity

**Trigger**: pegar último ZIP de backup do R2 + restore num DB efêmero +
verificar count de tabelas/rows.

**Expectativa**:

- Backup mais recente é restaurável
- Counts batem com prod (±10% pra entries de teste)
- RLS policies sobrevivem o restore

**Atual**: workflow GitHub Actions `backup-db.yml` está agendado mas
restore test ainda não automatizado. TODO Sprint pós-S19.

---

### Cenário 7 — Vercel deploy rollback

**Trigger**: deploy intencionalmente quebrado pra prod (ex: env var
errada que faz build passar mas runtime crash).

**Expectativa**:

- Vercel detecta após smoke check pós-deploy
- Rollback manual via `vercel rollback` em <2 min
- Health endpoint volta a OK
- Audit log da intervenção registrado

---

### Cenário 8 — Storage bucket privado vaza public

**Trigger**: alterar `storage.buckets.public = true` no bucket
`clinical-documents`.

**Expectativa**:

- Audit alerta para mudança (TODO: trigger SQL em storage.buckets)
- PDFs ISSUED não devem ser acessíveis via URL direta (signed URL apenas)

**Reverter**:

```sql
UPDATE storage.buckets SET public = false WHERE id = 'clinical-documents';
```

---

## Pós-gameday

1. Atualize runbooks que precisaram de tweaks
2. Crie issues pra gaps encontrados
3. Atualize MTTR alvo no SLO doc
4. Considere automatizar cenários como CI gates (ex: cenário 3 já é
   coberto pela isolation suite)
