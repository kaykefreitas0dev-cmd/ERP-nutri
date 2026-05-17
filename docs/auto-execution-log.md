# Auto Execution Log — Modo Agêntico

> PM autorizou execução autônoma. Este arquivo documenta tudo que foi feito,
> decisões tomadas com defaults, e bloqueios encontrados.

## Sessão atual — 2026-05-17

### Início autônomo: PR #2 commit `4d06550`

PM autorizou trabalhar sem confirmações intermediárias até bloqueio natural.

### Defaults aprovados automaticamente (PM pode revogar a qualquer momento)

| Decisão | Default escolhido | Justificativa | Reverter em |
|---|---|---|---|
| Paleta brand | `teal-700` primário | Já no /login + comum em saúde/nutrição | `tailwind.config` |
| Domínio placeholder | `nutricore.app` (assumido) | PM ainda não comprou — uso como string mock | `apps/*/vercel.json` + env |
| Email suporte | `suporte@nutricore.app` | Domínio placeholder | env `SUPPORT_EMAIL` |
| Onboarding wizard storage | Tabela DB (`OnboardingProgress`) | v11.2 Diff C.2 — sobrevive sessão | schema.prisma |
| CSP enforce | Report-only por 2 sprints | Plano v11 | middleware.ts |
| Status page provedores | Ocultos via `public_label` | v11.2 Diff B.8 | seed service_health |
| Lint max-warnings packages internos | 100 | Permite progresso enquanto refactor | package.json scripts |
| ESLint globals | node + browser em todos | Simplificação MVP | base.js |
| pricing toggle anual default | 17% desconto (2 meses grátis) | Padrão SaaS | Marketing UI |

### Bloqueios conhecidos (não-bloqueantes mas pendentes PM)

| Item | Sprint impactada | Workaround |
|---|---|---|
| Domínio não comprado | S2b (marketing OG, status URL) | Use `erp-nutri-*.vercel.app` |
| Cloudflare R2 não configurado | S2a (backup-db.yml falha silenciosa) | Workflow continue-on-error |
| AWS SES sandbox | S2b (/contato fallback) | Resend primário, SES quando aprovar |
| Meta WhatsApp não aprovado | S12b/S13 | Stub adapter até aprovação |
| Sherlock consultor | S2a-S5 (review paths sensíveis) | PRs com `@needs-sherlock-review` tag |
| MEI/Asaas BaaS | S14 | Modo EXTERNAL_RECORDED até KYC |
| Cloudflare Worker deploy | S2a (healthcheck) | URL alvo aponta para Vercel diretamente |

### Sprints concluídas em modo agêntico

| Sprint | PR | Status |
|---|---|---|
| S2a (Auth + RBAC + Tenant + Audit + Healthcheck) | #2 | aguarda merge PM |

### Sprints em progresso

- **S2b** (em planejamento) — Design System + Marketing + Onboarding

### Filosofia das decisões

- **Reversibilidade > Otimização** — toda decisão default deve ter rollback trivial
- **Lock no schema antes do código** — mudanças DB exigem revisão PM
- **Sherlock-paths em PRs separados** — `*payment*`, `*auth*`, `*.rls.sql`, `*.policy.sql`
- **Nunca tocar em**: credenciais, billing, prod sem feature flag, Meta/AWS prod

### Como ler este log

Cada nova sprint adiciona uma seção `### S<NUM> — <data>` com:
- Entregas (lista de commits/PRs)
- Decisões automatizadas
- Bloqueios encontrados
- Estado final
