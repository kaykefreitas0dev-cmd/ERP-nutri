-- ============================================================
-- 008 — Policies SELECT públicas para tabelas read-only públicas
-- Pricing plans + service_health são consumidos por /api/public/* sem auth
-- _keepalive é tabela sistema (1 row) acessível ao healthcheck
-- ============================================================

DROP POLICY IF EXISTS pricing_plans_public_select ON pricing_plans;
CREATE POLICY pricing_plans_public_select ON pricing_plans
  FOR SELECT
  USING (is_public = true OR public.is_super_admin());

DROP POLICY IF EXISTS pricing_plans_admin_modify ON pricing_plans;
CREATE POLICY pricing_plans_admin_modify ON pricing_plans
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS service_health_public_select ON service_health;
CREATE POLICY service_health_public_select ON service_health
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS service_health_service_modify ON service_health;
CREATE POLICY service_health_service_modify ON service_health
  FOR ALL
  USING (false)  -- bloqueia INSERT/UPDATE/DELETE via authenticated/anon
  WITH CHECK (false);
-- service_role bypassa RLS por padrão (necessário para worker monitoring.health-aggregator)

DROP POLICY IF EXISTS keepalive_public_access ON _keepalive;
CREATE POLICY keepalive_public_access ON _keepalive
  FOR ALL
  USING (true)
  WITH CHECK (true);
-- _keepalive é sistema; healthcheck endpoint precisa UPDATE+SELECT (v11.2 Diff B.6)
