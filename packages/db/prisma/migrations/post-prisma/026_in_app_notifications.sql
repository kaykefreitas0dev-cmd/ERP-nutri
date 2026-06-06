-- =====================================================================
-- 026 — Notificações in-app (sino do topbar)
-- =====================================================================
-- Destinatário = User do nutricionista. Tenant-scoped (org) + user-scoped.
-- Produtores: eventos do sistema (ex.: agendamento público) inserem via
-- conexão da aplicação. Leitura/marcar-como-lida: apenas o próprio usuário.
--
-- RLS espelha o padrão das tabelas tenant (current_setting('app.current_org'))
-- + restrição por usuário em SELECT/UPDATE/DELETE. As Server Actions também
-- filtram explicitamente por user_id + organization_id (defense-in-depth).
-- =====================================================================

CREATE TABLE IF NOT EXISTS "in_app_notifications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" VARCHAR(60) NOT NULL,
  "title" VARCHAR(180) NOT NULL,
  "body" TEXT,
  "link_path" VARCHAR(300),
  "read_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_in_app_notifications_organization" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_in_app_notifications_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "in_app_notifications_user_org_created_idx"
  ON "in_app_notifications"("user_id", "organization_id", "created_at" DESC);

-- Índice parcial para contagem rápida de não-lidas.
CREATE INDEX IF NOT EXISTS "in_app_notifications_unread_idx"
  ON "in_app_notifications"("user_id", "organization_id")
  WHERE "read_at" IS NULL;

ALTER TABLE "in_app_notifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "in_app_notifications" FORCE ROW LEVEL SECURITY;

-- Idempotência: dropar policies antes de recriar.
DROP POLICY IF EXISTS "in_app_notifications_select_own" ON "in_app_notifications";
DROP POLICY IF EXISTS "in_app_notifications_update_own" ON "in_app_notifications";
DROP POLICY IF EXISTS "in_app_notifications_delete_own" ON "in_app_notifications";
DROP POLICY IF EXISTS "in_app_notifications_insert_tenant" ON "in_app_notifications";

-- SELECT: apenas as próprias notificações, dentro da org atual.
CREATE POLICY "in_app_notifications_select_own" ON "in_app_notifications"
  FOR SELECT
  USING (
    (
      "organization_id" = current_setting('app.current_org', true)::uuid
      AND "user_id" = public.current_user_id()
    )
    OR public.is_super_admin()
  );

-- UPDATE (marcar como lida): apenas as próprias.
CREATE POLICY "in_app_notifications_update_own" ON "in_app_notifications"
  FOR UPDATE
  USING (
    "organization_id" = current_setting('app.current_org', true)::uuid
    AND "user_id" = public.current_user_id()
  )
  WITH CHECK (
    "organization_id" = current_setting('app.current_org', true)::uuid
    AND "user_id" = public.current_user_id()
  );

-- DELETE (descartar): apenas as próprias.
CREATE POLICY "in_app_notifications_delete_own" ON "in_app_notifications"
  FOR DELETE
  USING (
    "organization_id" = current_setting('app.current_org', true)::uuid
    AND "user_id" = public.current_user_id()
  );

-- INSERT: tenant-scoped (mesmo padrão de appointments). Produtores garantem
-- organization_id correto. Super admin também permitido.
CREATE POLICY "in_app_notifications_insert_tenant" ON "in_app_notifications"
  FOR INSERT
  WITH CHECK (
    "organization_id" = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );

COMMENT ON TABLE "in_app_notifications" IS
  'Notificações in-app (sino do topbar). Tenant + user scoped. Leitura/edição apenas do próprio usuário.';

-- Sanity check.
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'in_app_notifications';
  IF cnt < 4 THEN
    RAISE WARNING 'Esperava >= 4 policies em in_app_notifications, achei %', cnt;
  END IF;
END$$;
