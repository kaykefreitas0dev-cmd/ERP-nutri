# ADR 0056 — Repo público para branch protection no free tier

**Status:** Accepted
**Date:** 2026-05-16
**Sprint:** S1

## Contexto

Branch protection (e Rulesets, alternativa moderna) em repos **privados** no GitHub exige plano **Pro ($4/mês)** ou superior. No MVP, o plano v11 estabelece custo recorrente **R$0/mês até S20** (ADR 0034).

Sem branch protection:

- Push direto na `main` possível (acidente ou má conduta)
- PR sem review pode mergear
- Force push pode reescrever histórico
- CI checks podem ser bypass

Esses riscos são incompatíveis com o modelo operacional **Claude Code agêntico + PM validador** (ADR 0033) — onde Claude Code abre muitos PRs e PM precisa de gates automatizados para garantir qualidade sem revisar linha-a-linha.

## Decisão

**Tornar o repo `kaykefreitas0dev-cmd/ERP-nutri` público** durante o MVP (S1-S19), habilitando branch protection + Rulesets gratuitos.

Em S20 (upgrade Pro de Vercel + Supabase), avaliar:

- Manter público (open source) — boa para SEO da marca, comunidade
- Migrar para privado + GitHub Pro ($4/mês)

## Mitigações de risco para repo público

### Segredos

- `.gitignore` cobre `.env*`, `.env.local`, `secrets/`, `*.key`, etc.
- **gitleaks** em pre-commit hook + CI (já configurado, S1)
- Variáveis sensíveis SEMPRE em Vercel/GitHub secrets, nunca commitadas
- Master key envelope encryption em Supabase Vault, nunca local

### Propriedade intelectual

- Plano de produto + locks + ADRs ficam no repo (transparência aceitada)
- Código de domínio (algoritmos de cálculo nutricional, lógica de gamificação, anti-cheat heuristics) também público
- Diferencial competitivo NUNCA foi "código secreto" — é: UX + execução + relacionamento com nutricionistas + compliance/Sherlock review + dados de TACO/POF acumulados
- Concorrentes podem ler o plano mas executar é outra história

### Compliance LGPD

- Repo NÃO contém PHI (nenhum dado de paciente real)
- Anonymization keys (`ANON_SALT`, `ANON_HMAC_KEY`) ficam em Supabase Vault (S2a) — nunca repo
- DPIA documenta isso explicitamente

## Branch Protection aplicada (após repo público)

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["validate", "sherlock-required"]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": 1,
    "dismiss_stale_reviews": true
  },
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_linear_history": true,
  "required_conversation_resolution": true
}
```

`enforce_admins=true` confirmado pelo PM — máxima segurança. Em emergência, PM desabilita temporariamente via UI GitHub.

## Consequências

**Positivas:**

- Branch protection ativa desde S1 (não em S20).
- Custo recorrente mantido em R$0/mês.
- Marketing: repo público = sinal de transparência para early adopters.
- Comunidade open source pode contribuir (futura Fase 7).

**Negativas:**

- Concorrentes podem inspecionar arquitetura (mitigado pelo argumento "execução > código").
- Exigência permanente de disciplina com segredos (mitigado por gitleaks + CI).
- Quando upgrade Pro chegar em S20, reavaliar se vale manter público (open source) ou migrar para privado.

## Reversibilidade

Trivial: `gh repo edit kaykefreitas0dev-cmd/ERP-nutri --visibility private` quando upgrade Pro for ativado em S20.

## Referências

- ADR 0033 — Operational model Claude Code + PM
- ADR 0034 — Free-tier-first architecture
- ADR 0042 — Sherlock review operacionalizado
