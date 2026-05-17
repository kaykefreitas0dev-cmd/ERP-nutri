-- ============================================================
-- 009 — S2b: RLS + policies para OnboardingProgress + ContactSubmission
-- ============================================================

ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress FORCE ROW LEVEL SECURITY;

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions FORCE ROW LEVEL SECURITY;

-- ============================================================
-- OnboardingProgress: user só vê próprio progresso
-- ============================================================
DROP POLICY IF EXISTS onboarding_self_only ON onboarding_progress;
CREATE POLICY onboarding_self_only ON onboarding_progress
  FOR ALL
  USING (user_id = auth.uid() OR public.is_super_admin())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- ContactSubmission: INSERT público (form anônimo), SELECT só super_admin
-- ============================================================
DROP POLICY IF EXISTS contact_public_insert ON contact_submissions;
CREATE POLICY contact_public_insert ON contact_submissions
  FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS contact_admin_select ON contact_submissions;
CREATE POLICY contact_admin_select ON contact_submissions
  FOR SELECT
  USING (public.is_super_admin());

DROP POLICY IF EXISTS contact_admin_modify ON contact_submissions;
CREATE POLICY contact_admin_modify ON contact_submissions
  FOR UPDATE
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());
