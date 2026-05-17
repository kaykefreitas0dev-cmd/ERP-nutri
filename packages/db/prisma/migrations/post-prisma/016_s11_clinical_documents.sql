-- =====================================================================
-- S11 — Clinical Documents: CID-10 + DocumentTemplate + ClinicalDocument
--        + DigitalSignature (Mock) + ClinicalDocumentCid (M:N)
-- =====================================================================
-- Lock 15 — ClinicalDocument: snapshot de issuer (CRN), patient (nome+CPF)
--           e PDF (hash SHA-256) — imutável após ISSUED
-- =====================================================================

-- ----- ENUMS -----
DO $$ BEGIN
  CREATE TYPE "ClinicalDocumentType" AS ENUM (
    'PLANO_ALIMENTAR', 'ATESTADO', 'RECEITA_SUPLEMENTO',
    'ENCAMINHAMENTO', 'RECIBO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ClinicalDocumentStatus" AS ENUM ('DRAFT', 'ISSUED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- TABLE cid10_codes -----
CREATE TABLE IF NOT EXISTS "cid10_codes" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL UNIQUE,
  "description" TEXT NOT NULL,
  "category" TEXT,
  "is_common_in_nutrition" BOOLEAN NOT NULL DEFAULT FALSE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "cid10_codes_code_idx" ON "cid10_codes"("code");
CREATE INDEX IF NOT EXISTS "cid10_codes_is_common_in_nutrition_idx"
  ON "cid10_codes"("is_common_in_nutrition");

-- CID-10 é dado público — RLS desabilitado, qualquer authenticated lê
ALTER TABLE "cid10_codes" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cid10_codes_select_all" ON "cid10_codes";
CREATE POLICY "cid10_codes_select_all" ON "cid10_codes"
  FOR SELECT TO authenticated USING (true);

-- ----- TABLE document_templates -----
CREATE TABLE IF NOT EXISTS "document_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "document_type" "ClinicalDocumentType" NOT NULL,
  "name" TEXT NOT NULL,
  "body_markdown" TEXT NOT NULL,
  "is_shared" BOOLEAN NOT NULL DEFAULT FALSE,
  "usage_count" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_doc_tpl_org" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_doc_tpl_user" FOREIGN KEY ("created_by_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "document_templates_org_type_idx"
  ON "document_templates"("organization_id", "document_type");

ALTER TABLE "document_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "document_templates" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "document_templates_tenant_isolation" ON "document_templates";
CREATE POLICY "document_templates_tenant_isolation" ON "document_templates"
  FOR ALL TO authenticated
  USING ("organization_id" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organization_id" = current_setting('app.current_org', true)::uuid);

-- ----- TABLE clinical_documents -----
CREATE TABLE IF NOT EXISTS "clinical_documents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "issued_by_user_id" UUID NOT NULL,
  "document_type" "ClinicalDocumentType" NOT NULL,
  "title" TEXT NOT NULL,
  "body_markdown" TEXT NOT NULL,
  "issuer_name" TEXT NOT NULL,
  "issuer_crn" TEXT,
  "issuer_crn_uf" CHAR(2),
  "patient_name_snapshot" TEXT NOT NULL,
  "patient_cpf_snapshot" VARCHAR(14),
  "valid_until" DATE,
  "pdf_storage_key" TEXT,
  "pdf_hash" TEXT,
  "pdf_generated_at" TIMESTAMPTZ,
  "meal_plan_id" UUID,
  "appointment_id" UUID,
  "status" "ClinicalDocumentStatus" NOT NULL DEFAULT 'DRAFT',
  "issued_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "revoked_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_clin_doc_org" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_clin_doc_patient" FOREIGN KEY ("patient_id")
    REFERENCES "patients"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_clin_doc_user" FOREIGN KEY ("issued_by_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_clin_doc_meal_plan" FOREIGN KEY ("meal_plan_id")
    REFERENCES "meal_plans"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "clinical_documents_org_patient_created_idx"
  ON "clinical_documents"("organization_id", "patient_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "clinical_documents_user_type_idx"
  ON "clinical_documents"("issued_by_user_id", "document_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "clinical_documents_status_issued_idx"
  ON "clinical_documents"("status", "issued_at");

ALTER TABLE "clinical_documents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_documents" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_documents_tenant_isolation" ON "clinical_documents";
CREATE POLICY "clinical_documents_tenant_isolation" ON "clinical_documents"
  FOR ALL TO authenticated
  USING ("organization_id" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organization_id" = current_setting('app.current_org', true)::uuid);

-- ----- TABLE clinical_document_cids (M:N) -----
CREATE TABLE IF NOT EXISTS "clinical_document_cids" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "cid_id" UUID NOT NULL,

  CONSTRAINT "fk_cdc_doc" FOREIGN KEY ("document_id")
    REFERENCES "clinical_documents"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_cdc_cid" FOREIGN KEY ("cid_id")
    REFERENCES "cid10_codes"("id") ON DELETE RESTRICT,
  CONSTRAINT "uq_cdc_doc_cid" UNIQUE ("document_id", "cid_id")
);

CREATE INDEX IF NOT EXISTS "clinical_document_cids_doc_idx"
  ON "clinical_document_cids"("document_id");

ALTER TABLE "clinical_document_cids" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clinical_document_cids" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_document_cids_tenant_isolation"
  ON "clinical_document_cids";
CREATE POLICY "clinical_document_cids_tenant_isolation"
  ON "clinical_document_cids"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "clinical_document_cids"."document_id"
      AND d."organization_id" = current_setting('app.current_org', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "clinical_document_cids"."document_id"
      AND d."organization_id" = current_setting('app.current_org', true)::uuid
  ));

-- ----- TABLE digital_signatures (Mock no MVP) -----
CREATE TABLE IF NOT EXISTS "digital_signatures" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL UNIQUE,
  "signature_value" TEXT NOT NULL,
  "signed_at" TIMESTAMPTZ NOT NULL,
  "signer_name" TEXT NOT NULL,
  "signer_crn" TEXT,
  "signer_crn_uf" CHAR(2),
  "algorithm" TEXT NOT NULL DEFAULT 'SHA256-MOCK',
  "cert_thumbprint" TEXT,

  CONSTRAINT "fk_sig_doc" FOREIGN KEY ("document_id")
    REFERENCES "clinical_documents"("id") ON DELETE CASCADE
);

ALTER TABLE "digital_signatures" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "digital_signatures" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "digital_signatures_tenant_isolation" ON "digital_signatures";
CREATE POLICY "digital_signatures_tenant_isolation" ON "digital_signatures"
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "digital_signatures"."document_id"
      AND d."organization_id" = current_setting('app.current_org', true)::uuid
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM "clinical_documents" d
    WHERE d."id" = "digital_signatures"."document_id"
      AND d."organization_id" = current_setting('app.current_org', true)::uuid
  ));

-- =====================================================================
-- Lock 15 — Trigger: ClinicalDocument ISSUED é imutável (apenas REVOKE)
-- =====================================================================
CREATE OR REPLACE FUNCTION enforce_clinical_document_immutability()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" = 'ISSUED' AND NEW."status" NOT IN ('ISSUED', 'REVOKED') THEN
    RAISE EXCEPTION 'ClinicalDocument % is ISSUED and cannot transition to %',
      OLD."id", NEW."status";
  END IF;

  IF OLD."status" = 'ISSUED' AND (
    OLD."body_markdown" <> NEW."body_markdown" OR
    OLD."pdf_hash" IS DISTINCT FROM NEW."pdf_hash" OR
    OLD."issuer_crn" IS DISTINCT FROM NEW."issuer_crn" OR
    OLD."patient_name_snapshot" <> NEW."patient_name_snapshot"
  ) THEN
    RAISE EXCEPTION 'ClinicalDocument % is ISSUED — content/issuer/patient snapshot is immutable',
      OLD."id";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "trg_clinical_doc_immutability" ON "clinical_documents";
CREATE TRIGGER "trg_clinical_doc_immutability"
  BEFORE UPDATE ON "clinical_documents"
  FOR EACH ROW EXECUTE FUNCTION enforce_clinical_document_immutability();

-- =====================================================================
-- STORAGE BUCKET: clinical-documents (privado, RLS por org/path)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-documents', 'clinical-documents', false,
  10485760, -- 10 MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy: service_role bypassa (usado pelo backend para upload/download)
-- authenticated NÃO acessa diretamente — backend faz proxy via Route Handler
-- /api/v1/documents/[id]/pdf
DROP POLICY IF EXISTS "clinical_documents_storage_admin_only"
  ON storage.objects;
CREATE POLICY "clinical_documents_storage_admin_only" ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'clinical-documents')
  WITH CHECK (bucket_id = 'clinical-documents');

-- =====================================================================
-- SEED CID-10 (subset relevante para nutrição clínica — 60 códigos)
-- =====================================================================
INSERT INTO "cid10_codes" ("code", "description", "category", "is_common_in_nutrition") VALUES
-- Obesidade e sobrepeso
('E66.0', 'Obesidade devida a excesso de calorias', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E66.1', 'Obesidade induzida por drogas', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E66.2', 'Obesidade extrema com hipoventilação alveolar', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E66.8', 'Outra obesidade', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E66.9', 'Obesidade não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E68', 'Seqüelas de hiperalimentação', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),

-- Diabetes mellitus
('E10.9', 'Diabetes mellitus tipo 1 sem complicações', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E11.9', 'Diabetes mellitus tipo 2 sem complicações', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E11.65', 'Diabetes mellitus tipo 2 com hiperglicemia', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E13.9', 'Outros tipos especificados de diabetes mellitus', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E14.9', 'Diabetes mellitus não especificado, sem complicações', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('R73.0', 'Anormalidades do teste de tolerância à glicose', 'Sintomas e sinais', TRUE),

-- Desnutrição
('E40', 'Kwashiorkor', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E41', 'Marasmo nutricional', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E43', 'Desnutrição protéico-calórica grave não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E44.0', 'Desnutrição protéico-calórica moderada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E44.1', 'Desnutrição protéico-calórica leve', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E46', 'Desnutrição protéico-calórica não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),

-- Carências vitamínicas / minerais
('E50.9', 'Deficiência de vitamina A não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E51.9', 'Deficiência de tiamina (B1) não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E53.8', 'Deficiência de outras vitaminas do complexo B', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E55.9', 'Deficiência de vitamina D, não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E56.9', 'Deficiência vitamínica não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E58', 'Deficiência alimentar de cálcio', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E59', 'Deficiência alimentar de selênio', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E60', 'Deficiência alimentar de zinco', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E61.1', 'Deficiência de ferro', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('D50.9', 'Anemia por deficiência de ferro não especificada', 'Doenças do sangue', TRUE),
('D51.9', 'Anemia por deficiência de vitamina B12 não especificada', 'Doenças do sangue', TRUE),
('D52.9', 'Anemia por deficiência de folato não especificada', 'Doenças do sangue', TRUE),

-- Dislipidemias e cardiovascular
('E78.0', 'Hipercolesterolemia pura', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E78.1', 'Hipergliceridemia pura', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E78.2', 'Hiperlipidemia mista', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('E78.5', 'Hiperlipidemia não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('I10', 'Hipertensão essencial (primária)', 'Doenças do aparelho circulatório', TRUE),

-- Distúrbios alimentares
('F50.0', 'Anorexia nervosa', 'Transtornos mentais e comportamentais', TRUE),
('F50.2', 'Bulimia nervosa', 'Transtornos mentais e comportamentais', TRUE),
('F50.8', 'Outros transtornos da alimentação', 'Transtornos mentais e comportamentais', TRUE),
('F50.9', 'Transtorno da alimentação não especificado', 'Transtornos mentais e comportamentais', TRUE),

-- Intolerâncias e alergias
('K90.0', 'Doença celíaca', 'Aparelho digestivo', TRUE),
('E73.9', 'Intolerância à lactose, não especificada', 'Doenças endócrinas, nutricionais e metabólicas', TRUE),
('K59.0', 'Constipação', 'Aparelho digestivo', TRUE),
('K58.9', 'Síndrome do colon irritável sem diarréia', 'Aparelho digestivo', TRUE),
('K21.9', 'Doença de refluxo gastroesofágico sem esofagite', 'Aparelho digestivo', TRUE),
('K29.7', 'Gastrite não especificada', 'Aparelho digestivo', TRUE),
('K57.30', 'Diverticulose do cólon sem perfuração nem abcesso', 'Aparelho digestivo', TRUE),
('T78.1', 'Outras reações de intolerância alimentar não classificadas', 'Lesões e envenenamentos', TRUE),

-- Renais
('N18.9', 'Doença renal crônica não especificada', 'Aparelho geniturinário', TRUE),
('N18.1', 'Doença renal crônica estágio 1', 'Aparelho geniturinário', TRUE),
('N18.2', 'Doença renal crônica estágio 2', 'Aparelho geniturinário', TRUE),
('N18.3', 'Doença renal crônica estágio 3', 'Aparelho geniturinário', TRUE),
('N18.4', 'Doença renal crônica estágio 4', 'Aparelho geniturinário', TRUE),
('N18.5', 'Doença renal crônica estágio 5', 'Aparelho geniturinário', TRUE),

-- Hepáticas
('K76.0', 'Degeneração gordurosa do fígado não classificada em outra parte', 'Aparelho digestivo', TRUE),
('K73.9', 'Hepatite crônica não especificada', 'Aparelho digestivo', FALSE),

-- Gestação
('Z33', 'Estado de gravidez, incidental', 'Fatores que influenciam estado de saúde', TRUE),
('O25', 'Desnutrição na gravidez', 'Gravidez, parto e puerpério', TRUE),

-- Encaminhamento genérico
('Z71.3', 'Aconselhamento e supervisão dietéticos', 'Fatores que influenciam estado de saúde', TRUE),
('Z72.4', 'Dieta e hábitos alimentares inadequados', 'Fatores que influenciam estado de saúde', TRUE),
('Z02.0', 'Exame para admissão em escolas', 'Fatores que influenciam estado de saúde', FALSE),
('Z00.0', 'Exame médico geral', 'Fatores que influenciam estado de saúde', FALSE)
ON CONFLICT ("code") DO UPDATE SET
  "description" = EXCLUDED."description",
  "category" = EXCLUDED."category",
  "is_common_in_nutrition" = EXCLUDED."is_common_in_nutrition";
