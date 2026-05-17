# Runbook 09 — S20 Upgrade Vercel + Supabase Pro (pré-beta)

## Quando rodar

**Deadline duro: fim do S19** (semana anterior ao beta UX privado em S21).

Sprint 20 do plano v11 — não dá pra rodar beta com clientes reais em Hobby
tier (ToS Vercel proíbe uso comercial + risco de Supabase pausar sem aviso).

## Pré-requisitos

- [ ] Cartão de crédito da empresa validado (corporate ou pessoal MEI até R$81k/ano)
- [ ] Email do billing configurado em Vercel + Supabase
- [ ] Backup R2 funcionando (rodou nas últimas 24h sem erro)
- [ ] Smoke + spider suite verde no main (status: `gh pr checks`)

## Vercel: Hobby → Pro

### Custo: US$20/mês por membro (para 1 dev solo, US$20)

### Passos (~10 min)

1. https://vercel.com/account → Billing → **Upgrade to Pro**
2. Adicione cartão
3. Por projeto que precisa upgrade:
   - `erp-nutri-web` → Settings → General → **Upgrade Project**
   - `erp-nutri-patient` → idem
   - `erp-nutri-admin` → idem
   - (`erp-nutri-marketing` pode ficar Hobby — sem auth, baixo tráfego)
4. Habilitar features Pro:
   - **Speed Insights**: Settings → Speed Insights → Enable
   - **Cron Jobs**: já vem incluído (substitui Upstash QStash a longo prazo)

### Validação pós-upgrade

```bash
# 1. Deploy preview funciona (PR de teste)
gh pr create --title "test: pro upgrade smoke" --body "Smoke test deploy" \
  --base main --head main

# 2. Funções não têm mais Cold Start excessivo (>3s = problema)
curl -w "%{time_total}\n" https://erp-nutri-web.vercel.app/api/health/live

# 3. Verifica que nenhum env var quebrou
gh pr checks
```

## Supabase: Free → Pro

### Custo: US$25/mês (1 projeto)

### Passos (~5 min)

1. https://supabase.com/dashboard/project/uzhqlfgwcummukyfriez
2. Settings → General → **Upgrade to Pro**
3. Adicione cartão
4. **Habilitar features Pro**:
   - **PITR (Point-In-Time Recovery)**: Database → Backups → Enable
     - RPO ≤6h (vs 24h do Free)
   - **Read Replicas**: deixa OFF por enquanto. Habilita só se p95 query
     > 100ms consistentemente
   - **Compute Add-ons**: Micro fica OK pra MVP. Sobe se CPU >70% sustained

### Validação pós-upgrade

```bash
# 1. Smoke suite contra Pro DB
DATABASE_URL=postgresql://... pnpm exec playwright test

# 2. Isolation suite (8/9 deve continuar)
DATABASE_URL=postgresql://... pnpm --filter @nutricore/db test

# 3. PITR funciona — restore de 1h atrás num DB efêmero
# (faça via Dashboard → Backups → PITR → Restore)

# 4. Backup R2 continua rodando como redundância semanal
gh workflow view backup-db.yml
```

## Migration plan zero-downtime

Ambos upgrades são **subscription change apenas** — não há cutover de DB nem
deploy. Apps continuam apontando pro mesmo endpoint, só com features
adicionais habilitadas. **Zero downtime esperado.**

⚠️ **Tem 1 risco**: se você esquecer cartão antes do trial Pro expirar
(7 dias), Vercel/Supabase podem suspender a conta. Mitigue garantindo cartão
validado **antes** de upgradar.

## Após upgrade: ajustes operacionais

- [ ] Atualizar `apps/web/.env.example` mencionando que tier é Pro
- [ ] Backup R2 muda de diário → semanal (Pro PITR cobre RPO 6h)
  ```yaml
  # .github/workflows/backup-db.yml
  schedule:
    - cron: "0 6 * * 0" # antes era '0 6 * * *' (diário)
  ```
- [ ] Aumentar Vercel cron coverage: features que estavam adiadas (Vercel
      Cron Hobby = 2/dia, Pro = ilimitado) podem migrar de Upstash QStash
- [ ] Sentry pode upgradar pra Pro (US$26/mês) se >5k erros/mês — mas
      começa com Free e monitora
- [ ] PostHog Free 1M events/mês ainda cobre

## Rollback

Vercel Pro → Hobby: Settings → Billing → Downgrade. Sem perda de dados,
mas perde features Pro (Speed Insights, Cron, etc.).

Supabase Pro → Free: Settings → General → Downgrade. **Atenção**: perde
PITR e cron auto-resume. Pode pausar após 7d de inatividade. Mantenha
backup R2 ativo antes de downgradar.

## Gates de quando upgradar (não antes)

- ✅ Smoke + spider + isolation: 100% verde no main
- ✅ Beta lista de 5-10 nutris fechada
- ✅ Cartão da empresa validado e billing approved
- ✅ Runbook 08 (Chaos Gameday) rodado pelo menos 1x

## Custo total mensal pós-upgrade

| Item                          | Custo                      |
| ----------------------------- | -------------------------- |
| Vercel Pro (1 user)           | US$ 20                     |
| Supabase Pro (1 project)      | US$ 25                     |
| **Recorrente fixo**           | **US$ 45/mês**             |
| AWS SES (variável)            | ~US$ 0-5 (até 100k emails) |
| Resend (fallback ou primário) | US$ 0 free 3k/mês          |
| Cloudflare R2 backups         | US$ 0 free 10GB            |
| **TOTAL típico**              | **~US$ 45-50/mês**         |

## Próximo passo após este runbook

**Sprint 21 — Beta UX privado**: invite 5-10 nutris reais (sem cobrança
intermediada, eles cobram externo, plataforma só registra EXTERNAL_RECORDED).
Ver `docs/runbooks/00-beta-launch-checklist.md` (a criar).
