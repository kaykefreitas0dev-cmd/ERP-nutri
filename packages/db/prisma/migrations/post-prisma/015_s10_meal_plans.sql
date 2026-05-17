-- ============================================================
-- 015 — S10: Meal Plans + RLS + Lock 15 (foodId snapshot)
-- ============================================================

DO $do$ BEGIN
  CREATE TYPE "MealPlanStatus" AS ENUM ('DRAFT','ACTIVE','COMPLETED','REPLACED','ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null;
END $do$;

CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  prescribed_by_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  status "MealPlanStatus" NOT NULL DEFAULT 'DRAFT',
  target_kcal DECIMAL(7,1),
  target_protein_g DECIMAL(7,2),
  target_carb_g DECIMAL(7,2),
  target_fat_g DECIMAL(7,2),
  total_cost_cents INTEGER,
  cost_calculated_at TIMESTAMP(3),
  version INTEGER NOT NULL DEFAULT 1,
  superseded_by_id UUID,
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mp_org_patient_status_idx ON meal_plans(organization_id, patient_id, status);
CREATE INDEX IF NOT EXISTS mp_prescribed_idx ON meal_plans(prescribed_by_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS meal_plan_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  day_label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mpd_plan_idx ON meal_plan_days(meal_plan_id);

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_day_id UUID NOT NULL REFERENCES meal_plan_days(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  scheduled_time TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS meals_day_idx ON meals(meal_plan_day_id);

CREATE TABLE IF NOT EXISTS meal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  food_version INTEGER NOT NULL,
  quantity_g DECIMAL(8,2) NOT NULL,
  preparation_notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  kcal DECIMAL(7,2),
  protein_g DECIMAL(6,2),
  carb_g DECIMAL(6,2),
  fat_g DECIMAL(6,2)
);
CREATE INDEX IF NOT EXISTS mi_meal_idx ON meal_items(meal_id);

CREATE TABLE IF NOT EXISTS meal_plan_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  created_by_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  target_kcal DECIMAL(7,1),
  structure JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mpt_org_name_idx ON meal_plan_templates(organization_id, name);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans FORCE ROW LEVEL SECURITY;

ALTER TABLE meal_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_days FORCE ROW LEVEL SECURITY;

ALTER TABLE meals ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals FORCE ROW LEVEL SECURITY;

ALTER TABLE meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_items FORCE ROW LEVEL SECURITY;

ALTER TABLE meal_plan_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_templates FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'meal_plans', 'meal_plan_days', 'meals', 'meal_items', 'meal_plan_templates'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

CREATE POLICY meal_plans_tenant ON meal_plans
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Child tables herdam tenant via meal_plan_id JOIN
CREATE POLICY meal_plan_days_tenant ON meal_plan_days
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_days.meal_plan_id
        AND (mp.organization_id = current_setting('app.current_org', true)::uuid OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_days.meal_plan_id
        AND mp.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

CREATE POLICY meals_tenant ON meals
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM meal_plan_days mpd
      JOIN meal_plans mp ON mp.id = mpd.meal_plan_id
      WHERE mpd.id = meals.meal_plan_day_id
        AND (mp.organization_id = current_setting('app.current_org', true)::uuid OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plan_days mpd
      JOIN meal_plans mp ON mp.id = mpd.meal_plan_id
      WHERE mpd.id = meals.meal_plan_day_id
        AND mp.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

CREATE POLICY meal_items_tenant ON meal_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN meal_plan_days mpd ON mpd.id = m.meal_plan_day_id
      JOIN meal_plans mp ON mp.id = mpd.meal_plan_id
      WHERE m.id = meal_items.meal_id
        AND (mp.organization_id = current_setting('app.current_org', true)::uuid OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meals m
      JOIN meal_plan_days mpd ON mpd.id = m.meal_plan_day_id
      JOIN meal_plans mp ON mp.id = mpd.meal_plan_id
      WHERE m.id = meal_items.meal_id
        AND mp.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

CREATE POLICY meal_plan_templates_tenant ON meal_plan_templates
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR (is_public = true)
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);
