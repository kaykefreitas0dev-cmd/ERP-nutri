# ADR 0043 — DB backup via GitHub Actions Scheduled + Cloudflare R2

**Status:** Accepted
**Date:** 2026-05-16
**Sprint:** S2a

## Contexto

Supabase Free não inclui PITR (Point-In-Time Recovery). Backups automáticos apenas diários, sem janela de restauração granular. Para SaaS de saúde com LGPD + CFN 599/2018, RPO ≤24h é mínimo aceitável durante o MVP.

ADR 0034 (free-tier-first) proíbe upgrade Supabase Pro até S20.

Vercel Functions têm timeout 10s no Hobby, 60s no Pro — `pg_dump` em DB médio leva 30-90s, não cabe.

## Decisão

Backup via **GitHub Actions Scheduled workflow** (`backup-db.yml`):

- Frequência: **diária** às 06:00 UTC = 03:00 BRT (S2a default aprovado pelo PM)
- Comando: `pg_dump --schema=public --schema=auth --no-owner`
  - **SEM** `--no-acl` (preserva RLS policies — corrige v11.2 Diff 2.9)
  - Inclui schema `auth` para preservar `auth.users` + `auth.identities` (Lock 13)
- Compressão: `gzip`
- Destino: **Cloudflare R2** (free 10GB, S3-compatible)
- Bucket: `nutricore-backups/daily/`
- Retenção: 30 dias daily / 12 semanas weekly / 12 meses monthly (via `cleanup-backups.yml`)

Após S20 (Supabase Pro com PITR ativo), workflow é tier-aware:
- `vars.SUPABASE_TIER=pro` → backup apenas aos domingos (redundância semanal)
- Backup local R2 vira complemento, não primário

## Alternativas consideradas

- **pg_dump via Vercel Function**: timeout 10/60s não cabe. Rejected.
- **Worker Fly.io rodando cron**: extra-cost (Fly free só tem 3 VMs limitadas). Rejected.
- **Supabase Pro com PITR** (US$25/mês): viola ADR 0034. Postponed para S20.
- **Backblaze B2** como destino: equivalente ao R2 free, mas R2 já está em uso (status page assets). Single-vendor preferido por agora.

## Implementação

Arquivo: `.github/workflows/backup-db.yml`

Secrets necessários no GitHub:
- `SUPABASE_DB_HOST` — `db.YOUR-REF.supabase.co`
- `SUPABASE_DB_PASSWORD` — senha do user `postgres`
- `R2_ACCESS_KEY` — token R2 com permissão write
- `R2_SECRET_KEY` — secret R2
- `R2_ACCOUNT_ID` — Cloudflare account ID

Variables (não-secret):
- `SUPABASE_TIER` — `free` (default) ou `pro` (após S20)

## Restore (Runbook 02)

```bash
# 1. Download último backup de R2
aws s3 cp s3://nutricore-backups/daily/backup-LATEST.sql.gz . \
  --endpoint-url https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com

# 2. Restore em DB target (Neon, Supabase novo, etc.)
gunzip backup-*.sql.gz
psql $TARGET_DATABASE_URL -f backup-*.sql

# 3. Aplicar SQL post-prisma (RLS policies, triggers, etc.)
for f in packages/db/prisma/migrations/post-prisma/*.sql; do
  psql $TARGET_DATABASE_URL -f $f
done
```

## Validação

- Workflow `backup-db.yml` roda diariamente; primeira execução em 17/05/2026
- Cron `cleanup-backups.yml` roda domingos
- Restore test weekly automático (TODO S2a-fim) valida integridade

## Consequências

**Positivas:**
- RPO ~24h (vs ∞ no Free sem backup próprio)
- Custo R$0 (R2 + GitHub Actions free tier suficientes)
- Migration-friendly: backup serve para restore em qualquer Postgres-compat

**Negativas:**
- RPO 24h > Pro PITR (~5min)
- Backup roda em CI (consome GitHub Actions minutes — mas dentro do free tier)
- Senha Supabase em GitHub secret (rotação manual em S20+)

## Referências
- v11.2 Diff B.2 (sem `--no-acl`)
- v11.2 Diff 2.9 (PITR + tier-aware)
- ADR 0034 — Free-tier-first
- Runbook 02 — Supabase down (restore process)
