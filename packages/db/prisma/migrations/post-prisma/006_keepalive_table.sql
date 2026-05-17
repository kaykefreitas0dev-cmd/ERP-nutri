-- ============================================================
-- 006 — _keepalive seed + trigger anti-pausa Supabase Free
-- v11.2 Diff B.6 — endpoint /api/health/db faz UPDATE + SELECT
-- ADR 0044 — Healthcheck via Cloudflare Workers Cron Trigger
-- ============================================================

-- Garante 1 row em _keepalive (Prisma cria a tabela; aqui apenas seed)
INSERT INTO _keepalive (id, last_touched)
VALUES (1, now())
ON CONFLICT (id) DO NOTHING;

-- Sem RLS em _keepalive (tabela sistema, sem dados sensíveis)
-- Mas restrito a service_role para evitar abuso de write
REVOKE ALL ON _keepalive FROM PUBLIC;
REVOKE ALL ON _keepalive FROM anon;
GRANT SELECT, UPDATE ON _keepalive TO authenticated, service_role;

-- ============================================================
-- service_health: leitura pública (status page)
-- Modificação apenas via worker monitoring.health-aggregator
-- ============================================================

REVOKE ALL ON service_health FROM PUBLIC;
REVOKE ALL ON service_health FROM anon;
GRANT SELECT ON service_health TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON service_health TO service_role;
