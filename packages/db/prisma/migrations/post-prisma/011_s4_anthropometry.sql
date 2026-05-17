-- ============================================================
-- 011 — S4: Anthropometry + RLS
-- ============================================================

ALTER TABLE anthropometry ENABLE ROW LEVEL SECURITY;
ALTER TABLE anthropometry FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anthropometry_tenant ON anthropometry;
CREATE POLICY anthropometry_tenant ON anthropometry
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);
