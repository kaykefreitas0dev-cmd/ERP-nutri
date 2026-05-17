# SPRINT_GATES — NutriCore

> Protocolo de bloqueio agêntico (ADR 0041). PM marca `[x]` antes de Claude Code iniciar cada sprint.

---

## Sprint S1 — Bootstrap Monorepo + CI/CD + Vercel

### Decisões de produto requeridas (PM marca `[x]`)
- [X] Nome dos projetos Vercel (default: `nutricore-web`, `nutricore-marketing`, `nutricore-patient`)
- [ ] Domínio comprado (ex: `nutricore.app` ou alternativa): _________
- [ ] Estrutura de subdomínios aprovada (v11.2 Diff 9):
  - apex `${dominio}` → marketing
  - `app.${dominio}` → patient (PWA — isolamento iOS Push)
  - `nutri.${dominio}` ou `app.${dominio}/nutri` → web (escolher um)
  - `admin.${dominio}` → admin (S18)
- [ ] Sherlock consultor 1 identificado: _________
- [ ] Sherlock consultor 2 (reserva): _________
- [ ] Cal.com workspace criado para office hours: _________

### Validação PM antes de mergear sprint
- [ ] `pnpm dev` sobe 3 apps localmente (web :3000, marketing :3001, patient :3002)
- [ ] PR teste dispara ≥9 checks no CI
- [ ] Vercel preview deploy funciona para os 3 frontends (após PM rodar `vercel link`)
- [ ] `SPRINT_STATE.md` atualizado para `S2a` após merge

---

## Sprint S2a — Auth + RBAC + Tenant Guard + Audit + Backup R2 + Healthcheck CF

### Decisões de produto requeridas
- [X] Frequência backup pg_dump confirmada: **diário 03:00 BRT (06:00 UTC)** — default plano
- [X] Region R2 para backups: **Auto** (Cloudflare escolhe próximo do usuário)
- [X] Cloudflare Workers Cron Trigger configurado: **5 dias** bate `/api/health/db`
- [X] Email do super-admin para provisionamento manual via SQL: **kaykefreitas0dev@gmail.com**

### Validação PM
- [ ] Isolation suite verde no CI
- [ ] Backup R2 funcionando (restore test em DB efêmero passa)
- [ ] Audit hash chain verificável (linha 1 prev_hash NULL, linha 2 encadeia)
- [ ] Cron CF Worker batendo `/api/health/db` está logando OK
- [ ] Healthcheck endpoint executa UPDATE+SELECT em `_keepalive` (v11.2 Diff B.6)

---

## Sprint S2b — Design System + Marketing + Onboarding v1 + Crisp removido + Helmet

### Decisões de produto requeridas
- [ ] Paleta de cores brand (PM aprova default neutro ou customizar)
- [ ] Copy do Hero da home (PM redige ou usa draft Claude Code)
- [ ] Email do suporte (default: `suporte@${dominio}`)
- [ ] CSP report-only mode ativado por 2 sprints (recomendação: sim)
- [ ] Sanity Studio em `/studio` autenticado pelo próprio Sanity (não Supabase) — apenas PM como editor durante MVP (v11.2 Diff 8): aprovado?
- [ ] Status page pública oculta nomes dos providers (v11.2 Diff B.8): aprovado?
- [ ] `OnboardingProgress` storage em tabela DB (recomendação) ou localStorage?

### Validação PM
- [ ] Lighthouse mobile ≥90 na home
- [ ] Onboarding wizard cria org com sucesso
- [ ] Formulário `/contato` envia email via AWS SES (ou Resend durante fallback inicial)
- [ ] Status page renderiza estado dos serviços

---

## Sprint S12a — PWA Offline-First + Conflict UI + Lock 16

### Decisões de produto requeridas
- [ ] Default conflito nutri × paciente: **LWW (last-write-wins) com banner** (recomendação)
- [ ] Anotação clínica encriptada em diff: **apenas indicador "houve mudança"** (recomendação — não decripta no cliente)
- [ ] Backdating de check-in: aceitar até 24h (Lock 16 default)
- [ ] Photo upload no MVP: **NÃO** (Fase 7); pipeline Canvas WebP implementado mas feature flag off
- [ ] Planos passados visíveis offline: 30 dias
- [ ] Texto push reactivation 5d: PM redige

### Validação PM
- [ ] PWA testado iOS Safari 17+ e Android Chrome modo avião
- [ ] `navigator.storage.persisted() === true` após login
- [ ] Background Sync re-envia 5 mutations failed sem duplicar
- [ ] Lighthouse mobile ≥90 + App Shell <1s offline

---

## Sprint S12b — Invite-Only (Lock 7) + Auth Fallback (Lock 9) + `/recover`

### Decisões de produto requeridas
- [ ] **EMAIL_PROVIDER inicial: `resend`** (default até AWS SES sair de sandbox; trocar para `ses` após). v11.2 Diff 4.
- [ ] Copy do email convite (PM redige; draft Claude Code disponível)
- [ ] Remetente: `noreply@${dominio}` (recomendação) ou `contato@`?
- [ ] TTL token magic link: 15min (Lock 9 default)
- [ ] Cooldown reenvio: 5min (default)
- [ ] Texto template WhatsApp utility (dentro do template aprovado Meta — sem URL): PM redige
- [ ] Copy tela `/recover`: PM redige

### Validação PM
- [ ] Template Meta `patient_plan_ready` em status APPROVED na console
- [ ] Fluxo invite end-to-end testado com email PM
- [ ] Fluxo fallback SMS testado com bounce simulado (AWS SES suppression list)
- [ ] Token expirado retorna erro claro UX

---

## Sprint S14a — Asaas Subcontas Sandbox + Escrow + Disputes

### Decisões de produto requeridas
- [ ] Taxa SaaS da plataforma %: _____ (recomendação: 5.99% + R$1.00 fixo)
- [ ] Escrow período: 24h (Lock 14 padrão) — confirmado?
- [ ] Política chargeback: **split com subconta responsável** (default)
- [ ] Política no-show: nutri "marca realizada" libera escrow OU cobrança parcial configurável?

### Validação PM
- [ ] Sandbox Asaas: charge R$100 com fee 5,99% → R$5,99 plataforma + R$94,01 escrow 24h
- [ ] Cancelamento antes do release → estorno automático
- [ ] Chargeback simulado debita subconta
- [ ] Tentar cobrar sem KYC APPROVED → 403

---

## Sprint S15a — Recibo Simples + EXTERNAL_RECORDED + Google Meet + HealthDataPoint stub

### Decisões de produto requeridas
- [ ] Numeração recibo: **sequencial por nutri** (recomendação) ou global?
- [ ] Logo no recibo: **branding nutri** (default; fallback plataforma se ausente)
- [ ] CPF/CNPJ do nutri obrigatório no recibo: **sim** (validação Zod)
- [ ] Aviso UI obrigatório: "Você ainda precisa emitir NF-e desta consulta no seu sistema fiscal." (recomendação: sim, modal de confirmação na primeira vez)
- [ ] Fluxo EXTERNAL_RECORDED (S21 beta UX sem cobrança intermediada): ao marcar consulta "Realizada", abre modal com:
  - Campo "Valor pago" (livre; não puxa do plano automaticamente)
  - Campo "Método de pagamento" (PIX externo / Cartão externo / Dinheiro / Transferência / Outro)
  - Campo opcional "Referência externa" (ID Asaas pessoal, link comprovante, etc.)
- [ ] Recibo simples gerado automaticamente após registro? (recomendação: sim)
- [ ] Email com PDF anexo enviado ao paciente? (recomendação: sim via signed URL 30 dias)

### Validação PM
- [ ] PDF recibo gerado em <30s após payment confirmado
- [ ] Numeração sequencial por nutri funciona (não duplica entre nutris)
- [ ] Tabela `health_data_points` criada + RLS isolada por user (Lock 6)
- [ ] Endpoint interno `/api/v1/internal/health-data-points` aceita POST mas não aparece em OpenAPI público
- [ ] Beta S21: 1 nutri completa fluxo (consulta → marcar realizada → registrar pagamento externo → recibo PDF no email) em <2min UX

---

## Sprint S17 — Offboarding Export + Runbooks Completos + DPIA

### Decisões de produto requeridas
- [ ] Estrutura ZIP: domínios em pastas (recomendação Fase v9)
- [ ] Audit logs incluídos? (recomendação: sim, em subpasta `/audit`)
- [ ] Anonymized records incluídos? (recomendação: sim, com placeholder claro)
- [ ] Senha do ZIP enviada via SMS (canal separado do email com link)? (recomendação: sim)
- [ ] TTL signed URL: 7 dias

### Validação PM
- [ ] Owner solicita → ZIP em <6h com signed URL email
- [ ] SMS recebido com senha decodificável
- [ ] ZIP abre com senha, manifest tem contagens corretas

---

## Sprint S21 — Beta UX Privado (5-10 nutris, sem cobrança intermediada)

### Decisões de produto requeridas
- [ ] Lista nominal de 5-10 nutris beta (PM convida pessoalmente): _________
- [ ] Termos do beta: gerar PDF "Termo Beta" explicando cobrança intermediada vem S22
- [ ] Métrica "fluxo completo" definida: paciente convidado → aceitou → plano prescrito → consulta agendada → realizada → recibo gerado → check-in registrado
- [ ] SLA bugs P1 corrigidos <24h durante beta? (recomendação: sim)
- [ ] Coleta NPS: email automático com link survey Typeform/Tally (free) ao final 2ª semana
- [ ] Suporte beta: apenas email com SLA <24h (recomendação) ou Crisp humano?

### Validação PM
- [ ] 10 nutris cadastrados, ≥7 ativos
- [ ] 30+ pacientes criados
- [ ] 15+ planos prescritos
- [ ] 10+ consultas realizadas com EXTERNAL_RECORDED + recibo
- [ ] NPS médio coletado de ≥5 nutris
- [ ] P0/P1 endereçados antes S22
- [ ] 0 incidentes de RLS vazamento

---

## Sprints futuras (templates a popular quando chegar a hora)

S3, S4, S5, S6, S7, S8, S9a, S9b, S10, S11, S13, S14b, S15, S16, S18, S19, S20, S22, S23 — gates pré-populados pelo PM antes do início de cada uma, seguindo o padrão acima.
