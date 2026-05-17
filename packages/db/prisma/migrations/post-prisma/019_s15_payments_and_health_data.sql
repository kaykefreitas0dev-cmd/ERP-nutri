-- =====================================================================
-- S15a — PatientPayment (EXTERNAL_RECORDED only) + HealthDataPoint stub
-- =====================================================================
-- MVP: cobrança externa pelo nutri, plataforma só registra (Lock 14 + v11.2 Diff 5)
-- Asaas real virá em S22 (após avaliação regulatória BaaS)
-- HealthDataPoint stub: tabela + RLS, sem workers/OAuth/UI (Lock 3)
-- =====================================================================

-- ----- ENUMS -----
DO $$ BEGIN
  CREATE TYPE "PatientPaymentStatus" AS ENUM (
    'EXTERNAL_RECORDED', 'PENDING', 'PAID', 'REFUNDED', 'CANCELLED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExternalPaymentMethod" AS ENUM (
    'PIX', 'CARD_EXTERNAL', 'CASH', 'BANK_TRANSFER', 'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- TABLE patient_payments -----
CREATE TABLE IF NOT EXISTS "patient_payments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "recorded_by_user_id" UUID NOT NULL,
  "appointment_id" UUID,

  "amount_cents" INTEGER NOT NULL CHECK ("amount_cents" >= 0 AND "amount_cents" <= 10000000),
  "currency" TEXT NOT NULL DEFAULT 'BRL',
  "status" "PatientPaymentStatus" NOT NULL DEFAULT 'EXTERNAL_RECORDED',

  "external_payment_method" "ExternalPaymentMethod",
  "external_reference" TEXT,
  "paid_at" TIMESTAMPTZ,
  "payment_date" DATE NOT NULL,

  "description" TEXT,
  "receipt_document_id" UUID,

  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_payment_org" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_payment_patient" FOREIGN KEY ("patient_id")
    REFERENCES "patients"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_payment_user" FOREIGN KEY ("recorded_by_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "fk_payment_appointment" FOREIGN KEY ("appointment_id")
    REFERENCES "appointments"("id") ON DELETE SET NULL,
  CONSTRAINT "fk_payment_receipt" FOREIGN KEY ("receipt_document_id")
    REFERENCES "clinical_documents"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "patient_payments_org_patient_date_idx"
  ON "patient_payments"("organization_id", "patient_id", "payment_date" DESC);
CREATE INDEX IF NOT EXISTS "patient_payments_org_date_idx"
  ON "patient_payments"("organization_id", "payment_date" DESC);
CREATE INDEX IF NOT EXISTS "patient_payments_appointment_idx"
  ON "patient_payments"("appointment_id");

-- RLS tenant
ALTER TABLE "patient_payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_payments" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_payments_tenant_isolation" ON "patient_payments";
CREATE POLICY "patient_payments_tenant_isolation" ON "patient_payments"
  FOR ALL TO authenticated
  USING ("organization_id" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organization_id" = current_setting('app.current_org', true)::uuid);

-- =====================================================================
-- HEALTH DATA POINT (stub Lock 3)
-- =====================================================================
CREATE TABLE IF NOT EXISTS "health_data_points" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "metric_type" TEXT NOT NULL,
  "value" DECIMAL(10, 2) NOT NULL,
  "unit" TEXT,
  "recorded_at" TIMESTAMPTZ NOT NULL,
  "source" TEXT NOT NULL,
  "external_id" TEXT,
  "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_hdp_user" FOREIGN KEY ("user_id")
    REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "uq_hdp_user_source_extid" UNIQUE ("user_id", "source", "external_id")
);

CREATE INDEX IF NOT EXISTS "health_data_points_user_metric_recorded_idx"
  ON "health_data_points"("user_id", "metric_type", "recorded_at" DESC);

ALTER TABLE "health_data_points" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "health_data_points" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_data_points_self_only" ON "health_data_points";
CREATE POLICY "health_data_points_self_only" ON "health_data_points"
  FOR ALL TO authenticated
  USING ("user_id" = auth.uid())
  WITH CHECK ("user_id" = auth.uid());

-- Nutri ligado pode ler (consistente com check-ins)
DROP POLICY IF EXISTS "health_data_points_nutri_read" ON "health_data_points";
CREATE POLICY "health_data_points_nutri_read" ON "health_data_points"
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "patients" p
      WHERE p."user_id" = "health_data_points"."user_id"
        AND p."organization_id" = current_setting('app.current_org', true)::uuid
    )
  );
