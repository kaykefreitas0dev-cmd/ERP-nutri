-- =====================================================================
-- 028 — MealItem: medida caseira + nutrientes (fibra, sódio) por item
-- =====================================================================
-- household_measure: texto livre (ex: "2 col. sopa", "1 xícara") para o
-- paciente não precisar pesar. fiber_g/sodium_mg: snapshot por item (como
-- já é feito com kcal/protein/carb/fat — Lock 15). Aditivo, sem RLS nova
-- (meal_items já tem RLS via 015).
-- =====================================================================

ALTER TABLE "meal_items"
  ADD COLUMN IF NOT EXISTS "household_measure" TEXT,
  ADD COLUMN IF NOT EXISTS "fiber_g" NUMERIC(6, 2),
  -- NUMERIC(9,2): o valor é escalado (sódio/100g * quantidade/100, fator até
  -- 50). Sódio de sal/caldo é alto → 7,2 estouraria (numeric field overflow).
  ADD COLUMN IF NOT EXISTS "sodium_mg" NUMERIC(9, 2);

-- Corretivo (idempotente): se a coluna já existia como NUMERIC(7,2) de uma
-- aplicação anterior desta migração, alarga para NUMERIC(9,2).
ALTER TABLE "meal_items"
  ALTER COLUMN "sodium_mg" TYPE NUMERIC(9, 2);

COMMENT ON COLUMN "meal_items"."household_measure" IS
  'Medida caseira (ex: "2 col. sopa") — paciente não precisa pesar.';
