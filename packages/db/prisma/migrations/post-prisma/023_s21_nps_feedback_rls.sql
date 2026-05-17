-- =====================================================================
-- S21 — NPS Feedback (beta UX privado)
-- =====================================================================
-- Coleta NPS contextual durante o beta. Tenant-scoped (RLS por org).
-- Owner/admin pode ler tudo da org; usuário lê apenas o próprio histórico
-- (evita constrangimento entre membros).
--
-- Insert: qualquer membro autenticado da org. user_id sempre = auth.uid().
-- =====================================================================

-- Tabela (espelha o modelo Prisma; CREATE IF NOT EXISTS pra idempotência)
CREATE TABLE IF NOT EXISTS "nps_feedback" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "score" INTEGER NOT NULL CHECK ("score" >= 0 AND "score" <= 10),
  "comment" TEXT,
  "context" VARCHAR(120),
  "user_agent" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_nps_organization" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_nps_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "nps_feedback_organization_id_created_at_idx"
  ON "nps_feedback"("organization_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "nps_feedback_user_id_created_at_idx"
  ON "nps_feedback"("user_id", "created_at" DESC);

ALTER TABLE "nps_feedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "nps_feedback" FORCE ROW LEVEL SECURITY;

-- SELECT próprio
DROP POLICY IF EXISTS "nps_feedback_select_own" ON "nps_feedback";
CREATE POLICY "nps_feedback_select_own" ON "nps_feedback"
  FOR SELECT TO authenticated
  USING ("user_id" = auth.uid());

-- SELECT admin/owner da org
DROP POLICY IF EXISTS "nps_feedback_select_org_admin" ON "nps_feedback"
  ;
CREATE POLICY "nps_feedback_select_org_admin" ON "nps_feedback"
  FOR SELECT TO authenticated
  USING (public.is_org_admin("organization_id"));

-- INSERT: membro ativo da org + user_id deve ser auth.uid()
DROP POLICY IF EXISTS "nps_feedback_insert_self" ON "nps_feedback";
CREATE POLICY "nps_feedback_insert_self" ON "nps_feedback"
  FOR INSERT TO authenticated
  WITH CHECK (
    "user_id" = auth.uid()
    AND EXISTS (
      SELECT 1 FROM memberships m
      WHERE m.user_id = auth.uid()
        AND m.organization_id = nps_feedback.organization_id
        AND m.status = 'ACTIVE'
    )
  );

-- UPDATE / DELETE: bloqueados (feedback é append-only durante o beta)
-- Sem policies UPDATE/DELETE → nega tudo para authenticated (com FORCE RLS).

-- Comentário pra rastreabilidade
COMMENT ON TABLE "nps_feedback" IS
  'NPS feedback do beta S21. Append-only. Visibilidade: próprio usuário + org admins.';

-- Sanity check (deve retornar 4 policies: 2 SELECT + 1 INSERT + 0 update/delete)
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'nps_feedback';
  IF cnt < 3 THEN
    RAISE WARNING 'Esperava >= 3 policies em nps_feedback, achei %', cnt;
  END IF;
END$$;
