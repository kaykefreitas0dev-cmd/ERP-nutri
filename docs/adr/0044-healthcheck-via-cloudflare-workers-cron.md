# ADR 0044 — Healthcheck via Cloudflare Workers Cron Trigger

**Status:** Accepted
**Date:** 2026-05-16
**Sprint:** S2a

## Contexto

Supabase Free **pausa o DB após 7 dias sem queries reais** (write activity, não apenas reads). API hit que responde de cache HTTP não previne pausa.

Soluções consideradas:
1. **cron-job.org Free** — frágil (timeout 30s, conta pausa em 30 dias inativa)
2. **Vercel Cron** — Hobby permite 2 crons/dia frequência diária; sem grão fino
3. **GitHub Actions Scheduled** — sobrecarrega CI minutes; latência variável
4. **Cloudflare Workers Cron Trigger** — free, integrado à stack, confiável

## Decisão

**Cloudflare Workers Cron Trigger** — Worker dedicado `nutricore-health-keepalive`:

- Frequência: a cada **5 dias** às 06:00 UTC (= 03:00 BRT) — S2a default aprovado pelo PM
- Endpoint alvo: `/api/health/db` (v11.2 Diff B.6) — executa `UPDATE _keepalive` + `SELECT`
- Trigger: cron expression `0 6 */5 * *`
- Timeout: 15s (suficiente para healthcheck)
- Free tier: 100k requests/dia + cron triggers ilimitados em horários >5min

## Implementação

Arquivos:
- `cf-workers/health-keepalive/src/index.ts` — handler
- `cf-workers/health-keepalive/wrangler.toml` — config
- `cf-workers/health-keepalive/package.json`
- `cf-workers/health-keepalive/tsconfig.json`

Deploy:
```bash
cd cf-workers/health-keepalive
wrangler deploy --var HEALTH_URL:https://nutri.nutricore.app/api/health/db
```

Logs:
```bash
wrangler tail nutricore-health-keepalive
```

## Anti-pausa garantido por

1. **UPDATE write** em `_keepalive` (não apenas SELECT) — Supabase considera write activity
2. **Endpoint dedicado** sem cache HTTP (`Cache-Control: no-store`)
3. **5 dias** < 7 dias pausa Supabase (margem 2 dias de buffer)
4. **Sentry alert** se 2 keepalives consecutivos falharem (TODO S2b)

## Alternativas consideradas

- **Vercel Cron Pro** (S20+): após upgrade, manter ambos é redundância barata; ou migrar para Vercel Cron (frequência mínima por minuto).
- **cron-job.org**: rejected — frágil (v11.2 Diff 2.4)
- **GitHub Actions Scheduled**: rejected — CI minutes desperdiçados em healthcheck

## Validação

- Cron deve aparecer em Cloudflare Dashboard → Workers → `nutricore-health-keepalive` → Triggers
- Após 5 dias, Logs devem mostrar primeira execução com 200 + latency_ms
- `_keepalive.last_touched` no Postgres deve atualizar (`SELECT * FROM _keepalive;`)

## Runbook associado

- [01 — Supabase paused](../runbooks/01-supabase-paused.md)

## Consequências

**Positivas:**
- Custo R$0 (CF Workers free tier)
- Worker isolado da stack principal (down ≠ down geral)
- Logs centralizados Cloudflare (não polui Vercel/Sentry)
- Após S20, manter como redundância barata

**Negativas:**
- Mais um vendor (Cloudflare) — mas já está na stack para DNS+WAF
- Worker precisa ser deployado manualmente uma vez (`wrangler deploy`)
- HEALTH_URL hardcoded por env — se domínio mudar, redeploy worker
