-- =====================================================================
-- S12 — PatientInvite: convites passwordless tenant-scoped
-- =====================================================================
-- Lock 7 — Invite-Only Passwordless
-- Token bearer único hashado em DB; cliente recebe plain text 1x via URL
-- TTL: 7 dias por padrão
-- =====================================================================

CREATE TABLE IF NOT EXISTS "patient_invites" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID NOT NULL,
  "patient_id" UUID NOT NULL,
  "sent_by_user_id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "accepted_at" TIMESTAMPTZ,
  "accepted_by_user_id" UUID,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "revoked_at" TIMESTAMPTZ,
  "revoked_reason" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "fk_patient_invites_org" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_patient_invites_patient" FOREIGN KEY ("patient_id")
    REFERENCES "patients"("id") ON DELETE CASCADE,
  CONSTRAINT "fk_patient_invites_sender" FOREIGN KEY ("sent_by_user_id")
    REFERENCES "users"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "patient_invites_org_patient_created_idx"
  ON "patient_invites"("organization_id", "patient_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "patient_invites_expires_at_idx"
  ON "patient_invites"("expires_at");

-- RLS: tenant isolation
ALTER TABLE "patient_invites" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_invites" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "patient_invites_tenant_isolation" ON "patient_invites";
CREATE POLICY "patient_invites_tenant_isolation" ON "patient_invites"
  FOR ALL TO authenticated
  USING ("organization_id" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organization_id" = current_setting('app.current_org', true)::uuid);

-- Acceptance endpoint roda com service-role (bypass RLS) para poder
-- ler invite por token_hash sem precisar de org context — segurança vem
-- do próprio hash do token + expiração + atomic update accepted_at.
