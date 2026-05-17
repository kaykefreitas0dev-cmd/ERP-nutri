-- =====================================================================
-- S13 — User Health Check-ins + Streaks (User-scoped, Lock 6)
-- =====================================================================
-- check-ins diários do paciente: humor, água, peso, energia
-- Streak: dias consecutivos com check-in
-- RLS: usuário só vê os próprios check-ins (auth.uid() = user_id)
-- =====================================================================

CREATE TABLE IF NOT EXISTS "user_health_checkins" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "checkin_date" DATE NOT NULL,
  "mood" SMALLINT CHECK ("mood" IS NULL OR ("mood" >= 1 AND "mood" <= 5)),
  "energy_level" SMALLINT CHECK ("energy_level" IS NULL OR ("energy_level" >= 1 AND "energy_level" <= 5)),
  "hunger_level" SMALLINT CHECK ("hunger_level" IS NULL OR ("hunger_level" >= 1 AND "hunger_level" <= 5)),
  "water_ml" INTEGER CHECK ("water_ml" IS NULL OR ("water_ml" >= 0 AND "water_ml" <= 20000)),
  "weight_kg" DECIMAL(5,2) CHECK ("weight_kg" IS NULL OR ("weight_kg" >= 20 AND "weight_kg" <= 400)),
  "followed_plan" BOOLEAN,
  "notes" VARCHAR(500),
  "source" TEXT NOT NULL DEFAULT 'patient_app',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_user_checkins_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "uq_user_checkins_user_date" UNIQUE ("user_id", "checkin_date")
);

CREATE INDEX IF NOT EXISTS "user_health_checkins_user_date_idx"
  ON "user_health_checkins"("user_id", "checkin_date" DESC);

-- RLS: user-scoped (Lock 6) — cada usuário vê apenas o próprio histórico
ALTER TABLE "user_health_checkins" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_health_checkins" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_checkins_self_only" ON "user_health_checkins";
CREATE POLICY "user_checkins_self_only" ON "user_health_checkins"
  FOR ALL TO authenticated
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

-- Política adicional: nutri ligado à org do paciente pode LER (não escrever)
-- via app.current_org E patient.userId = user_health_checkins.user_id
DROP POLICY IF EXISTS "user_checkins_nutri_read" ON "user_health_checkins";
CREATE POLICY "user_checkins_nutri_read" ON "user_health_checkins"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "patients" p
      WHERE p."user_id" = "user_health_checkins"."user_id"
        AND p."organization_id" = current_setting('app.current_org', true)::uuid
    )
  );

-- =====================================================================
-- STREAKS
-- =====================================================================
CREATE TABLE IF NOT EXISTS "user_health_streaks" (
  "user_id" UUID PRIMARY KEY,
  "current_streak" INTEGER NOT NULL DEFAULT 0,
  "longest_streak" INTEGER NOT NULL DEFAULT 0,
  "last_checkin_date" DATE,
  "total_checkins" INTEGER NOT NULL DEFAULT 0,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_user_streak_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE
);

ALTER TABLE "user_health_streaks" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_health_streaks" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_streaks_self_only" ON "user_health_streaks";
CREATE POLICY "user_streaks_self_only" ON "user_health_streaks"
  FOR ALL TO authenticated
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

-- Nutri ligado à org pode ler streak também (gamificação cross-tenant)
DROP POLICY IF EXISTS "user_streaks_nutri_read" ON "user_health_streaks";
CREATE POLICY "user_streaks_nutri_read" ON "user_health_streaks"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "patients" p
      WHERE p."user_id" = "user_health_streaks"."user_id"
        AND p."organization_id" = current_setting('app.current_org', true)::uuid
    )
  );
