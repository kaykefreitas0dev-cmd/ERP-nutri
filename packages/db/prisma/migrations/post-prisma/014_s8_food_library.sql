-- ============================================================
-- 014 — S8: Food Library + Recipes + Prices + RLS
-- ============================================================

DO $do$ BEGIN
  CREATE TYPE "FoodSource" AS ENUM ('TACO','POF','USDA','CUSTOM');
EXCEPTION WHEN duplicate_object THEN null;
END $do$;

DO $do$ BEGIN
  CREATE TYPE "PriceUnit" AS ENUM ('KG','G','L','ML','UNIT','DUZIA');
EXCEPTION WHEN duplicate_object THEN null;
END $do$;

CREATE TABLE IF NOT EXISTS foods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  source "FoodSource" NOT NULL DEFAULT 'CUSTOM',
  external_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  brand TEXT,
  category TEXT,
  kcal_per_100g DECIMAL(7,2),
  protein_g DECIMAL(6,2),
  carb_g DECIMAL(6,2),
  fat_g DECIMAL(6,2),
  fiber_g DECIMAL(6,2),
  sodium_mg DECIMAL(7,2),
  micronutrients JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  superseded_by_id UUID,
  superseded_at TIMESTAMP(3),
  conversion_factor DECIMAL(4,3),
  cooking_index DECIMAL(4,3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS foods_source_external_idx ON foods(source, external_id);
CREATE INDEX IF NOT EXISTS foods_name_idx ON foods(name);
CREATE INDEX IF NOT EXISTS foods_org_active_idx ON foods(organization_id, is_active);

-- Full-text search index (Postgres FTS)
ALTER TABLE foods ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce(name, '') || ' ' || coalesce(description, ''))) STORED;
CREATE INDEX IF NOT EXISTS foods_search_idx ON foods USING gin(search_vector);

CREATE TABLE IF NOT EXISTS food_allergens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  allergen_id UUID NOT NULL REFERENCES allergens(id) ON DELETE CASCADE,
  trace BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  UNIQUE(food_id, allergen_id)
);

CREATE TABLE IF NOT EXISTS food_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE CASCADE,
  organization_id UUID,
  professional_user_id UUID,
  unit "PriceUnit" NOT NULL,
  unit_grams DECIMAL(10,3),
  price_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  source TEXT NOT NULL DEFAULT 'MANUAL',
  region TEXT,
  valid_from TIMESTAMP(3) NOT NULL DEFAULT now(),
  valid_until TIMESTAMP(3),
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS food_prices_food_org_valid_idx ON food_prices(food_id, organization_id, valid_from DESC);

CREATE TABLE IF NOT EXISTS recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  servings INTEGER NOT NULL DEFAULT 1,
  prep_time_minutes INTEGER,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  superseded_by_id UUID,
  superseded_at TIMESTAMP(3),
  total_kcal DECIMAL(8,2),
  total_protein_g DECIMAL(7,2),
  total_carb_g DECIMAL(7,2),
  total_fat_g DECIMAL(7,2),
  notes TEXT,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now(),
  updated_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS recipes_org_active_idx ON recipes(organization_id, is_active);
CREATE INDEX IF NOT EXISTS recipes_name_idx ON recipes(name);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES foods(id) ON DELETE RESTRICT,
  food_version INTEGER NOT NULL,
  quantity_g DECIMAL(8,2) NOT NULL,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS recipe_ingredients_recipe_idx ON recipe_ingredients(recipe_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE foods FORCE ROW LEVEL SECURITY;

ALTER TABLE food_allergens ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_prices FORCE ROW LEVEL SECURITY;

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes FORCE ROW LEVEL SECURITY;

ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients FORCE ROW LEVEL SECURITY;

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'foods', 'food_allergens', 'food_prices', 'recipes', 'recipe_ingredients'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- Foods: global (TACO/POF) lê todos; org-specific só própria org
CREATE POLICY foods_read ON foods
  FOR SELECT
  USING (
    organization_id IS NULL  -- global
    OR organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );

CREATE POLICY foods_org_modify ON foods
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.current_org', true)::uuid
    OR (organization_id IS NULL AND public.is_super_admin())
  );

CREATE POLICY foods_org_update ON foods
  FOR UPDATE
  USING (organization_id = current_setting('app.current_org', true)::uuid OR public.is_super_admin())
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Food Allergens: read público (essencial para segurança), modify org
CREATE POLICY food_allergens_read ON food_allergens
  FOR SELECT
  USING (true);

CREATE POLICY food_allergens_admin_modify ON food_allergens
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Food Prices: read tenant + global; modify tenant
CREATE POLICY food_prices_read ON food_prices
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );

CREATE POLICY food_prices_tenant_modify ON food_prices
  FOR ALL
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Recipes: tenant only
CREATE POLICY recipes_tenant ON recipes
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Recipe Ingredients: herda do recipe
CREATE POLICY recipe_ingredients_tenant ON recipe_ingredients
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id
        AND (r.organization_id = current_setting('app.current_org', true)::uuid OR public.is_super_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM recipes r
      WHERE r.id = recipe_ingredients.recipe_id
        AND r.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

-- ============================================================
-- Lock 15 trigger: ao update Food, criar nova versão (não destrutiva)
-- ============================================================
CREATE OR REPLACE FUNCTION public.foods_version_on_nutrition_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Se algum macronutriente mudou, marcar antigo como superseded + criar novo
  -- Para simplicidade MVP, apenas log + version increment via app-layer
  -- Esta função é placeholder; lógica completa em packages/db
  IF NEW.kcal_per_100g IS DISTINCT FROM OLD.kcal_per_100g
     OR NEW.protein_g IS DISTINCT FROM OLD.protein_g
     OR NEW.carb_g IS DISTINCT FROM OLD.carb_g
     OR NEW.fat_g IS DISTINCT FROM OLD.fat_g THEN
    NEW.version := OLD.version + 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS foods_version_trigger ON foods;
CREATE TRIGGER foods_version_trigger
  BEFORE UPDATE ON foods
  FOR EACH ROW EXECUTE FUNCTION public.foods_version_on_nutrition_change();
