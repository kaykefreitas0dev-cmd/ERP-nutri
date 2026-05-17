-- ============================================================
-- 001 — Enable RLS + FORCE em todas as tabelas tenant-aware
-- Lock 1 (ADR 0001 — multi-tenancy)
-- Ref: Lock 6 (Global Identity) — User NÃO é tenant-aware
-- ============================================================
-- FORCE garante que mesmo service_role respeita as policies
-- a menos que use bypass explícito (que deve ser auditado)
-- ============================================================

-- TENANT-AWARE TABLES (rls + force)

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;

ALTER TABLE organization_brandings ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_brandings FORCE ROW LEVEL SECURITY;

ALTER TABLE clinics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinics FORCE ROW LEVEL SECURITY;

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams FORCE ROW LEVEL SECURITY;

ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships FORCE ROW LEVEL SECURITY;

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;

ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents FORCE ROW LEVEL SECURITY;

ALTER TABLE subscription_state_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_state_events FORCE ROW LEVEL SECURITY;

-- GLOBAL TABLES (User-scoped ou public) - RLS habilitado mas policies abertas/específicas

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions FORCE ROW LEVEL SECURITY;

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions FORCE ROW LEVEL SECURITY;

-- PUBLIC / SISTEMA (sem RLS — leitura pública via API)

-- pricing_plans: leitura pública via /v1/public/pricing-plans (sem RLS necessário)
-- _keepalive: tabela sistema (1 row) — sem RLS
-- service_health: leitura pública para status page — sem RLS

-- ============================================================
-- POLICIES — Tenant Isolation (todas tabelas tenant-scoped)
-- Padrão: organization_id = current_setting('app.current_org')::uuid
-- O withTenant wrapper (ADR 0048) seta este GUC no início de cada
-- transação tenant-aware.
-- ============================================================

-- organizations: user só vê orgs onde tem membership ativa
CREATE POLICY org_member_can_select ON organizations
  FOR SELECT
  USING (
    id = current_setting('app.current_org', true)::uuid
    OR auth.is_super_admin()
  );

CREATE POLICY org_member_can_update ON organizations
  FOR UPDATE
  USING (
    id = current_setting('app.current_org', true)::uuid
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organizations.id
        AND m.user_id = auth.uid()
        AND m.role IN ('org_owner', 'clinic_admin')
        AND m.status = 'ACTIVE'
    )
  )
  WITH CHECK (id = current_setting('app.current_org', true)::uuid);

CREATE POLICY org_owner_only_delete ON organizations
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.organization_id = organizations.id
        AND m.user_id = auth.uid()
        AND m.role = 'org_owner'
        AND m.status = 'ACTIVE'
    )
  );

-- Template aplicado às demais tabelas tenant-scoped
CREATE POLICY tenant_isolation_select ON organization_brandings
  FOR SELECT
  USING (organization_id = current_setting('app.current_org', true)::uuid OR auth.is_super_admin());

CREATE POLICY tenant_isolation_modify ON organization_brandings
  FOR ALL
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_select ON clinics
  FOR SELECT
  USING (organization_id = current_setting('app.current_org', true)::uuid OR auth.is_super_admin());

CREATE POLICY tenant_isolation_modify ON clinics
  FOR ALL
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY tenant_isolation_select ON teams
  FOR SELECT
  USING (organization_id = current_setting('app.current_org', true)::uuid OR auth.is_super_admin());

CREATE POLICY tenant_isolation_modify ON teams
  FOR ALL
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- memberships: user vê próprios memberships + nutri vê todos da org
CREATE POLICY member_can_select_own_or_org ON memberships
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR organization_id = current_setting('app.current_org', true)::uuid
    OR auth.is_super_admin()
  );

CREATE POLICY owner_can_modify_org_members ON memberships
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    AND EXISTS (
      SELECT 1 FROM memberships m2
      WHERE m2.organization_id = memberships.organization_id
        AND m2.user_id = auth.uid()
        AND m2.role IN ('org_owner', 'clinic_admin')
        AND m2.status = 'ACTIVE'
    )
  );

-- consents: user vê próprios + nutri da org vê dos pacientes da org
CREATE POLICY consent_owner_or_org_nutri ON consents
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR (organization_id = current_setting('app.current_org', true)::uuid AND organization_id IS NOT NULL)
    OR auth.is_super_admin()
  );

CREATE POLICY consent_user_can_grant ON consents
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY consent_user_can_revoke ON consents
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- audit_logs: nutri da org vê logs da org; super_admin vê tudo
-- INSERT é feito apenas via SECURITY DEFINER function (audit.append_log)
CREATE POLICY audit_org_select ON audit_logs
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR (organization_id IS NULL AND auth.is_super_admin())
  );

-- subscription_state_events: org_owner vê eventos da própria org
CREATE POLICY sse_org_select ON subscription_state_events
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR auth.is_super_admin()
  );

-- users: cada user vê apenas o próprio User (PII global)
CREATE POLICY user_self_only ON users
  FOR SELECT
  USING (id = auth.uid() OR auth.is_super_admin());

CREATE POLICY user_self_update ON users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- permissions: leitura pública (lista de permissões disponíveis)
-- Modificação apenas via super_admin (admin portal S18)
CREATE POLICY perm_public_select ON permissions
  FOR SELECT
  USING (true);

CREATE POLICY perm_admin_modify ON permissions
  FOR ALL
  USING (auth.is_super_admin())
  WITH CHECK (auth.is_super_admin());

CREATE POLICY role_perm_public_select ON role_permissions
  FOR SELECT
  USING (true);

CREATE POLICY role_perm_admin_modify ON role_permissions
  FOR ALL
  USING (auth.is_super_admin())
  WITH CHECK (auth.is_super_admin());

-- ============================================================
-- COMMENT: Função auth.is_super_admin() definida em 005
-- ============================================================
