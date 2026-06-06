-- =====================================================================
-- 029 — Diário alimentar do paciente (User-scoped, cross-tenant — Lock 6)
-- =====================================================================
-- Paciente registra o que comeu (texto livre por refeição). Nutri lê via
-- vínculo org-paciente. RLS espelha user_health_checkins (018):
--   - self_only: paciente gerencia os próprios registros (auth.uid())
--   - nutri_read: nutri da org do paciente pode LER (app.current_org)
-- =====================================================================

CREATE TABLE IF NOT EXISTS "food_diary_entries" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "entry_date" DATE NOT NULL,
  "meal_label" VARCHAR(80) NOT NULL,
  "description" VARCHAR(1000) NOT NULL,
  "followed_plan" BOOLEAN,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_food_diary_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "food_diary_entries_user_date_idx"
  ON "food_diary_entries"("user_id", "entry_date" DESC);

ALTER TABLE "food_diary_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "food_diary_entries" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "food_diary_self_only" ON "food_diary_entries";
CREATE POLICY "food_diary_self_only" ON "food_diary_entries"
  FOR ALL TO authenticated
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

DROP POLICY IF EXISTS "food_diary_nutri_read" ON "food_diary_entries";
CREATE POLICY "food_diary_nutri_read" ON "food_diary_entries"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "patients" p
      WHERE p."user_id" = "food_diary_entries"."user_id"
        AND p."organization_id" = current_setting('app.current_org', true)::uuid
    )
  );

COMMENT ON TABLE "food_diary_entries" IS
  'Diário alimentar do paciente (texto livre por refeição). User-scoped + nutri-read via org.';
