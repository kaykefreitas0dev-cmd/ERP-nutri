-- ============================================================
-- 005 — Helper auth.is_super_admin() (Lock 12 preparado, S2a)
-- ============================================================
-- Lê custom claim app_metadata.is_super_admin do JWT Supabase
-- Usado por policies RLS para permitir bypass de tenant isolation
-- a super-admins (operações de backoffice, audit, suporte)
--
-- Provisionamento de um super-admin (manual via SQL Editor):
--
--   UPDATE auth.users
--   SET raw_app_meta_data =
--     jsonb_set(coalesce(raw_app_meta_data, '{}'::jsonb), '{is_super_admin}', 'true')
--   WHERE email = 'kaykefreitas0dev@gmail.com';
--
-- A apps/admin (S18) terá UI para promover outros super-admins.
-- ============================================================

CREATE OR REPLACE FUNCTION auth.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb
      -> 'app_metadata'
      ->> 'is_super_admin')::boolean,
    false
  );
$$;

GRANT EXECUTE ON FUNCTION auth.is_super_admin TO authenticated, anon, service_role;

-- ============================================================
-- Helper para tenant context (usado por withTenant — ADR 0048)
-- ============================================================
-- O withTenant wrapper executa SET LOCAL app.current_org = $1 + app.current_user = $2
-- antes de cada transação tenant-aware. Estas funções helpers facilitam leitura.
-- ============================================================

CREATE OR REPLACE FUNCTION current_org_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_org', true)::uuid;
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user', true)::uuid,
    auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION current_org_id TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION current_user_id TO authenticated, anon, service_role;
