-- ============================================================
-- 010 — S3: RLS + policies para domínios de Paciente
-- ============================================================

-- Tenant-aware (FORCE RLS)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients FORCE ROW LEVEL SECURITY;

ALTER TABLE patient_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_allergies FORCE ROW LEVEL SECURITY;

ALTER TABLE patient_dietary_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_dietary_restrictions FORCE ROW LEVEL SECURITY;

ALTER TABLE patient_clinical_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE patient_clinical_conditions FORCE ROW LEVEL SECURITY;

ALTER TABLE clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes FORCE ROW LEVEL SECURITY;

ALTER TABLE exam_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attachments FORCE ROW LEVEL SECURITY;

-- Allergens: master list pública (read), modify só super_admin
ALTER TABLE allergens ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DROP existing policies (idempotency)
-- ============================================================
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'patients', 'patient_allergies', 'patient_dietary_restrictions',
        'patient_clinical_conditions', 'clinical_notes', 'exam_attachments',
        'allergens'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- PATIENTS: tenant isolation + ownership (Lock 6 nutri vê pacientes)
-- ============================================================
-- Default: qualquer membership na org vê pacientes da org
-- Restrições por role (own only, etc.) ficam no Casbin layer

CREATE POLICY patients_tenant_select ON patients
  FOR SELECT
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );

CREATE POLICY patients_tenant_modify ON patients
  FOR ALL
  USING (organization_id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- ============================================================
-- Child tables: herdam tenant via patient_id JOIN
-- ============================================================

CREATE POLICY patient_allergies_tenant ON patient_allergies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_allergies.patient_id
        AND p.organization_id = current_setting('app.current_org', true)::uuid
    ) OR public.is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_allergies.patient_id
        AND p.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

CREATE POLICY patient_diet_tenant ON patient_dietary_restrictions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_dietary_restrictions.patient_id
        AND p.organization_id = current_setting('app.current_org', true)::uuid
    ) OR public.is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_dietary_restrictions.patient_id
        AND p.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

CREATE POLICY patient_conditions_tenant ON patient_clinical_conditions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_clinical_conditions.patient_id
        AND p.organization_id = current_setting('app.current_org', true)::uuid
    ) OR public.is_super_admin()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM patients p
      WHERE p.id = patient_clinical_conditions.patient_id
        AND p.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

-- ClinicalNote: organization_id direto (não precisa JOIN) — performance
CREATE POLICY clinical_notes_tenant ON clinical_notes
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- ExamAttachment: idem
CREATE POLICY exam_attachments_tenant ON exam_attachments
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- ============================================================
-- ALLERGENS: read público (qualquer authenticated vê master list)
-- Modify: apenas super_admin
-- ============================================================
CREATE POLICY allergens_public_read ON allergens
  FOR SELECT
  USING (true);

CREATE POLICY allergens_admin_modify ON allergens
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
