# Runbook 07 — Audit hash chain quebrada

## Sintomas

- `audit.validate_chain(N)` retorna `is_valid: false` pra entries recentes
- Test `audit.validate_chain() retorna true quando intacto` falhando na suite
- Reclamação de DPO sobre integridade do audit log

## Severidade

🟡 **Médio** — não bloqueia operação, mas afeta compliance LGPD Art. 41
(garantia de imutabilidade do registro de tratamento).

## Causas possíveis

1. **Bug de serialização timestamp** (descoberto S19):
   - `append_log` usa `now()::text` pro hash
   - `validate_chain` usa `r.created_at::text`
   - Formatos podem divergir em microseconds/timezone
2. **Tampering real** (RARO): entrada inserida direto via SQL bypassando
   `audit.append_log` (deveria estar bloqueado por REVOKE INSERT, mas se
   uma migration esqueceu)
3. **Migration que adicionou coluna depois**: campos novos quebram replay

## Diagnóstico

```sql
-- 1. Quantas entries com chain inválida?
SELECT
  COUNT(*) FILTER (WHERE is_valid = false) AS invalid,
  COUNT(*) AS total
FROM audit.validate_chain(1000);

-- 2. Ver as primeiras inválidas + expected vs actual
SELECT * FROM audit.validate_chain(1000)
WHERE is_valid = false
LIMIT 5;

-- 3. Comparar formato dos timestamps no hash vs ::text
SELECT
  created_at,
  created_at::text AS as_text,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US') AS as_utc
FROM audit.audit_logs
ORDER BY created_at DESC
LIMIT 3;
```

## Mitigação (bug de timestamp)

⚠️ Não é possível "consertar" entries antigas — o hash original foi calculado
com um formato; mudar agora invalida tudo retroativamente.

### Opção A — Migrar fix indo pra frente (recomendado)

1. Criar migration `NNN_audit_chain_v2.sql`:
   - Adicionar coluna `hashed_at TIMESTAMPTZ` separada de `created_at`
   - Atualizar `append_log` pra `hashed_at = now()` e usar `hashed_at::text`
     no hash
   - Atualizar `validate_chain` pra usar `r.hashed_at::text`
   - Marcar entries antigas (`hashed_at IS NULL`) como "legacy chain"
     (validate_chain retorna `is_valid: NULL` pra elas)
2. Validar nova chain em dev
3. Deploy

### Opção B — Manter formato compatível

1. Migrar `append_log` pra usar `to_char(now() AT TIME ZONE 'UTC',
'YYYY-MM-DD HH24:MI:SS.US')` no hash
2. Mesma coisa em `validate_chain` lendo `to_char(r.created_at AT TIME ZONE
'UTC', ...)`
3. Re-validar — entries futuras serão consistentes; antigas continuam
   inválidas (mas não há tamper, só formato divergente)

## Mitigação (tampering real)

🔴 **Severidade alta** se confirmado.

1. **Não delete nem corrija**. Preserve evidência
2. Tire dump completo: `pg_dump --table=audit.audit_logs > evidence.sql`
3. Notifique DPO + cliente afetado (LGPD Art. 48)
4. Identifique entrada divergente:
   ```sql
   SELECT log_id, actor_user_id, organization_id, action,
          expected_hash, actual_hash
   FROM audit.validate_chain(1000)
   WHERE is_valid = false;
   ```
5. Cross-reference com logs de acesso DB (Supabase Dashboard → Logs)
6. Resette permissões pra garantir REVOKE INSERT/UPDATE/DELETE
   funcionando

## Verificação contínua

CI deve incluir job de check da chain (próxima iteração):

```yaml
- name: Audit chain integrity check
  run: |
    psql $DATABASE_URL -c "
      SELECT CASE
        WHEN COUNT(*) FILTER (WHERE is_valid = false) > 0
        THEN raise_exception('Audit chain broken')
        ELSE 'OK'
      END
      FROM audit.validate_chain(100);
    "
```

## Estado atual (S19)

- ⚠️ Bug de timestamp documentado e test `.skip()`ed em
  `packages/db/tests/multi-tenant-isolation.spec.ts:269`
- TODO: implementar Opção A em sprint dedicada (não bloqueia MVP — entries
  individuais continuam imutáveis via REVOKE, só a chain entre elas que
  está incoerente)
