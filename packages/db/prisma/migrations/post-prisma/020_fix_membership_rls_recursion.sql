-- =====================================================================
-- S19 Hardening — Fix RLS infinite recursion em policy de memberships
-- =====================================================================
-- Bug detectado pela isolation suite: policy owner_can_modify_org_members
-- faz EXISTS (SELECT 1 FROM memberships ...) DENTRO da policy DA tabela
-- memberships, causando "infinite recursion detected in policy" quando
-- role authenticated tenta SELECT/UPDATE/DELETE.
--
-- Fix: extrair lookup pra função SECURITY DEFINER (bypassa RLS) que retorna
-- bool — policy chama a função sem trigger recursivo.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.is_org_admin(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER -- chave: bypassa RLS pra evitar recursão
SET search_path = public, pg_catalog
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM memberships m
    WHERE m.organization_id = p_org_id
      AND m.user_id = auth.uid()
      AND m.role IN ('org_owner', 'clinic_admin')
      AND m.status = 'ACTIVE'
  );
$$;

COMMENT ON FUNCTION public.is_org_admin(uuid) IS
  'Retorna true se auth.uid() é org_owner OR clinic_admin ATIVO na org. SECURITY DEFINER pra evitar RLS recursion.';

-- ----- Substitui policy ofensiva -----
DROP POLICY IF EXISTS owner_can_modify_org_members ON memberships;

CREATE POLICY owner_can_modify_org_members ON memberships
  FOR ALL TO authenticated
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    AND public.is_org_admin(organization_id)
  )
  WITH CHECK (
    organization_id = current_setting('app.current_org', true)::uuid
    AND public.is_org_admin(organization_id)
  );
