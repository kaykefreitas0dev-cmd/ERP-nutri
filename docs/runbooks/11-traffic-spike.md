# Runbook 11 — Pico de carga

**Severidade:** P2 (degradação) / P1 (timeouts 30+ min)
**MTTR alvo:** < 15min

## Sintoma

- Latência p99 > 2s sustained > 5min (Vercel Analytics)
- Erro 503 / 504 timeout em rotas tenant-aware
- Connection pool exhaustion no Supabase (logs: "remaining connection slots reserved")
- Sentry com pico de errors `PrismaClientInitializationError` ou `PoolExhaustedError`

## Causa raiz comum

1. Pico orgânico de usuários (lançamento, viral)
2. Bot/scraper agressivo em rotas públicas
3. Cron job mal-configurado batendo endpoint sem rate limit
4. Loop client-side com fetch (bug de UI)
5. DB query lenta criando fila

## Mitigação imediata (5 min)

### 1. Identificar fonte do tráfego

Vercel Analytics → Real-time:

- Página mais hit
- Top referrers
- Top IPs (se identificável)

### 2. Bloquear bots agressivos (se identificado)

Via Vercel Firewall (se Pro):

```bash
# Bloquear IP
npx vercel firewall add-rule --type ip --value "1.2.3.4" --action block
```

Via Cloudflare (sempre):

```bash
# Adiciona regra "Challenge" para User-Agent suspeito
# Dashboard Cloudflare → Security → WAF → Custom Rules
```

### 3. Subir Upstash rate limit em rotas públicas

Hot-fix: editar `apps/marketing/src/app/c/[slug]/actions.ts`:

- Reduzir `checkRateLimitById` window de 600s → 60s
- Reduzir max de 3 → 1

Commit + push, Vercel redeploy automático.

### 4. Verificar connection pool Supabase

```bash
# Via Supabase Dashboard → Settings → Database → Connection pooling
# Modo: "Transaction" (default) suporta mais conexões
# Pool size: 15 (free) — não dá pra aumentar sem Pro upgrade
```

Se pool exhausted:

- **Imediato**: kill connections idle > 10 min:
  ```sql
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'idle'
    AND state_change < now() - interval '10 min'
    AND application_name LIKE 'prisma%';
  ```
- **Médio prazo**: upgrade Supabase Pro (50+ connections via Supavisor)

## Investigação (10 min)

### Identificar queries lentas

```sql
SELECT
  substring(query, 1, 100) AS query_snippet,
  calls,
  mean_exec_time::int AS avg_ms,
  total_exec_time::int AS total_ms
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;
```

Top queries lentas → adicionar índice ou refatorar.

### Verificar Vercel Function timeout

Logs Vercel:

- Filtrar por status 504 ou duration > 10s
- Hobby tier: 10s timeout em Functions; Pro: 60s

### Cache hit rate

```bash
# Upstash dashboard → Analytics
# Cache hit rate < 50% indica TTL muito curto ou keys mal distribuídas
```

## Mitigação prolongada

1. **Aumentar cache TTL** em endpoints estáveis (pricing-plans 1h → 4h)
2. **Adicionar CDN edge cache** via `Cache-Control: public, s-maxage=300, stale-while-revalidate=86400`
3. **Lazy load** widgets pesados no dashboard
4. **Upgrade Vercel Pro** se Hobby: 10s timeout vira 60s, +CPU
5. **Read replicas** Supabase Pro: queries read-only vão pra replica

## Recuperação

Quando carga voltar ao normal:

1. Restaurar rate limits originais
2. Remover firewall rules temporárias
3. Verificar PostHog: usuários conseguiram completar fluxos críticos?
4. Post-mortem: o que causou o pico?

## Prevenção

- **Lighthouse CI** falha build se p99 > 3s em rotas críticas
- **Sentry Performance** alerta em p99 > 1.5s em `withTenant`
- **Rate limits em TODOS endpoints públicos** (já feito em rodada QA #27/#30)
- **Cron jobs** registrados no docs/runbooks/cron-inventory.md (a criar)
- **CDN cache** agressivo em assets + páginas estáticas (marketing)
