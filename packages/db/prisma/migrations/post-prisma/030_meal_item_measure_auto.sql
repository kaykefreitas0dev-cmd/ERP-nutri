-- =====================================================================
-- 030 — MealItem: flag household_measure_auto
-- =====================================================================
-- Marca se a medida caseira foi preenchida automaticamente (referência
-- oficial IBGE POF 2008-2009). Quando o nutri edita manualmente, vira false
-- e a coluna não é mais sobrescrita ao mudar a quantidade. Aditivo, sem RLS
-- nova (meal_items já tem RLS via 015).
-- =====================================================================

ALTER TABLE "meal_items"
  ADD COLUMN IF NOT EXISTS "household_measure_auto" BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN "meal_items"."household_measure_auto" IS
  'true = medida caseira preenchida automaticamente (POF/IBGE); false = manual.';
