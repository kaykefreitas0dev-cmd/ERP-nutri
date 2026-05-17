-- ============================================================
-- 012 — S5: DataImport + ImportTemplate + RLS
-- ============================================================

DO $do$ BEGIN
  CREATE TYPE "ImportStatus" AS ENUM ('PENDING','MAPPING','VALIDATING','PROCESSING','COMPLETED','FAILED','ROLLED_BACK');
EXCEPTION WHEN duplicate_object THEN null;
END $do$;

CREATE TABLE IF NOT EXISTS data_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'patient',
  original_file_name TEXT NOT NULL,
  storage_path TEXT,
  file_size_bytes INTEGER NOT NULL,
  encoding TEXT NOT NULL DEFAULT 'utf-8',
  status "ImportStatus" NOT NULL DEFAULT 'PENDING',
  column_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_rows INTEGER NOT NULL DEFAULT 0,
  processed_rows INTEGER NOT NULL DEFAULT 0,
  error_rows INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMP(3),
  completed_at TIMESTAMP(3),
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS data_imports_org_status_idx ON data_imports(organization_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS import_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  source TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  name TEXT NOT NULL,
  column_mapping JSONB NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_by_user_id UUID,
  created_at TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS import_templates_org_idx ON import_templates(organization_id, source, entity_type);

ALTER TABLE data_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_imports FORCE ROW LEVEL SECURITY;

ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS data_imports_tenant ON data_imports;
CREATE POLICY data_imports_tenant ON data_imports
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Templates: org-specific OU global (organization_id IS NULL)
DROP POLICY IF EXISTS import_templates_read ON import_templates;
CREATE POLICY import_templates_read ON import_templates
  FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS import_templates_modify ON import_templates;
CREATE POLICY import_templates_modify ON import_templates
  FOR INSERT
  WITH CHECK (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS import_templates_update ON import_templates;
CREATE POLICY import_templates_update ON import_templates
  FOR UPDATE
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  );
