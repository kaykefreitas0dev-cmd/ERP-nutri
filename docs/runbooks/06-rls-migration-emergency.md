# Runbook 06 — Bug crítico em RLS policy (infinite recursion, syntax error, leak)

## Sintomas

- `infinite recursion detected in policy for relation "X"` em logs Prisma/Postgres
- `invalid input syntax for type uuid: ""` em queries de tabela com RLS tenant
- Cross-tenant leak detectado em isolation suite (Org A vendo dados de Org B)
- App inteiro dando HTTP 500 em rotas autenticadas, mas auth/login funciona

## Causa raiz típica

1. **Recursion**: policy faz `EXISTS (SELECT ... FROM <mesma_tabela> ...)` —
   PG re-executa policy infinitamente
2. **Empty UUID cast**: `current_setting('app.current_org', true)::uuid` com
   GUC não setado retorna `''` → cast crash
3. **Policy faltando**: tabela nova com RLS enabled mas sem policy → 0 rows
   pra todos (incluindo super_admin)

## Mitigação imediata (DEV — local)

1. Identifique a policy ofensiva:
   ```sql
   SELECT policyname, qual
   FROM pg_policies
   WHERE tablename = 'X';
   ```
2. Crie migration `NNN_fix_<tabela>_rls.sql` com `DROP POLICY` + `CREATE POLICY` corrigida
3. Use helpers SECURITY DEFINER pra lookups recursivas (ex: `public.is_org_admin()`)
4. Use helper `public.current_org_id()` em vez de cast direto
5. Aplique migration via `node scripts/apply-NNN.cjs` no DB de dev
6. Re-rode isolation suite — deve passar

## Mitigação imediata (PROD)

⚠️ **NUNCA aplicar `DROP POLICY` direto em prod sem testar em staging**.

1. Reproduza em dev local primeiro com mesma migration aplicada
2. Rode isolation suite pra confirmar fix
3. Faça PR + merge via processo normal
4. Deploy em prod via Vercel (migration roda no boot)
5. **Monitore audit_logs por 30 min** procurando padrões cross-tenant

## Verificação pós-fix

```bash
# 1. Isolation suite (deve passar 8/9)
DATABASE_URL=... pnpm --filter @nutricore/db test

# 2. Manual sanity check via psql
SET ROLE authenticated;
SELECT set_config('app.current_org', '<org_id_real>', false);
SELECT COUNT(*) FROM patients;  -- deve retornar só da org

# 3. Tentar sem set_config — deve retornar 0
SET ROLE authenticated;
SELECT COUNT(*) FROM patients;  -- deve ser 0, NÃO crash
```

## Helpers padrão (use SEMPRE em policies novas)

| Helper                      | Uso                                                         |
| --------------------------- | ----------------------------------------------------------- |
| `public.current_org_id()`   | Em vez de `current_setting('app.current_org', true)::uuid`  |
| `public.current_user_id()`  | Em vez de `current_setting('app.current_user', true)::uuid` |
| `public.is_org_admin(uuid)` | Em vez de `EXISTS (SELECT FROM memberships ...)`            |
| `public.is_super_admin()`   | Bypass total (backoffice)                                   |
| `auth.uid()`                | User ID nativo do Supabase JWT (auth tables only)           |

## Padrão de policy correta

```sql
CREATE POLICY my_policy ON my_table
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.is_org_admin(organization_id)
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public.is_org_admin(organization_id)
  );
```

## Lições aprendidas

- **Sempre rodar isolation suite contra DB real** antes de merge de migration de RLS
- Helpers SECURITY DEFINER **devem** ter `SET search_path = public, pg_catalog` pra evitar search_path injection
- Policies que precisam EXISTS em própria tabela → SEMPRE via SECURITY DEFINER helper
