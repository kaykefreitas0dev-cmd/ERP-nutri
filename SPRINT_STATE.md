# SPRINT_STATE

current_sprint: S22
status: blocked_on_pm
last_updated: 2026-05-20 (autônomo cont. — PRs #95-#98)
mode: autonomous (S22 aguarda PM: Asaas BaaS prod + convites beta S21)

---

## Como funciona (ADR 0041)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão. Se houver decisões pendentes na sprint atual marcada como `gates_pending`, recusa execução até PM marcar `[x]` em todas as decisões e atualizar `status: ready`.

Em **mode: autonomous**, PM autorizou defaults agênticos. Claude Code marca `[X]` em decisões com escolhas razoáveis e segue. PM revoga em qualquer momento.

---

## Histórico de PRs squash-merged (main)

| PR  | Commit    | Tema                                                                                                               |
| --- | --------- | ------------------------------------------------------------------------------------------------------------------ |
| #1  | `9f4852e` | S1 — Bootstrap Turborepo monorepo (3 apps Next.js + 9 packages)                                                    |
| #2  | `3a9d896` | S2a — Auth + RBAC + Tenant Guard + Audit hash chain + Healthcheck + CF Worker                                      |
| #3  | `48e7bd6` | S2b — Design System + Marketing + Onboarding Wizard                                                                |
| #4  | `ccd3f11` | S3 — Patient CRUD + Clinical Notes encrypted (envelope pgcrypto)                                                   |
| #5  | `8947860` | S4 — Antropometria + Engine nutricional (Mifflin/Harris/FAO)                                                       |
| #6  | `6e6af06` | S5 — ETL CSV Import Wizard (QStash batches)                                                                        |
| #7  | `ecb76aa` | Post-merge cleanup + Sherlock concurrency fix                                                                      |
| #8  | `9c084c8` | ADR 0058 — Full agentic mode + S6 gates                                                                            |
| #9  | `b8ab996` | S6 — Agenda + Booking pública /c/:slug + GiST anti-overlap                                                         |
| #10 | `b817933` | S8/S9a — Food library + Receitas + Lock 15 food trigger                                                            |
| #11 | `ff1174f` | S10 — Meal plans editor + Lock 15 foodVersion snapshot                                                             |
| #12 | `b27d0bb` | S11 — Clinical documents + CID-10 + PDF signing (mock)                                                             |
| #13 | `3b02db8` | S12 — Invite-only patient onboarding + apps/patient bootstrap                                                      |
| #14 | `ab6188e` | S13 — Patient daily check-ins + streaks                                                                            |
| #15 | `9cfc2e8` | S15a — Patient payments (EXTERNAL_RECORDED) + recibo PDF automático                                                |
| #16 | `3530143` | S16 — Anonimização paciente (LGPD Art. 18) + archive                                                               |
| #17 | `b305291` | S17 — Patient data export ZIP (LGPD portabilidade)                                                                 |
| #18 | `1f8b3f2` | Financial — Dashboard KPIs + /app/financeiro                                                                       |
| #19 | `00678dd` | Patient — Consultas + Pagamentos pages + 6-tab nav                                                                 |
| #20 | `96703ad` | Email — Auto-send invite via Resend (fallback gracioso)                                                            |
| #21 | `5e5bb55` | Fix — redirect / → /login ou /app                                                                                  |
| #22 | `845a60f` | Auth — Login email+senha fallback para magic link                                                                  |
| #23 | `9c29b6a` | Fix — script strip BOM em .env.local                                                                               |
| #24 | `26adf19` | Fix — set_config() no lugar de SET LOCAL para app.current_user                                                     |
| #25 | `f4689fc` | Test — Playwright E2E smoke + 3 bugs encontrados                                                                   |
| #26 | `01ec77f` | Refactor — substituir emojis por lucide-react SVG icons                                                            |
| #27 | `d4e60c6` | Test — Spider E2E + extended patient smoke (14/14 verde)                                                           |
| #28 | `7fbab2b` | S18 — apps/admin backoffice (super_admin only)                                                                     |
| #29 | `343bd3b` | UI — Design tokens centralizados em packages/ui                                                                    |
| #30 | `362ed5b` | S19 — Hardening: 2 bugs RLS críticos + headers + runbooks + isolation suite                                        |
| #31 | `444b614` | S20 — Settings page + branding form + 2 landing personas + runbook upgrade                                         |
| #32 | `ac0a60e` | S21 — Beta prep: audit chain fix + welcome tour + portabilidade + NPS widget                                       |
| #33 | `3b621c4` | UI Phase 1 — Design system overhaul (tokens + fonts + dark mode + base)                                            |
| #34 | `b6b24af` | UI Phase 2 — Sidebar + topbar + command palette                                                                    |
| #35 | `62e6c33` | UI Phase 3 — Dashboard polish + teal→brand sweep                                                                   |
| #36 | `e379e7d` | UI Phase 4 — Patient list + detail redesign                                                                        |
| #37 | `7e540dd` | UI Phase 5 — Agenda + login + secondary pages polish                                                               |
| #38 | `800e6a7` | UI Phase 6 — Meal plan editor + patient PWA polish                                                                 |
| #39 | `fca3850` | UI Phase 7 — Patient PWA finalization                                                                              |
| #40 | `21edff5` | Admin — NPS dashboard + close loop beta widget                                                                     |
| #41 | `dc0ddc4` | Patient PWA — meu-plano + consultas pages polish                                                                   |
| #42 | `4a08be0` | UI — Polish residual forms (anthropometry, meal-plans, documents)                                                  |
| #43 | `aba46ff` | UI — Polish document detail + patient invite landing                                                               |
| #44 | `5e3be5a` | Fix — server→client icon prop serialization MetricCard/NavCard                                                     |
| #45 | `6912a99` | Agenda — week calendar view com hourly time grid + overlap lanes                                                   |
| #46 | `e4ce37d` | Meal plan — dnd-kit drag-and-drop reorder meals + items                                                            |
| #47 | `85e93fc` | Dashboard — Sparkline trend charts em MetricCards                                                                  |
| #48 | `8d56383` | Patients — TanStack Table + Virtual, cursor pagination, instant search filter                                      |
| #49 | `a906662` | CI — axe-core a11y tests + Playwright workflow + Lighthouse budgets                                                |
| #50 | `9cc2b8b` | Agenda — edit appointment modal (date/time, duration, modality, notes)                                             |
| #51 | `1f7711f` | Chore — SPRINT_STATE.md updated (PRs #47-#50)                                                                      |
| #52 | `0dfab12` | Agenda — patient deep-link from patients list to scheduling form                                                   |
| #53 | `6dbf293` | Agenda — cancel appointment with optional reason + inline error banner                                             |
| #54 | `603b9ff` | Chore — SPRINT_STATE.md updated (PRs #51-#53)                                                                      |
| #55 | `f62d82e` | UX — replace alert()/confirm() in AnonymizeButton + MealPlanEditor                                                 |
| #56 | `7092c3c` | Agenda — generalize overlay to CANCEL + NO_SHOW with reason                                                        |
| #57 | `5abce62` | Fix — remove developer-facing copy from user-visible UI                                                            |
| #58 | `8a1bcdc` | Test — E2E agenda smoke: day view + create appointment + confirm button                                            |
| #59 | `b9c3556` | Agenda — per-status colored breakdown pills in day view header                                                     |
| #60 | `b5c4af4` | UX — replace confirm() in DocumentActions + InvitePatientButton (router.refresh)                                   |
| #61 | `8ca18cf` | A11y — Escape key closes appointment modals + aria attrs on CompleteModal                                          |
| #62 | `65ec0a2` | UI — replace remaining emojis with lucide-react icons (ClinicalNotes, NewMealPlanForm, DocumentActions)            |
| #63 | `5ea619c` | Chore — SPRINT_STATE.md updated (PRs #54-#61 + S22 tech progress)                                                  |
| #64 | `bfa66be` | Agenda — allow cancelling CONFIRMED appointments (UX gap fix)                                                      |
| #65 | `c5066ff` | CI — gitleaks continue-on-error (fix ambiguous range on update-branch)                                             |
| #66 | `c9ed16a` | Chore — SPRINT_STATE.md updated (PRs #60 + #62-#65)                                                                |
| #67 | `e4218f7` | Test — E2E smoke steps 11-13: SCHEDULED→CONFIRMED→CANCEL full lifecycle                                            |
| #68 | `005ff98` | Chore — SPRINT_STATE.md updated (PRs #67 + final S22 tech status)                                                  |
| #69 | `640d02b` | Patient PWA — upcoming appointments widget on home + plan status localization PT-BR                                |
| #70 | `8abadaa` | Agenda — email notifications on appointment scheduled/confirmed/cancelled via Resend                               |
| #71 | `3544e29` | Fix — ESLint warnings eliminados em apps/web (0 errors, 0 warnings)                                                |
| #72 | `f59afc8` | Agenda — email transacional reagendamento (rescheduled)                                                            |
| #73 | `25c0574` | Chore — SPRINT_STATE.md atualizado (PRs #68-#72 + deferral Vercel/Supabase Pro)                                    |
| #74 | `e0cf574` | Agenda — email transacional COMPLETED (checar docs/recibo/plano alimentar)                                         |
| #75 | `553340c` | Patient — notificação email ao nutri quando paciente aceita convite                                                |
| #76 | `f47b0e0` | Patient — polish: PLAN_STATUS_LABEL localizado, ChevronLeft back-link, Date cleanup                                |
| #77 | `2d01773` | Agenda — lembrete D-1 antes da consulta via QStash + worker /api/internal/remind                                   |
| #78 | `f6e3854` | Chore — SPRINT_STATE.md atualizado (PRs #73-#77 + sprint state histórico)                                          |
| #79 | `068eb1f` | Dashboard — widget "Agenda de hoje" inline com consultas do dia e status coloridos                                 |
| #80 | `5e1c49d` | Patients — seção próximas consultas na página de detalhe do paciente (janela 90d)                                  |
| #81 | `7e14bde` | Fix — timezone correto em todas as datas/horas do apps/patient (consultas, home, checkin tokens)                   |
| #82 | `60eaef0` | Chore — SPRINT_STATE.md atualizado (PRs #78-#81: agenda widget, patient consultas, tz fix)                         |
| #83 | `bc0b3f6` | Fix(patient) — NavBar active highlight dinâmico (usePathname) + todayLocalISO tz correto                           |
| #84 | `9375a86` | Fix(patient) — design token sweep na página de detalhe de documento                                                |
| #85 | `6cd350a` | Fix(web) — agenda todayStr tz (sv-SE BRT) + financeiro/anthropometry/ClinicalNotes design tokens                   |
| #86 | `0b90c4d` | Fix(web) — design token sweep: CompleteWithPaymentModal + alimentos page (bg-white/text-xs eliminados)             |
| #87 | `4fd921a` | Chore — SPRINT_STATE.md atualizado (PRs #83-#86: NavBar active, documentos tokens, agenda+financeiro tokens)       |
| #88 | `6c60a82` | Fix(web) — design token sweep: patient detail action components (PatientHeader, AppointmentsSection, etc.)         |
| #89 | `bd6518e` | Fix(web) — design token sweep: DocumentActions + NewDocumentForm (bg-white→bg-bg-surface, text-xs→text-tiny)       |
| #90 | `b46775a` | Fix(web) — design token sweep: checkins page (StatCards, table) + PatientForm (all labels/inputs)                  |
| #91 | `5973380` | Fix(web) — design token sweep: NpsWidget, WelcomeTour, ImportWizard, OrgSettingsForm, NewMealPlanForm              |
| #92 | `d9ca782` | Fix(patient) — design token sweep: SignOutButton + CheckinForm + AnthropometryForm (shadow-xs, text-tiny)          |
| #93 | `6baf4f2` | Chore — SPRINT_STATE.md atualizado (PRs #87-#92: token sweep completo)                                             |
| #94 | `d35fdd6` | Fix(web/patient) — token sweep FINAL: OrgSettings labels, CompleteWithPaymentModal label,                          |
|     |           | ImportWizard heading text-xl→text-h2, NpsWidget rose/amber/emerald→danger/warning/success tokens,                  |
|     |           | ClinicalNotesSection labels+inputs, CheckinForm success heading text-lg→text-h3,                                   |
|     |           | checkin/page streak badge text-sm→text-body, WelcomeTour Próximo btn text-xs→text-tiny                             |
| #95 | `3a315e4` | Chore — SPRINT_STATE.md atualizado (PRs #93-#94: token sweep FINAL)                                                |
| #96 | `2dd1c70` | Feat(web) — sparkline trend cards em páginas de antropometria e check-ins (AnthropometryTrend + CheckinMiniCharts) |
| #97 | `cb7453f` | Feat(web) — resumo de antropometria + BMI badge + link na página de detalhe do paciente (seção "Última medição")   |
| #98 | `b17a375` | Feat(web) — widget de streak check-in na seção "Acesso ao app" da página de detalhe do paciente                    |

---

## S22 — Estado atual

### Bloqueios PM (ação necessária antes de S22 avançar)

- [ ] **Asaas BaaS produção contratado** — conversa comercial iniciada em S15 (ADR 0039). S22 requer subconta real.
- [ ] **Convites beta S21** — lista de 5-10 nutricionistas enviada + Termos Beta assinados.
- [~] **Vercel Pro + Supabase Pro upgrade** — **deferido por decisão PM (2026-05-20)**. Hobby/Free mantidos por ora; upgradar antes de abrir signup público.

### Tech work disponível (não bloqueado)

- [x] TanStack Table com virtualização para lista de pacientes — cursor paginado + instant search (PR #48)
- [x] axe-core a11y automatizado em CI + Playwright deployment workflow (PR #49)
- [x] Lighthouse CI performance budgets formalizados (PR #49)
- [x] Edição de consulta na agenda — modal reschedule (PR #50)
- [x] Deep-link paciente → formulário de agendamento via ?patientId= (PR #52)
- [x] Cancelamento de consulta com motivo + inline error banner sem alert() (PR #53)
- [x] alert()/confirm() removidos em AnonymizeButton e MealPlanEditor (PR #55)
- [x] No-show com motivo — overlay CANCEL/NO_SHOW generalizado (PR #56)
- [x] UI copy polish — remoção de notas dev de UI de produção (PR #57)
- [x] E2E smoke agenda — day view + criar consulta + confirmar (PR #58)
- [x] Agenda day view — breakdown colorido de consultas por status (PR #59)
- [x] A11y modais — Escape fecha EditAppointmentModal + CompleteWithPaymentModal (PR #61)
- [x] confirm() removidos em DocumentActions + InvitePatientButton; router.refresh() (PR #60)
- [x] Emojis substituídos por ícones lucide-react — DocumentActions, ClinicalNotesSection, NewMealPlanForm (PR #62)
- [x] Cancelamento de consultas CONFIRMED — botão Cancelar ausente corrigido (PR #64)
- [x] CI — gitleaks continue-on-error para evitar falsos bloqueios pós update-branch (PR #65)
- [x] E2E smoke estendido — steps 11-13: SCHEDULED→CONFIRMED→CANCEL lifecycle (PR #67)
- [x] Patient home — próximas consultas (janela 30d) + localizações de status PT-BR (PR #69)
- [x] Agenda — email transacional scheduled/confirmed/cancelled via Resend; graceful no-op sem API key (PR #70)
- [x] Fix — pre-existing ESLint warnings eliminados em apps/web: 0 erros, 0 warnings (PR #71)
- [x] Agenda — email transacional reagendamento (updateAppointmentAction) (PR #72)
- [x] Agenda — email transacional COMPLETED: prompt paciente checar docs/recibo/plano alimentar (PR #74)
- [x] Patient — notificação ao nutricionista quando paciente aceita convite (fire-and-forget Resend) (PR #75)
- [x] Patient — polish: PLAN_STATUS_LABEL localizado PT-BR, ChevronLeft back-link, Date.now() cleanup (PR #76)
- [x] Agenda — lembrete D-1 antes da consulta via QStash `notBefore`; worker `/api/internal/workers/appointments/remind` com verificação manual de assinatura e janela 0-30h (PR #77)
- [ ] PM: configurar secrets Vercel em apps/web: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `NEXT_PUBLIC_APP_URL` para ativar lembretes D-1
- [x] Dashboard — widget "Agenda de hoje" com lista inline das consultas do dia: status coloridos, tz-aware, canceladas/no-show dimmed + strikethrough (PR #79)
- [x] Patients — seção "Consultas" na página de detalhe: próximas 3 (90d) ou últimas 3 se nenhuma futura; deep-link "Agendar consulta" (PR #80)
- [x] Fix — timezone correto em apps/patient: consultas page (getDate() → toLocaleDateString tz), patient home formatApptDate tz-aware, checkin page tokens design system alinhados (PR #81)
- [x] Fix(patient) — NavBar ativa: usePathname() detecta rota atual, marca aria-current="page" + cor brand-primary + strokeWidth bold; todayLocalISO usa sv-SE America/Sao_Paulo em checkin + home (PR #83)
- [x] Fix(patient) — documentos/[docId]/page.tsx: bg-amber-50 → bg-warning-bg, bg-white → bg-bg-surface, text-xs → text-tiny, text-sm → text-body, download button alinhado (PR #84)
- [x] Fix(web) — agenda page: todayStr usa sv-SE Brazil tz + noon UTC stability trick; financeiro: status badges → design tokens ring-inset; anthropometry + ClinicalNotes: datetime-local default usa sv-SE tz (PR #85)
- [x] Fix(web) — CompleteWithPaymentModal: bg-white → bg-bg-surface, text-xs → text-tiny, text-sm → text-body, bg-green-600 → bg-success, text-red-700 → text-danger; alimentos/page: mesmos tokens + badge hardcoded → bg-brand-primary-bg/bg-info-bg (PR #86)
- [x] Fix(web) — design token sweep: PatientHeader, AppointmentsSection + patient detail action components (PR #88)
- [x] Fix(web) — design token sweep: DocumentActions + NewDocumentForm — bg-amber-50→bg-warning-bg, bg-white→bg-bg-surface, text-xs→text-tiny, text-sm→text-body (PR #89)
- [x] Fix(web) — design token sweep: checkins page StatCards + history table; PatientForm labels/inputs/error alert (PR #90)
- [x] Fix(web) — design token sweep: NpsWidget, WelcomeTour, ImportWizard, OrgSettingsForm, NewMealPlanForm — bg-white, shadow-sm, text-xs, text-sm, red/green/emerald hardcoded → tokens (PR #91)
- [x] Fix(patient/web) — design token sweep: SignOutButton, CheckinForm (shadow-xs, mood/scale buttons), AnthropometryForm (legends, labels, inputs) (PR #92)
- [x] Fix(web/patient) — token sweep FINAL: OrgSettings 3 labels, CompleteWithPaymentModal payment label, ImportWizard completion heading, NpsWidget zone colors→design tokens (danger/warning/success), ClinicalNotesSection all text-xs/text-sm, CheckinForm success heading, checkin/page streak badge, WelcomeTour nav btn (PR #94). Zero remaining bg-white/text-xs/text-sm/shadow-sm/hardcoded color violations in app component paths.
- [x] Feat(web) — AnthropometryTrend: sparkline cards (peso, IMC, %GC, GEB) na página de antropometria quando ≥2 medições. AnthropometryTrend + CheckinMiniCharts components com delta vs anterior (color-neutral por contexto clínico). Sparkline data server→client via `.toString()` / `parseFloat()` (Decimal safe) (PR #96)
- [x] Feat(web) — Resumo "Última medição" na página de detalhe do paciente: BMI com badge colorido (Eutrófico/Sobrepeso/Obesidade), peso, altura, %GC, GEB. Botão "Antropometria" no header. Promise.all para queries paralelas. Componentes AnthroRow + BmiDisplay (PR #97)
- [x] Feat(web) — Widget de streak check-in na seção "Acesso ao app" da página de detalhe do paciente: streak atual/d, total check-ins, recorde. userHealthStreak via Promise.all com lastAnthropometry. Ícone Flame (var(--color-warning)) (PR #98)
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
- 2026-05-20 (tarde) — PR #48-#50 merged: TanStack Table + Virtual, axe-core a11y CI, agenda edit modal
- 2026-05-20 (noite) — PR #51-#53 merged: sprint state update, agenda deep-link, cancel com reason
- 2026-05-20 (autônomo) — PR #55-#59 + #61 merged: alert/confirm sweep, no-show overlay, UI polish, E2E agenda, status breakdown, modal a11y
- 2026-05-20 (autônomo, cont.) — PR #60 + #62-#67 merged: confirm sweep completo, emoji sweep, cancel CONFIRMED fix, CI gitleaks fix, E2E lifecycle steps 11-13
- 2026-05-20 (autônomo, cont.) — PR #68 merged: SPRINT_STATE update; PM decide diferir Vercel/Supabase Pro upgrade
- 2026-05-20 (autônomo, cont.) — PR #69-#72 merged: patient home appointments, emails transacionais (scheduled/confirmed/cancelled/reagendado), ESLint warnings eliminados
- 2026-05-20 (autônomo, cont.) — PR #73-#77 merged: SPRINT_STATE update, email COMPLETED, notif nutri invite-accept, patient polish, lembrete D-1 QStash
- 2026-05-20 (autônomo, cont.) — PR #78-#81 merged: SPRINT_STATE update, dashboard agenda widget, patient detail consultas section, patient tz fix
- 2026-05-20 (autônomo, cont.) — PR #82-#86 merged: SPRINT_STATE update, patient NavBar active state, documentos token sweep, agenda+financeiro tokens, CompleteWithPaymentModal+alimentos tokens
- 2026-05-20 (autônomo, cont.) — PR #87-#92 merged: SPRINT_STATE update, design token sweep completo
- 2026-05-20 (autônomo, cont.) — PR #93-#94 merged: SPRINT_STATE update, token sweep FINAL (zero bg-white/text-xs/text-sm/shadow-sm/hardcoded colors remaining in app components) (patient detail actions, DocumentActions, NewDocumentForm, checkins page, PatientForm, NpsWidget, WelcomeTour, ImportWizard, OrgSettingsForm, NewMealPlanForm, SignOutButton, CheckinForm, AnthropometryForm)
- 2026-05-20 (autônomo, cont.) — PR #95-#98 merged: SPRINT_STATE update, sparkline trend cards em antropometria + check-ins, resumo de antropometria + BMI badge na página de detalhe, widget de streak check-in na seção "Acesso ao app"
