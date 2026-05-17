-- ============================================================
-- 013 — S6: Agenda + GiST exclusion (anti-double-booking) + RLS
-- ============================================================

-- Extensão para exclusion constraint com tstzrange overlap
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- ANTI-DOUBLE-BOOKING (Lock 14 — Postgres-enforced)
-- Constraint atômica: 1 profissional não pode ter 2 appointments
-- com tstzrange overlap (exceto CANCELLED/NO_SHOW)
-- ============================================================
ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    professional_user_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status NOT IN ('CANCELLED', 'NO_SHOW'));

-- ============================================================
-- RLS + FORCE em todas tabelas S6
-- ============================================================
ALTER TABLE booking_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pages FORCE ROW LEVEL SECURITY;

ALTER TABLE service_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_offerings FORCE ROW LEVEL SECURITY;

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments FORCE ROW LEVEL SECURITY;

ALTER TABLE appointment_status_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointment_status_events FORCE ROW LEVEL SECURITY;

ALTER TABLE external_calendar_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_calendar_connections FORCE ROW LEVEL SECURITY;

ALTER TABLE calendar_busy_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_busy_blocks FORCE ROW LEVEL SECURITY;

ALTER TABLE availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_rules FORCE ROW LEVEL SECURITY;

-- Drop existing policies (idempotency)
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN (
      'booking_pages', 'service_offerings', 'appointments',
      'appointment_status_events', 'external_calendar_connections',
      'calendar_busy_blocks', 'availability_rules'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;

-- ============================================================
-- BOOKING PAGES
-- Authenticated da org vê suas pages; público (anon) só vê isPublished
-- ============================================================
CREATE POLICY booking_pages_tenant_modify ON booking_pages
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY booking_pages_public_read ON booking_pages
  FOR SELECT
  USING (is_published = true);

-- ============================================================
-- SERVICE OFFERINGS — público se isActive E booking_page isPublished
-- ============================================================
CREATE POLICY service_offerings_tenant ON service_offerings
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

CREATE POLICY service_offerings_public_read ON service_offerings
  FOR SELECT
  USING (
    is_active = true
    AND EXISTS (
      SELECT 1 FROM booking_pages bp
      WHERE bp.id = service_offerings.booking_page_id
        AND bp.is_published = true
    )
  );

-- ============================================================
-- APPOINTMENTS — tenant isolation strict
-- ============================================================
CREATE POLICY appointments_tenant ON appointments
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Public INSERT é permitido (booking público) mas COM organization_id derivado da booking_page
-- A Server Action vai forçar organization_id correto via withTenantUnsafe ou helper.

-- ============================================================
-- APPOINTMENT STATUS EVENTS — append-only via INSERT only
-- ============================================================
CREATE POLICY status_events_tenant_read ON appointment_status_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_status_events.appointment_id
        AND (a.organization_id = current_setting('app.current_org', true)::uuid OR public.is_super_admin())
    )
  );

CREATE POLICY status_events_tenant_insert ON appointment_status_events
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_status_events.appointment_id
        AND a.organization_id = current_setting('app.current_org', true)::uuid
    )
  );

-- ============================================================
-- EXTERNAL CALENDAR CONNECTIONS — user-scoped (não cross-membership)
-- ============================================================
CREATE POLICY external_cal_self_only ON external_calendar_connections
  FOR ALL
  USING (
    (user_id = auth.uid() AND organization_id = current_setting('app.current_org', true)::uuid)
    OR public.is_super_admin()
  )
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = current_setting('app.current_org', true)::uuid
  );

-- ============================================================
-- CALENDAR BUSY BLOCKS — user-scoped (sync external + manual)
-- ============================================================
CREATE POLICY busy_blocks_tenant ON calendar_busy_blocks
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- ============================================================
-- AVAILABILITY RULES — tenant
-- ============================================================
CREATE POLICY availability_tenant ON availability_rules
  FOR ALL
  USING (
    organization_id = current_setting('app.current_org', true)::uuid
    OR public.is_super_admin()
  )
  WITH CHECK (organization_id = current_setting('app.current_org', true)::uuid);

-- Public read para booking page calcular disponibilidade
CREATE POLICY availability_public_read ON availability_rules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM booking_pages bp
      WHERE bp.id = availability_rules.booking_page_id
        AND bp.is_published = true
    )
  );
