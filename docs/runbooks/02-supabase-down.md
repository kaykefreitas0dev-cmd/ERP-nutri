# Runbook 02 — Supabase Postgres down (incidente Supabase)

**Severidade:** P1
**MTTR alvo:** depende do Supabase (típico 30min-2h)

## Sintoma

- Múltiplas regiões Supabase fora ([status.supabase.com](https://status.supabase.com))
- API retorna 500/503 em todos endpoints DB
- `/api/health/db` retorna 503
- PostHog mostra spike de erros em `db.*` events

## Mitigação imediata (PM, ~5min)

1. Confirme em [status.supabase.com](https://status.supabase.com) — é incidente Supabase ou só nosso projeto?
2. Atualize `/status` para refletir (S2b feature): banner "Estamos com problemas. Aguardando recuperação da infra cloud."
3. Considere ativar `read_only_mode` via GrowthBook (se feature flag existir em S2b+):
   - PostHog → Feature Flags → `read_only_mode` → enable
   - Usuários veem dados em cache (TanStack Query), mutations bloqueadas com toast claro

## Mitigação alternativa (se Supabase ficar down >2h)

Cenário catastrófico. Restaurar de backup R2 + servir em DB efêmero (Neon Free):

1. **Spinup DB temporário:**
   - Crie projeto Neon Free em [neon.tech](https://neon.tech) (sa-east-1 ou us-east-2)
   - Copy `DATABASE_URL` Neon
2. **Restore último backup R2:**
   - Cloudflare Dashboard → R2 → `nutricore-backups` → daily/ → último arquivo `backup-YYYYMMDD-HHMMSS.sql.gz`
   - Download
   - `gunzip backup-*.sql.gz`
   - `psql $NEON_DATABASE_URL -f backup-*.sql`
3. **Aplicar SQL post-prisma:**
   - `cd packages/db/prisma/migrations/post-prisma`
   - `for f in *.sql; do psql $NEON_DATABASE_URL -f $f; done`
4. **Vercel env update:**
   - Vercel Dashboard → erp-nutri-{web,patient,marketing} → Settings → Environment Variables
   - Substitua `DATABASE_URL` por `NEON_DATABASE_URL`
   - Redeploy via Vercel UI
5. Quando Supabase voltar: rollback (env vars + redeploy)

**Dados perdidos:** transações entre último backup R2 (até 24h) e início do incidente.

## Causa raiz

Sem ação possível — Supabase é responsabilidade deles. Post-mortem revisar:
- Tempo de detecção
- Tempo até página status atualizada
- Quanto dado foi perdido (RPO real)

## Prevenção

- [ ] Backup R2 diário (ADR 0043) — ativado em S2a
- [ ] Em S20, upgrade Supabase Pro com PITR (RPO ~5min vs 24h Free)
- [ ] Considerar Multi-cloud (AWS RDS + Supabase) em S20+ se SLO crítico
