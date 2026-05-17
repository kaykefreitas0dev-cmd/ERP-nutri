-- =====================================================================
-- S19 Hardening — Helper safe pra current_org (evita 22P02 syntax error)
-- =====================================================================
-- Bug: policies usam current_setting('app.current_org', true)::uuid mas
-- quando GUC não foi setado, current_setting retorna '' (string vazia),
-- e o cast '' -> uuid quebra com "invalid input syntax for type uuid".
-- Resultado: queries crasham ao invés de retornar 0 rows graciosamente.
--
-- Fix: função SECURITY DEFINER que retorna NULL quando GUC empty/missing.
-- Policies usam o helper ao invés do cast direto.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_org', true), '')::uuid;
$$;

COMMENT ON FUNCTION public.current_org_id() IS
  'Retorna app.current_org GUC como uuid, ou NULL se não setado. Helper safe contra empty-string cast (evita 22P02 syntax error).';

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT NULLIF(current_setting('app.current_user', true), '')::uuid;
$$;

COMMENT ON FUNCTION public.current_user_id() IS
  'Retorna app.current_user GUC como uuid, ou NULL se não setado.';

-- ----- Substitui policies que usam o cast direto pelas com helper -----

DROP POLICY IF EXISTS member_can_select_own_or_org ON memberships;
CREATE POLICY member_can_select_own_or_org ON memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id = public.current_org_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS owner_can_modify_org_members ON memberships;
CREATE POLICY owner_can_modify_org_members ON memberships
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_org_id()
    AND public.is_org_admin(organization_id)
  )
  WITH CHECK (
    organization_id = public.current_org_id()
    AND public.is_org_admin(organization_id)
  );
