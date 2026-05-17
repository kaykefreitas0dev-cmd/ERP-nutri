# Runbook 01 — Supabase Free pausou o DB

**Severidade:** P1
**MTTR alvo:** <15min

## Sintoma

- API retorna 503 / `connection refused` em todos endpoints DB
- Sentry alerta `prisma.connect failed`
- Status page mostra Base de dados como **major_outage**
- Cloudflare Worker `health-keepalive` falhou nas últimas 24h (ver Cloudflare Dashboard → Workers → Logs)

## Causa

Supabase Free pausa o database após **7 dias sem queries reais**. CF Worker `health-keepalive` deveria bater `/api/health/db` a cada 5 dias mas pode ter falhado (Worker error, app deploy quebrado, env var errada).

## Mitigação imediata (PM, ~2min)

1. Acesse [https://supabase.com/dashboard/projects](https://supabase.com/dashboard/projects)
2. Selecione o projeto NutriCore
3. Banner amarelo no topo: **"Project is paused"** → clique **"Restore project"**
4. Aguarde ~1-2min — banner some
5. Teste: abra `https://nutri.nutricore.app/api/health/db` → deve retornar 200 `{"status":"ok",...}`
6. Atualize status page: o worker `monitoring.health-aggregator` (CF Worker S2a) detecta automaticamente em <5min

## Mitigação alternativa

Se "Restore project" der erro:
1. Abra ticket no Supabase Support: support@supabase.com (resposta ~24h no Free; instant no Pro)
2. Comunique no `/status` página via Sanity (S2b feature) ou diretamente no marketing repo
3. Ative feature flag `read_only_mode` (S2b+) — usuários veem cached responses + banner "Manutenção em andamento"

## Causa raiz (investigação após mitigação)

1. Cloudflare Dashboard → Workers → `nutricore-health-keepalive` → Logs últimas 7 dias
2. Procure por erros `fetch failed`, `timeout`, status >= 400
3. Cenários comuns:
   - **HEALTH_URL env errada:** `wrangler deploy --var HEALTH_URL:https://nutri.nutricore.app/api/health/db`
   - **CF Worker pausado (free tier limit):** Cloudflare Dashboard → Workers → uso/mês
   - **App `/api/health/db` quebrado por deploy:** verificar Vercel Deploys recentes; rollback se necessário

## Prevenção

- [ ] Sentry alerta quando `health-keepalive` falha 2x consecutivas
- [ ] PostHog dashboard com last_successful_keepalive < 4 dias
- [ ] Em S20 (upgrade Supabase Pro), pausa não existe mais — runbook fica como fallback histórico
