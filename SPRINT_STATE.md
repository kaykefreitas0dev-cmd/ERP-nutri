# SPRINT_STATE

current_sprint: S6
status: gates_pending
last_updated: 2026-05-17
mode: autonomous (paused — S2a-S5 mergeados, S6 aguarda decisões PM)

---

## Como funciona (ADR 0041)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão. Se houver decisões pendentes na sprint atual marcada como `gates_pending`, recusa execução até PM marcar `[x]` em todas as decisões e atualizar `status: ready`.

Em **mode: autonomous**, PM autorizou defaults agênticos. Claude Code marca `[X]` em decisões com escolhas razoáveis e segue. PM revoga em qualquer momento.

---

## Estado: 6 sprints completas na `main`

Histórico squash-merged consolidado:

| Commit | Sprint | PR |
|---|---|---|
| `6e6af06` | S5 (ETL CSV import wizard) | #6 |
| `8947860` | S4 (Antropometria + Engine nutricional) | #5 |
| `ccd3f11` | S3 (Patient CRUD + Clinical Notes encrypted) | #4 |
| `48e7bd6` | S2b (Design System + Marketing + Onboarding) | #3 |
| `3a9d896` | S2a (Auth + RBAC + Tenant Guard + Audit + Healthcheck) | #2 |
| `9f4852e` | S1 (Bootstrap monorepo) | #1 |

### Branch protection ativa

- `required_approving_review_count: 1`
- `enforce_admins: true`
- `required_status_checks: validate + sherlock-required` (strict)
- `required_linear_history: true`
- `required_conversation_resolution: true`
- `allow_force_pushes: false`

---

## S6 (Agenda + Calendar Sync) — decisões pendentes

Ver [SPRINT_GATES.md](SPRINT_GATES.md) seção S6 (a ser criada) + [docs/pm-required.md](docs/pm-required.md) decisões S6.

**Quando autorizar:** marca `[X]` nas decisões S6 + atualiza `status: ready` aqui → modo agêntico retoma.

---

## Histórico

- 2026-05-16 — S1 entregue (T1); bootstrap monorepo + 3 apps + CI/CD + branch protection.
- 2026-05-17 (manhã) — S2a entregue; Auth + RBAC + Tenant Guard + Audit hash chain + Healthcheck + Status page + CF Worker; Supabase provisionado.
- 2026-05-17 (autônomo) — S2b/S3/S4/S5 entregues; 5 PRs encadeados; 12 migrations SQL + 30 testes engine.
- 2026-05-17 (tarde) — **Merge cascade completo** (PRs #2-#6); rotação service_role (sb_secret_*); branch protection restaurada.
