# Runbook 13 — Rollback de Migration SQL

**Severidade:** P1 (apps quebrados após deploy de migration)
**MTTR alvo:** < 20min

## Sintoma

Após aplicar uma migration SQL nova:

- Apps retornando 500 em rotas que tocam DB
- Sentry com `Prisma error P2009: validation failed` ou `column X does not exist`
- Queries lentas (constraint adicionada sem CONCURRENTLY)
- Lock estourado: `canceling statement due to lock timeout`

## Pré-requisitos

⚠️ **Nem toda migration tem rollback trivial**. Categorias:

| Tipo                                | Rollback                                  | Complexidade    |
| ----------------------------------- | ----------------------------------------- | --------------- |
| ADD COLUMN nullable                 | DROP COLUMN                               | Trivial         |
| ADD INDEX                           | DROP INDEX                                | Trivial         |
| ADD CONSTRAINT NOT VALID            | DROP CONSTRAINT                           | Trivial         |
| ALTER policy RLS                    | Restore policy antiga (versionada em git) | Médio           |
| DROP COLUMN                         | **IRREVERSÍVEL sem backup**               | ⚠️ Catastrófico |
| Data migration (UPDATE em massa)    | **IRREVERSÍVEL sem snapshot**             | ⚠️ Catastrófico |
| Schema migration via Prisma db push | Sem rollback automatic                    | Médio           |

## Mitigação imediata (5 min)

### 1. CONFIRMAR que o problema é a migration (não outro deploy)

```bash
# Lista últimas mudanças no DB
git log --oneline -- packages/db/prisma/migrations/post-prisma/ | head -5

# Lista deploys Vercel das últimas 2h
cd apps/web
npx vercel ls --limit 10
```

Correlacionar timestamp do incidente com timestamp da migration.

### 2. Reverter o deploy do app (se mudança foi só de código)

Se a app foi deployada DEPOIS da migration e a migration está OK, mas o código quebrou:

```bash
cd apps/web
npx vercel rollback <previous-deployment-url>
```

→ Resolve em ~30s. **Não toca no DB.**

### 3. Se foi a migration que quebrou, executar rollback SQL

**Cenário A: ADD COLUMN/INDEX/CONSTRAINT** (reversível)

```sql
-- Exemplo: migration 026 adicionou coluna que código antigo não conhece
BEGIN;
  ALTER TABLE patients DROP COLUMN IF EXISTS new_field;
COMMIT;
```

**Cenário B: ALTER policy RLS quebrada**

```bash
# Git diff da migration ofensiva
git diff HEAD~1 -- packages/db/prisma/migrations/post-prisma/026_*.sql

# Aplicar a policy ANTIGA (versionada em git)
psql $DATABASE_URL -c "
  DROP POLICY IF EXISTS policy_nova ON tabela;
  -- cole aqui a versão antiga da policy do git history
  CREATE POLICY policy_antiga ON tabela ...;
"
```

**Cenário C: Data migration ruim (UPDATE em massa)**

Só dá rollback via:

1. **PITR (Point-in-Time Recovery)** — Supabase Pro tem; Free não tem
2. **Backup R2 do dia anterior** (cf-workers/backup-r2)
3. Aceitar a perda (raro mas pode acontecer)

### 4. Restaurar via PITR (Supabase Pro)

```bash
# Via Supabase Dashboard → Database → Backups → Point in Time Recovery
# Selecionar timestamp anterior à migration
# Confirma e aguarda ~5-10 min
```

⚠️ **PITR substitui o DB inteiro**, perde TUDO que veio depois do timestamp. Use só se cenário B+C juntos.

### 5. Restaurar via backup R2 (fallback Free tier)

```bash
# 1. Baixar último dump R2
node scripts/r2-download-latest.mjs > backup.sql.gz
gunzip backup.sql.gz

# 2. Restaurar em DB STAGING primeiro (nunca prod direto)
psql $STAGING_DATABASE_URL < backup.sql

# 3. Validar que app funciona
# 4. Se OK, considerar:
#    - Continuar com prod degradado + plano de re-aplicar migration corrigida
#    - OU restaurar prod (perde dados desde último backup — comunicar usuários)
```

## Investigação (10 min)

### Por que a migration quebrou?

```sql
-- Logs Postgres das últimas 2h
SELECT log_time, error_severity, message
FROM postgres_logs
WHERE log_time > now() - interval '2 hours'
  AND error_severity IN ('ERROR', 'FATAL')
ORDER BY log_time DESC
LIMIT 50;
```

```bash
# Sentry: erros que coincidem com o timestamp da migration
# Filtro: error.type:PrismaClientValidationError environment:production
```

### Lock contention

```sql
SELECT pid, age(now(), query_start) AS duration, state, query
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY duration DESC;
```

Se há queries com lock > 30s, kill com `SELECT pg_terminate_backend(pid);`

## Recuperação completa

1. **Postmortem**: documentar causa raiz em `docs/incidents/YYYY-MM-DD-migration-NNN.md`
2. **Migration corrigida**: criar nova migration (027) que aplica a mudança certa
3. **Testes**: rodar migration em STAGING antes
4. **Comunicação**: se usuários foram afetados, status page + email
5. **PostHog event**: `incident.migration_rollback`

## Prevenção

### Para nova migration SQL:

1. ✅ Aplicar PRIMEIRO em STAGING (clone do prod via PITR)
2. ✅ Adicionar coluna NULLABLE primeiro, backfill async, mudar pra NOT NULL DEPOIS
3. ✅ Adicionar INDEX com `CONCURRENTLY` para tabelas > 10k rows
4. ✅ Adicionar CONSTRAINT com `NOT VALID` + validar separadamente
5. ✅ ADR para mudanças DDL grandes (DROP COLUMN, ALTER TYPE)
6. ✅ Backup R2 fresh (< 1h) antes de migration risky
7. ❌ Nunca DROP COLUMN sem grace period de 1 deploy
8. ❌ Nunca rename de coluna direto — adicionar nova + sync + drop antiga (3 deploys)

### Para deploy:

1. ✅ Migration SQL → Deploy código novo (nessa ordem)
2. ✅ Código novo deve ser backward-compatible com schema antigo (transição)
3. ✅ Feature flag para releases arriscadas (PostHog)
4. ✅ Smoke test E2E após cada migration
