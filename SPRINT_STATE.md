# SPRINT_STATE

current_sprint: S6
status: ready
last_updated: 2026-05-17
mode: autonomous (full agentic — PM autorizou auto-merge, ADR 0058)

---

## Como funciona (ADR 0041 + ADR 0058)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão.

**ADR 0058 — Full Agentic Mode** (em vigor desde 2026-05-17):
- Claude implementa + commita + abre PR + aguarda CI verde + resolve threads + **auto-mergeia**
- PM foca em estratégia (decisões produto + bloqueios externos como Meta/AWS)
- Sherlock review continua obrigatória pré-beta (label `needs-sherlock-review` aplicada automaticamente)
- PM pode revogar a qualquer momento via PUT branch protection

---

## Estado atual

| Sprint | Commit | PR | Status |
|---|---|---|---|
| S5 (ETL CSV) | `6e6af06` | #6 | MERGED |
| S4 (Antropometria + Engine) | `8947860` | #5 | MERGED |
| S3 (Patient + Encrypted Notes) | `ccd3f11` | #4 | MERGED |
| S2b (Design + Marketing + Onboarding) | `48e7bd6` | #3 | MERGED |
| S2a (Auth + RBAC + Tenant + Audit) | `3a9d896` | #2 | MERGED |
| S1 (Bootstrap monorepo) | `9f4852e` | era #1 | MERGED |

### S6 em andamento (Agenda + Calendar Sync)

Defaults aprovados via modo agêntico em SPRINT_GATES.md:
- Calendar: Google Calendar API direto (zero custo recorrente)
- UI: Schedule-X (free MIT)
- Buffer time: 15min/15min, Min notice: 4h, Max advance: 60d
- Conflict: first-write-wins via Postgres EXCLUDE GiST
- Booking page: `/c/:slug` SEO público

### Branch protection (ADR 0058)
- `required_approving_review_count: 0` ← agentic auto-merge
- `required_status_checks: validate + sherlock-required` (strict)
- `required_linear_history: true`
- `required_conversation_resolution: true`
- `enforce_admins: true`
- `allow_force_pushes: false`

---

## Histórico

- 2026-05-16 — S1 entregue (bootstrap monorepo + 3 apps + CI/CD).
- 2026-05-17 (manhã) — S2a (Auth + RBAC + Tenant + Audit + Healthcheck + CF Worker).
- 2026-05-17 (autônomo) — S2b/S3/S4/S5 entregues.
- 2026-05-17 (tarde) — Merge cascade #2-#6; rotação service_role completa; branch protection restaurada.
- 2026-05-17 (transição) — **ADR 0058 Full Agentic Mode aprovado**. PR #7 cleanup mergeado. Branch protection ajustada para `review_count=0`. S6 iniciada com defaults.
