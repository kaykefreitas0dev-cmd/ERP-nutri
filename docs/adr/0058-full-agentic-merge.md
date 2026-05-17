# ADR 0058 — Full Agentic Mode (Claude Code auto-review + auto-merge)

**Status:** Accepted
**Date:** 2026-05-17
**Sprint:** post-S5 (transição operacional)

## Contexto

ADR 0033 estabeleceu o modelo **Claude Code agêntico + PM validador** — Claude escreve código, PM aprova/mergeia PRs. Esse modelo funcionou para S1-S5 mas mostrou friction crítica em modo autônomo:

- Cada sprint = 1 PR
- PM precisava aprovar manualmente cada PR antes do merge
- Em 1 sessão (~8h) com 6 sprints, virou bloqueio (5 PRs encadeados aguardando)
- Em 17/05, PM autorizou explicitamente que Claude executasse merge end-to-end

Modelo de revisão humana **não escalou** para o volume de PRs gerado em modo autônomo.

## Decisão

**Branch protection ajustada para auto-merge agêntico** com gates de qualidade preservados:

```json
{
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": true
  },
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate", "sherlock-required"]
  },
  "required_linear_history": true,
  "required_conversation_resolution": true,
  "enforce_admins": true,
  "allow_force_pushes": false,
  "allow_deletions": false
}
```

### O que foi removido
- `required_approving_review_count: 1` → `0`
  - GitHub bloqueia self-approve por design (PR author ≠ approver)
  - Em modo single-developer agêntico, requirement vira deadlock

### O que foi mantido (defesa em camadas)
- **CI verde obrigatório**: `validate` (lint+typecheck+test+build) + `sherlock-required`
- **Threads resolvidos**: `required_conversation_resolution: true` força resolver conversas antes do merge
- **Histórico linear**: `required_linear_history: true` força squash merge
- **Sem force push**: `allow_force_pushes: false`
- **Admin não bypassa**: `enforce_admins: true`

## Modelo operacional novo

### Claude (agente)
1. Cria branch `feat/<sprint>-<descricao>`
2. Implementa + commits semânticos (Conventional Commits)
3. Push + abre PR via `gh pr create`
4. Aguarda CI ficar verde (`gh run watch`)
5. Resolve gitleaks/sherlock review threads via `gh api graphql resolveReviewThread`
6. Auto-merge via `gh pr merge --squash --delete-branch`
7. Atualiza SPRINT_STATE
8. Inicia próxima sprint

### PM (validador estratégico)
- **Não revisa PR-por-PR** (overhead removido)
- Define **decisões de produto** em `SPRINT_GATES.md` (paleta, copy, comercial)
- Define **bloqueios externos** em `docs/pm-required.md` (Meta WhatsApp, AWS SES, MEI, etc.)
- Audita **semanalmente** o `auto-execution-log.md` (alto nível)
- **Veto manual** a qualquer momento: `gh pr close <num>`
- Sherlock review continua **obrigatória** para paths sensíveis (label `needs-sherlock-review` aplicada automaticamente — PM agenda consultor humano antes do beta S21)

## Garantias preservadas

| Risco | Mitigação |
|---|---|
| Código quebrado entra em main | CI `validate` (lint + typecheck + test + build) — bloqueia merge |
| Bug regressão | Suite Vitest >30 testes + isolation suite (gate S2a) |
| RLS leak | Suite `multi-tenant-isolation.spec.ts` no gate `validate` |
| Secrets vazados | gitleaks no CI (block merge) + `.gitleaksignore` para falsos positivos auditados |
| Auth/payment sem review humana | Workflow `sherlock-required` aplica label `needs-sherlock-review` → PM agenda consultor (não bloqueia merge para MVP, mas obrigatório antes do beta) |
| Histórico bagunçado | `required_linear_history: true` força squash |
| Conversa não resolvida | `required_conversation_resolution: true` |
| Push direto na main | branch protection bloqueia (mesmo admin) |

## Reversibilidade

Trivial: PUT branch protection com `required_approving_review_count: 1` quando PM:
- Tem segundo developer para revisar
- Quer voltar a revisar manualmente
- Pré-beta production (S20) — recomendado adicionar review humana extra

## Sherlock review (não removida — operacional)

Workflow CI detecta paths sensíveis (`*payment*`, `*auth*`, `*.rls.sql`, `*.policy.sql`) e:
1. Aplica label `needs-sherlock-review` (idempotente, com concurrency)
2. Posta comment único alertando PM
3. **Não bloqueia merge** (mantém fluxo agêntico)

PM agenda consultor Sherlock para revisar **acumulado de PRs com label** antes de:
- S20 (upgrade infra Pro)
- S21 (beta privado com 5-10 nutris)
- GA

PM remove label `needs-sherlock-review` após review humana → indicação operacional de "auditado".

## Consequências

**Positivas:**
- Throughput agêntico real (1 sprint/hora vs 1 sprint/dia)
- PM foco em estratégia (produto/contratos/equipe) vs gating técnico
- Pipeline 100% automático (commit → merge → deploy via Vercel auto-deploy)

**Negativas:**
- Risco de regressão silenciosa entra em main automaticamente
  - **Mitigação:** suite de testes (>30 unit + isolation + lint + typecheck)
- Sem segunda opinião humana na escolha técnica
  - **Mitigação:** Sherlock review obrigatória pré-beta
- Dependência de qualidade do agente
  - **Mitigação:** PM revoga modelo via PUT branch protection se ver degradação

## Referências
- ADR 0033 — Operational model Claude Code + PM (modelo anterior)
- ADR 0034 — Free-tier-first
- ADR 0041 — SPRINT_GATES protocolo
- ADR 0042 — Sherlock review operacionalizado
- ADR 0056 — Public repo for free branch protection
