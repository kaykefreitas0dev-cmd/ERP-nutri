# Post-Prisma Migrations

SQL adicional aplicado **após** `prisma migrate deploy` (ou `prisma db push` em dev).

Esses arquivos cobrem o que o Prisma não modela diretamente:

- RLS policies (Row Level Security)
- Triggers + Functions PostgreSQL
- REVOKE/GRANT específicos
- Extensões (pgcrypto, btree_gist)
- Vault integration (Supabase Vault)

## Ordem de aplicação

| Ordem | Arquivo | Conteúdo | Sprint |
|---|---|---|---|
| 1 | `001_enable_rls.sql` | ENABLE + FORCE RLS + policies tenant isolation | S2a |
| 2 | `002_audit_log_chain.sql` | `audit.append_log()` SECURITY DEFINER + hash chain + REVOKE | S2a |
| 3 | `003_gist_exclusion_appointments.sql` | Placeholder (ativado em S7) | S2a → S7 |
| 4 | `004_pgcrypto_phi.sql` | `phi.encrypt_for_org` + Vault integration | S2a (PHI usado S3+) |
| 5 | `005_is_super_admin_helper.sql` | `auth.is_super_admin()`, `current_org_id()`, `current_user_id()` | S2a |
| 6 | `006_keepalive_table.sql` | Seed `_keepalive` + permissions service_health | S2a |
| 7 | `007_handle_new_user_trigger.sql` | Trigger `auth.users` → `public.users` | S2a |

## Como aplicar

Via Supabase CLI (após `supabase link --project-ref <ref>`):

```bash
# Aplica todos em ordem alfabética
supabase db push

# Ou manualmente um por um via SQL Editor:
cat 001_enable_rls.sql | supabase db execute
```

Via Prisma migrate (uma vez que DATABASE_URL aponta para Supabase):

```bash
pnpm exec prisma migrate deploy
# Depois aplicar os post-prisma manualmente via psql ou Supabase Studio
```

## Validação

Após aplicar, rodar suite de isolation:

```bash
pnpm --filter @nutricore/db exec vitest run tests/multi-tenant-isolation.spec.ts
```

Deve passar todos os 7+ cenários:
1. User1/Org A não vê dados de Org B (mesmo via SQL raw com claim forjado)
2. Tentar UPDATE em audit_logs → erro permission denied
3. Tentar DELETE em audit_logs → erro permission denied
4. `audit.append_log` cria entrada com hash encadeado corretamente
5. `audit.validate_chain()` retorna `is_valid=true` para todas as linhas
6. Healthcheck `/api/health/db` faz UPDATE+SELECT em `_keepalive` com sucesso
7. Sem `SET LOCAL app.current_org`, queries em tabelas tenant retornam 0 rows
