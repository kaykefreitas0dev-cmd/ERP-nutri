-- =====================================================================
-- 027 — Metas do paciente + tracking
-- =====================================================================
-- Metas clínicas/comportamentais com valor inicial → alvo → atual.
-- Tenant-scoped (gerida pela equipe da org, como antropometria).
-- type/direction/status validados por CHECK no DB + Zod na aplicação
-- (sem tipos ENUM nativos pra simplificar migração manual).
-- =====================================================================

CREATE TABLE IF NOT EXISTS "patient_goals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "type" VARCHAR(20) NOT NULL DEFAULT 'OTHER',
  "direction" VARCHAR(20) NOT NULL DEFAULT 'DECREASE',
  "start_value" NUMERIC(10, 2),
  "target_value" NUMERIC(10, 2),
  "current_value" NUMERIC(10, 2),
  "unit" VARCHAR(20),
  "due_date" DATE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "achieved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "patient_goals_type_check" CHECK (
    "type" IN ('WEIGHT', 'BODY_FAT', 'MEASUREMENT', 'HABIT', 'PERFORMANCE', 'OTHER')
  ),
  CONSTRAINT "patient_goals_direction_check" CHECK (
    "direction" IN ('DECREASE', 'INCREASE', 'MAINTAIN')
  ),
  CONSTRAINT "patient_goals_status_check" CHECK (
    "status" IN ('ACTIVE', 'ACHIEVED', 'ABANDONED')
  ),
  CONSTRAINT "fk_patient_goals_organization" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_patient_goals_patient" FOREIGN KEY ("patient_id")
    REFERENCES "patients"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_patient_goals_user" FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "patient_goals_patient_status_idx"
  ON "patient_goals"("patient_id", "status");

CREATE INDEX IF NOT EXISTS "patient_goals_org_created_idx"
  ON "patient_goals"("organization_id", "created_at" DESC);

ALTER TABLE "patient_goals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_goals" FORCE ROW LEVEL SECURITY;

-- Tenant isolation (mesmo padrão de anthropometry/appointments).
DROP POLICY IF EXISTS "patient_goals_tenant" ON "patient_goals";
CREATE POLICY "patient_goals_tenant" ON "patient_goals"
  FOR ALL
  USING (
    "organization_id" = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    "organization_id" = public.current_org_id()
  );

COMMENT ON TABLE "patient_goals" IS
  'Metas do paciente (peso, %GC, hábitos…) com tracking de progresso. Tenant-scoped.';

-- Sanity check.
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT count(*) INTO cnt
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'patient_goals';
  IF cnt < 1 THEN
    RAISE WARNING 'Esperava >= 1 policy em patient_goals, achei %', cnt;
  END IF;
END$$;
