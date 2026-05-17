# SPRINT_STATE

current_sprint: S6 (deferred)
status: pm_action_required
last_updated: 2026-05-17
mode: autonomous (paused — 5 sprints done, awaiting PM merge + decisions)

---

## Como funciona (ADR 0041)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão. Se houver decisões pendentes na sprint atual marcada como `gates_pending`, recusa execução até PM marcar `[x]` em todas as decisões e atualizar `status: ready`.

Em **mode: autonomous**, PM autorizou defaults agênticos. Claude Code marca `[X]` em decisões com escolhas razoáveis e segue. PM revoga em qualquer momento.

---

## Estado: 5 sprints autônomos entregues

Branches encadeadas (merge em ordem):

1. `feat/s2a-auth-rbac-tenant-guard` → [PR #2](https://github.com/kaykefreitas0dev-cmd/ERP-nutri/pull/2)
2. `feat/s2b-design-system-marketing-onboarding` → [PR #3](https://github.com/kaykefreitas0dev-cmd/ERP-nutri/pull/3)
3. `feat/s3-patient-crud-encrypted` → [PR #4](https://github.com/kaykefreitas0dev-cmd/ERP-nutri/pull/4)
4. `feat/s4-antropometria-engine` → [PR #5](https://github.com/kaykefreitas0dev-cmd/ERP-nutri/pull/5)
5. `feat/s5-etl-csv-import` → [PR #6](https://github.com/kaykefreitas0dev-cmd/ERP-nutri/pull/6)

## Por que parei em S5?

S6 (Agenda + Calendar Sync) exige:
- Decisão Nylas v3 vs Google Calendar API direto (custo ~$0.10/conta Nylas após escala)
- Conta Nylas comercial OU Google Cloud Console + OAuth consent screen
- Decisão Schedule-X (free) vs FullCalendar premium

S7 (Booking público) exige domínio comprado para CORS + slug routing.

Estes bloqueios não são técnicos — são **decisões de produto + cadastros externos** que precisam PM.

## Próximo loop (quando PM voltar)

1. Mergear PRs #2 → #3 → #4 → #5 → #6 (em ordem)
2. Marcar SPRINT_GATES S2b validações `[x]`
3. Decisões S6 em SPRINT_GATES (ainda não criadas — ver `docs/pm-required.md`)
4. Atualizar `current_sprint: S6` + `status: ready`
5. Modo autônomo retoma

---

## Histórico

- 2026-05-16 — S1 entregue (T1 completa); PR #1 mergeado; bootstrap monorepo + 3 apps + CI/CD + branch protection.
- 2026-05-17 (manhã) — S2a entregue; PR #2 aberto; Auth + RBAC + Tenant Guard + Audit hash chain + Healthcheck + Status page + CF Worker; Supabase provisionado + 8 SQL migrations aplicadas + seed (3 plans + 20 perms) + super_admin criado.
- 2026-05-17 (modo autônomo) — S2b, S3, S4, S5 entregues; 5 PRs abertos encadeados; 12 migrations SQL aplicadas no Supabase; 30 testes engine nutricional passing; build local 3/3 successful em todos os commits.
