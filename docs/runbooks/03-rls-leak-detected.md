# Runbook 03 — RLS vazamento cross-tenant detectado

**Severidade:** P0 — máxima
**MTTR alvo:** <30min (mitigação) + post-mortem obrigatório

## Sintoma

- Org A reportou ver dados de Org B
- Suite `multi-tenant-isolation.spec.ts` falha em CI (após merge para main)
- Sentry alerta com query retornando dados de org_id diferente do esperado
- Auditoria detecta `audit_logs.actor_user_id` lendo paciente de org onde não tem membership ativa

## Mitigação imediata (PM, ~10min)

**ATENÇÃO:** este é o pior incidente possível em SaaS de saúde. Vai à imprensa.

1. **Desligue tráfego imediatamente:**
   - Vercel Dashboard → erp-nutri-web → Settings → Pause deployments
   - Ou via GrowthBook: ativar feature flag `kill_switch_global` (S2b+)
2. **Notifique afetados** (LGPD art. 48 — 48h para ANPD):
   - Identifique orgs envolvidas via audit_logs
   - Email manual via Resend para org_owners
3. **Anote tudo:** screenshots, IDs, timestamps. Audit log é imutável (CFN) — preserve.
4. **Acione Sherlock review URGENTE:** consultor primário, depois reserva
5. **Em <24h:** notificação ANPD + DPO

## Investigação (Sherlock + Claude Code)

1. Identificar root cause:
   - PR mais recente em `*.policy.sql`, `*.rls.sql`, `withTenant.ts`
   - Query SQL `EXPLAIN` mostrando policy aplicada
   - Validar `current_setting('app.current_org')` retorna esperado
2. Suspeitos comuns:
   - `withTenant` wrapper esqueceu de aplicar `SET LOCAL` em alguma rota
   - Policy RLS escrita com lógica errada (OR onde deveria AND)
   - `FORCE ROW LEVEL SECURITY` desabilitado por migration acidental
   - `service_role` usado em Route Handler (deveria ser sempre `authenticated`)
3. Reproduzir em DB de teste:
   ```sql
   -- Como Org A user, tentar SELECT em Patient de Org B
   SET LOCAL app.current_org = 'orgA-uuid';
   SELECT * FROM patients WHERE organization_id = 'orgB-uuid'; -- DEVE retornar 0 rows
   ```

## Correção

1. Hotfix branch `hotfix/rls-leak-{date}`
2. PR para main com revisão Sherlock OBRIGATÓRIA
3. Suite `multi-tenant-isolation.spec.ts` ganha caso novo cobrindo o cenário
4. Semgrep custom rule `no-route-without-with-tenant` revisada
5. Deploy hotfix

## Causa raiz + Post-mortem

- [ ] Post-mortem blameless documentado em `docs/incidents/`
- [ ] ADR atualizado se decisão arquitetural mudou
- [ ] Comunicação pública (status page + email para todos clientes)
- [ ] LGPD: relatório de impacto enviado ANPD em 48h

## Prevenção

- Suite isolation no CI rodando em CADA PR (gate obrigatório, branch protection garante)
- Semgrep `no-tenant-leak` + `no-route-without-with-tenant` falhando em PRs
- Canário semanal em prod: cron job roda subset isolation contra DB prod (ler-only)
- Sherlock review em TODO PR que toca paths sensíveis (`*payment*`, `*auth*`, `*.policy.sql`, `*.rls.sql`)
- Em S20+: WAF rule detectando padrões de SQLi
