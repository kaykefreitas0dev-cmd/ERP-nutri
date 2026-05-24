-- =====================================================================
-- 025 — QA Rodada 4: RLS hardening estendido
-- =====================================================================
-- Continuação da migration 024. Cobre policies remanescentes que ainda
-- usam `TO authenticated` (incompatível com Prisma postgres role + FORCE
-- RLS) ou cast direto de current_setting (vulnerável a 22P02 quando GUC
-- empty).
--
-- Tabelas cobertas:
--   - clinical_documents
--   - clinical_document_cids
--   - digital_signatures
--   - document_templates
--   - cid10_codes (read-only public — mantém TO authenticated)
-- =====================================================================

-- ---------------------------------------------------------------------
-- clinical_documents — tenant isolation universal (sem TO authenticated)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "clinical_documents_tenant_isolation"
  ON "clinical_documents";
CREATE POLICY "clinical_documents_tenant_isolation" ON "clinical_documents"
  FOR ALL
  USING (
    "organization_id" = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    "organization_id" = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- clinical_document_cids — herda via JOIN, sem TO authenticated
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "clinical_document_cids_tenant_isolation"
  ON "clinical_document_cids";
CREATE POLICY "clinical_document_cids_tenant_isolation"
  ON "clinical_document_cids"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "clinical_document_cids"."document_id"
      AND (d."organization_id" = public.current_org_id() OR public.is_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "clinical_document_cids"."document_id"
      AND d."organization_id" = public.current_org_id()
  ));

-- ---------------------------------------------------------------------
-- digital_signatures — herda via JOIN, sem TO authenticated
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "digital_signatures_tenant_isolation"
  ON "digital_signatures";
CREATE POLICY "digital_signatures_tenant_isolation" ON "digital_signatures"
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "digital_signatures"."document_id"
      AND (d."organization_id" = public.current_org_id() OR public.is_super_admin())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "digital_signatures"."document_id"
      AND d."organization_id" = public.current_org_id()
  ));

-- ---------------------------------------------------------------------
-- document_templates — tenant isolation universal
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "document_templates_tenant_isolation"
  ON "document_templates";
CREATE POLICY "document_templates_tenant_isolation" ON "document_templates"
  FOR ALL
  USING (
    "organization_id" = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    "organization_id" = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- cid10_codes — mantém leitura pública mas SEM restrição de role
-- (qualquer authenticated/postgres role lê; modificação só super_admin)
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS "cid10_codes_select_all" ON "cid10_codes";
CREATE POLICY "cid10_codes_select_all" ON "cid10_codes"
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "cid10_codes_admin_modify" ON "cid10_codes";
CREATE POLICY "cid10_codes_admin_modify" ON "cid10_codes"
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ---------------------------------------------------------------------
-- Migrações 011-015 (anthropometry, agenda, food, meal_plans) usam
-- cast direto current_setting('app.current_org', true)::uuid. Em
-- condição normal funciona, mas se um caller esquecer SET LOCAL e o GUC
-- ficar empty string, joga 22P02. Para defensive coding, substituir
-- por public.current_org_id() (NULLIF empty → NULL, comparado a UUID
-- retorna NULL = false, query retorna 0 rows graciosamente).
-- ---------------------------------------------------------------------

-- anthropometry
DROP POLICY IF EXISTS anthropometry_tenant ON anthropometry;
CREATE POLICY anthropometry_tenant ON anthropometry
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- meal_plans
DROP POLICY IF EXISTS meal_plans_tenant ON meal_plans;
CREATE POLICY meal_plans_tenant ON meal_plans
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- meal_plan_templates
DROP POLICY IF EXISTS meal_plan_templates_tenant ON meal_plan_templates;
CREATE POLICY meal_plan_templates_tenant ON meal_plan_templates
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR is_public = true
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- appointments
DROP POLICY IF EXISTS appointments_tenant ON appointments;
CREATE POLICY appointments_tenant ON appointments
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- booking_pages tenant_modify
DROP POLICY IF EXISTS booking_pages_tenant_modify ON booking_pages;
CREATE POLICY booking_pages_tenant_modify ON booking_pages
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- service_offerings tenant
DROP POLICY IF EXISTS service_offerings_tenant ON service_offerings;
CREATE POLICY service_offerings_tenant ON service_offerings
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- availability_rules tenant
DROP POLICY IF EXISTS availability_tenant ON availability_rules;
CREATE POLICY availability_tenant ON availability_rules
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- calendar_busy_blocks
DROP POLICY IF EXISTS busy_blocks_tenant ON calendar_busy_blocks;
CREATE POLICY busy_blocks_tenant ON calendar_busy_blocks
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- external_calendar_connections (user-scoped + tenant)
DROP POLICY IF EXISTS external_cal_self_only ON external_calendar_connections;
CREATE POLICY external_cal_self_only ON external_calendar_connections
  FOR ALL
  USING (
    (user_id = COALESCE(public.current_user_id(), auth.uid())
      AND organization_id = public.current_org_id())
    OR public.is_super_admin()
  )
  WITH CHECK (
    user_id = COALESCE(public.current_user_id(), auth.uid())
    AND organization_id = public.current_org_id()
  );

-- foods / food_prices / recipes / recipe_ingredients
DROP POLICY IF EXISTS foods_read ON foods;
CREATE POLICY foods_read ON foods
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = public.current_org_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS foods_org_modify ON foods;
CREATE POLICY foods_org_modify ON foods
  FOR INSERT
  WITH CHECK (
    organization_id = public.current_org_id()
    OR (organization_id IS NULL AND public.is_super_admin())
  );

DROP POLICY IF EXISTS foods_org_update ON foods;
CREATE POLICY foods_org_update ON foods
  FOR UPDATE
  USING (organization_id = public.current_org_id() OR public.is_super_admin())
  WITH CHECK (organization_id = public.current_org_id());

DROP POLICY IF EXISTS food_prices_read ON food_prices;
CREATE POLICY food_prices_read ON food_prices
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = public.current_org_id()
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS food_prices_tenant_modify ON food_prices;
CREATE POLICY food_prices_tenant_modify ON food_prices
  FOR ALL
  USING (organization_id = public.current_org_id())
  WITH CHECK (organization_id = public.current_org_id());

DROP POLICY IF EXISTS recipes_tenant ON recipes;
CREATE POLICY recipes_tenant ON recipes
  FOR ALL
  USING (
    organization_id = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = public.current_org_id());

-- ---------------------------------------------------------------------
-- Comentários de auditoria
-- ---------------------------------------------------------------------
COMMENT ON POLICY clinical_documents_tenant_isolation ON clinical_documents IS
  'QA Rodada 4: substituiu TO authenticated por aplicação universal + current_org_id() helper.';
