# SPRINT_STATE

current_sprint: S22
status: blocked_on_pm
last_updated: 2026-05-20
mode: autonomous (S22 aguarda PM: Asaas BaaS prod + convites beta S21)

---

## Como funciona (ADR 0041)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão. Se houver decisões pendentes na sprint atual marcada como `gates_pending`, recusa execução até PM marcar `[x]` em todas as decisões e atualizar `status: ready`.

Em **mode: autonomous**, PM autorizou defaults agênticos. Claude Code marca `[X]` em decisões com escolhas razoáveis e segue. PM revoga em qualquer momento.

---

## Histórico de PRs squash-merged (main)

| PR  | Commit    | Tema                                                                          |
| --- | --------- | ----------------------------------------------------------------------------- |
| #1  | `9f4852e` | S1 — Bootstrap Turborepo monorepo (3 apps Next.js + 9 packages)               |
| #2  | `3a9d896` | S2a — Auth + RBAC + Tenant Guard + Audit hash chain + Healthcheck + CF Worker |
| #3  | `48e7bd6` | S2b — Design System + Marketing + Onboarding Wizard                           |
| #4  | `ccd3f11` | S3 — Patient CRUD + Clinical Notes encrypted (envelope pgcrypto)              |
| #5  | `8947860` | S4 — Antropometria + Engine nutricional (Mifflin/Harris/FAO)                  |
| #6  | `6e6af06` | S5 — ETL CSV Import Wizard (QStash batches)                                   |
| #7  | `ecb76aa` | Post-merge cleanup + Sherlock concurrency fix                                 |
| #8  | `9c084c8` | ADR 0058 — Full agentic mode + S6 gates                                       |
| #9  | `b8ab996` | S6 — Agenda + Booking pública /c/:slug + GiST anti-overlap                    |
| #10 | `b817933` | S8/S9a — Food library + Receitas + Lock 15 food trigger                       |
| #11 | `ff1174f` | S10 — Meal plans editor + Lock 15 foodVersion snapshot                        |
| #12 | `b27d0bb` | S11 — Clinical documents + CID-10 + PDF signing (mock)                        |
| #13 | `3b02db8` | S12 — Invite-only patient onboarding + apps/patient bootstrap                 |
| #14 | `ab6188e` | S13 — Patient daily check-ins + streaks                                       |
| #15 | `9cfc2e8` | S15a — Patient payments (EXTERNAL_RECORDED) + recibo PDF automático           |
| #16 | `3530143` | S16 — Anonimização paciente (LGPD Art. 18) + archive                          |
| #17 | `b305291` | S17 — Patient data export ZIP (LGPD portabilidade)                            |
| #18 | `1f8b3f2` | Financial — Dashboard KPIs + /app/financeiro                                  |
| #19 | `00678dd` | Patient — Consultas + Pagamentos pages + 6-tab nav                            |
| #20 | `96703ad` | Email — Auto-send invite via Resend (fallback gracioso)                       |
| #21 | `5e5bb55` | Fix — redirect / → /login ou /app                                             |
| #22 | `845a60f` | Auth — Login email+senha fallback para magic link                             |
| #23 | `9c29b6a` | Fix — script strip BOM em .env.local                                          |
| #24 | `26adf19` | Fix — set_config() no lugar de SET LOCAL para app.current_user                |
| #25 | `f4689fc` | Test — Playwright E2E smoke + 3 bugs encontrados                              |
| #26 | `01ec77f` | Refactor — substituir emojis por lucide-react SVG icons                       |
| #27 | `d4e60c6` | Test — Spider E2E + extended patient smoke (14/14 verde)                      |
| #28 | `7fbab2b` | S18 — apps/admin backoffice (super_admin only)                                |
| #29 | `343bd3b` | UI — Design tokens centralizados em packages/ui                               |
| #30 | `362ed5b` | S19 — Hardening: 2 bugs RLS críticos + headers + runbooks + isolation suite   |
| #31 | `444b614` | S20 — Settings page + branding form + 2 landing personas + runbook upgrade    |
| #32 | `ac0a60e` | S21 — Beta prep: audit chain fix + welcome tour + portabilidade + NPS widget  |
| #33 | `3b621c4` | UI Phase 1 — Design system overhaul (tokens + fonts + dark mode + base)       |
| #34 | `b6b24af` | UI Phase 2 — Sidebar + topbar + command palette                               |
| #35 | `62e6c33` | UI Phase 3 — Dashboard polish + teal→brand sweep                              |
| #36 | `e379e7d` | UI Phase 4 — Patient list + detail redesign                                   |
| #37 | `7e540dd` | UI Phase 5 — Agenda + login + secondary pages polish                          |
| #38 | `800e6a7` | UI Phase 6 — Meal plan editor + patient PWA polish                            |
| #39 | `fca3850` | UI Phase 7 — Patient PWA finalization                                         |
| #40 | `21edff5` | Admin — NPS dashboard + close loop beta widget                                |
| #41 | `dc0ddc4` | Patient PWA — meu-plano + consultas pages polish                              |
| #42 | `4a08be0` | UI — Polish residual forms (anthropometry, meal-plans, documents)             |
| #43 | `aba46ff` | UI — Polish document detail + patient invite landing                          |
| #44 | `5e3be5a` | Fix — server→client icon prop serialization MetricCard/NavCard                |
| #45 | `6912a99` | Agenda — week calendar view com hourly time grid + overlap lanes              |
| #46 | `e4ce37d` | Meal plan — dnd-kit drag-and-drop reorder meals + items                       |
| #47 | (pending) | Dashboard — Sparkline trend charts em MetricCards                             |

---

## S22 — Estado atual

### Bloqueios PM (ação necessária antes de S22 avançar)

- [ ] **Asaas BaaS produção contratado** — conversa comercial iniciada em S15 (ADR 0039). S22 requer subconta real.
- [ ] **Convites beta S21** — lista de 5-10 nutricionistas enviada + Termos Beta assinados.
- [ ] **Vercel Pro + Supabase Pro upgrade** (S20) — deadline duro pré-produção. Ver runbook em `/docs/runbooks/`.

### Tech work disponível (não bloqueado)

- [ ] TanStack Table com virtualização para lista de pacientes (take:50 → cursor paginado)
- [ ] axe-core a11y automatizado em CI
- [ ] Lighthouse CI performance budgets formalizados
- [ ] Migration 023 aplicada (PM: Supabase Studio → `packages/db/prisma/migrations/post-prisma/023_s21_nps_feedback_rls.sql`)

---

## Branch protection ativa

- `required_approving_review_count: 1`
- `enforce_admins: true`
- `required_status_checks: validate + sherlock-required` (strict)
- `required_linear_history: true`
- `required_conversation_resolution: true`
- `allow_force_pushes: false`

---

## Histórico de datas

- 2026-05-16 — S1 entregue (T1)
- 2026-05-17 (manhã) — S2a entregue
- 2026-05-17 (autônomo) — S2b/S3/S4/S5 (PRs #2-#6) encadeados
- 2026-05-17 (tarde) — Merge cascade completo; rotação service_role
- 2026-05-18 — S6→S21 entregues (PRs #8-#32); 14 migrations; design system completo
- 2026-05-19 — UI Polish phases 1-7 (PRs #33-#43); Agenda week view; Meal plan dnd-kit; Dashboard sparklines
- 2026-05-20 — PR #44-#47 merged; SPRINT_STATE atualizado para S22
