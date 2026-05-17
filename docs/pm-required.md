# PM Required — Ações que dependem de você

> Lista de itens que **só você pode fazer**. Atualizada continuamente durante modo agêntico.

## 🔴 Crítico (bloqueia sprints futuras)

### 1. Mergear PRs abertos

| PR | Branch | Sprint | Status |
|---|---|---|---|
| [#2](https://github.com/kaykefreitas0dev-cmd/ERP-nutri/pull/2) | feat/s2a-auth-rbac-tenant-guard | S2a | aguarda CI verde + review |

Branch protection exige 1 review + checks verdes. PRs continuam empilhando — eu trabalho em branches encadeadas.

### 2. Cadastros externos pendentes

| Item | Dificuldade | Prazo | Onde |
|---|---|---|---|
| MEI | Trivial (10min) | Antes S14 | [portalmei.economia.gov.br](https://portalmei.economia.gov.br) |
| Domínio (`nutricore.app` ou similar) | Trivial (5min, R$40/ano) | Antes S2b validação | [Registro.br](https://registro.br) ou Cloudflare Registrar |
| Cloudflare account + R2 bucket `nutricore-backups` | Médio (15min) | Antes beta S21 | [cloudflare.com](https://cloudflare.com) |
| AWS SES production access (sair sandbox) | Médio (form + 2-3 dias review) | Antes beta S21 | AWS Console → SES |
| Meta WhatsApp Business Verification | Alto (1-30 dias) | Antes S12b | [business.facebook.com](https://business.facebook.com) |
| Asaas conta + sandbox token | Médio (KYC + 1 dia) | Antes S14a | [asaas.com](https://asaas.com) |

### 3. Configurar GitHub Secrets faltantes

Quando criar R2 bucket:
```bash
gh secret set R2_ACCESS_KEY --body "..."
gh secret set R2_SECRET_KEY --body "..."
gh secret set R2_ACCOUNT_ID --body "..."
```

Quando aprovar AWS SES:
```bash
gh secret set AWS_ACCESS_KEY_ID --body "..."
gh secret set AWS_SECRET_ACCESS_KEY --body "..."
gh secret set AWS_REGION --body "us-east-1"
```

## 🟡 Importante (não bloqueia mas degrada)

### 4. Decisões de produto

| Decisão | Eu deixei default | Você pode mudar em |
|---|---|---|
| Paleta brand | `teal-700` | `tailwind.config` + Design System (S2b) |
| Copy Hero da home | Placeholder genérico | `apps/marketing/src/app/page.tsx` |
| Email suporte | `suporte@nutricore.app` | env var `SUPPORT_EMAIL` |
| Taxa SaaS plataforma | Não definido (S14a default 5.99% + R$1.00) | seed pricing_plans |
| Pricing default toggle | Anual com 17% off | Marketing UI |

### 5. Sherlock consultor

Precisa identificar 1-2 consultores Sherlock (LGPD/security review). PRs em paths sensíveis ficam com tag `@needs-sherlock-review` até você definir.

Paths sensíveis: `*payment*`, `*auth*`, `*.rls.sql`, `*.policy.sql`, `crypto`, `vault`.

### 6. Cal.com workspace

Para office hours com PM (sprint reviews + emergências). Free tier funciona.

### 7. Rotacionar senha Supabase DB

Você compartilhou `Kaka25126587@` no chat. Registrada em:
- GitHub Secret `SUPABASE_DB_PASSWORD`
- Vercel env vars (web + marketing — `DATABASE_URL`)
- Histórico de chat (Claude Code session)

Quando puder, faça reset no dashboard Supabase e me passa a nova senha — eu atualizo os 2 sistemas (script `scripts/setup-vercel-env.ps1` já reaproveitável).

## 🟢 Quando tiver tempo

### 8. Promover outros super-admins (S18 admin UI)

Por enquanto, só `kaykefreitas0dev@gmail.com` é super_admin. Para promover outros via SQL:

```sql
UPDATE auth.users
SET raw_app_meta_data = jsonb_set(coalesce(raw_app_meta_data,'{}'), '{is_super_admin}', 'true')
WHERE email = 'NOVO_EMAIL';
```

### 9. Configurar Sanity Studio + CMS

Já está em `apps/marketing/sanity/`. Quando entrar em `/studio`, você cria conteúdo (posts blog, testimonials, FAQs).

### 10. Beta nutris (S21)

Lista nominal de 5-10 nutris para teste fechado. Você convida pessoalmente.

---

## Como atualizar

Modo agêntico atualiza este arquivo automaticamente quando encontra um novo bloqueio. Você pode marcar `[x]` quando completar um item — eu detecto na próxima sprint e desbloqueio o que dependia.

## Última atualização

2026-05-17 — início do modo agêntico (após S2a commit `4d06550`)
