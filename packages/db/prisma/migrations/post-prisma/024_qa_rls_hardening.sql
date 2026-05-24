-- =====================================================================
-- 024 — QA Hardening: RLS + audit hash chain race fix
-- =====================================================================
-- Correções da rodada 3 de QA:
--
-- QA #15 — audit.append_log RACE CONDITION:
--   O `FOR UPDATE LIMIT 1` em audit_logs não bloqueia INSERTs paralelos.
--   Duas chamadas concorrentes leem o MESMO prev_hash → ambos os logs
--   apontam para o mesmo predecessor, quebrando a hash chain.
--   Fix: pg_advisory_xact_lock serializa inserções globalmente.
--
-- QA #16 — Policies `FOR ALL TO authenticated` em tabelas user-scoped
--   (`user_health_checkins`, `user_health_streaks`, `health_data_points`,
--   `patient_payments`, `patient_invites`) usam `auth.uid()` que retorna
--   NULL via conexão Prisma direta (postgres role). Com FORCE RLS ON,
--   queries falham OU vazam dados dependendo de outras policies.
--
--   Fix: substituir `auth.uid()` por `public.current_user_id()` que faz
--   COALESCE com app.current_user (setado pelo withTenant). Remover
--   restrição `TO authenticated` onde necessário.
-- =====================================================================

-- ---------------------------------------------------------------------
-- PARTE 1 — audit.append_log com pg_advisory_xact_lock
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION audit.append_log(
  p_organization_id   uuid,
  p_actor_user_id     uuid,
  p_actor_role        text,
  p_actor_ip          inet,
  p_actor_user_agent  text,
  p_action            text,
  p_entity_type       text,
  p_entity_id         text,
  p_patient_id        uuid,
  p_fields_accessed   text[],
  p_payload           jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_prev_hash text;
  v_payload_hash text;
  v_log_hash text;
  v_id uuid;
  v_now timestamptz;
BEGIN
  -- QA #15: serialize all audit inserts globally for the duration of the
  -- transaction. pg_advisory_xact_lock acquires a session-scoped lock that
  -- releases at COMMIT/ROLLBACK. Two concurrent inserts queue.
  -- 8765432109876543 is an arbitrary constant unique to audit chain.
  PERFORM pg_advisory_xact_lock(8765432109876543);

  -- Calcula hash do payload (SHA-256 do JSON serializado)
  v_payload_hash := encode(digest(p_payload::text, 'sha256'), 'hex');

  -- Pega hash do log anterior — agora seguro porque o advisory lock
  -- garante que somos os únicos lendo/escrevendo até COMMIT.
  SELECT log_hash INTO v_prev_hash
  FROM audit_logs
  ORDER BY created_at DESC, id DESC
  LIMIT 1;

  -- Snapshot do timestamp para usar no hash E no INSERT (consistência)
  v_now := clock_timestamp();

  -- Calcula log_hash: SHA-256(prev + content + timestamp)
  v_log_hash := encode(
    digest(
      COALESCE(v_prev_hash, '') ||
      p_action || '|' ||
      p_entity_type || '|' ||
      COALESCE(p_entity_id, '') || '|' ||
      v_payload_hash || '|' ||
      v_now::text,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO audit_logs (
    id, organization_id, actor_user_id, actor_role,
    actor_ip, actor_user_agent, action, entity_type, entity_id,
    patient_id, fields_accessed, payload_hash, prev_log_hash, log_hash,
    created_at
  ) VALUES (
    gen_random_uuid(), p_organization_id, p_actor_user_id, p_actor_role,
    p_actor_ip, p_actor_user_agent, p_action, p_entity_type, p_entity_id,
    p_patient_id, p_fields_accessed, v_payload_hash, v_prev_hash, v_log_hash,
    v_now
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Atualizar validate_chain para usar o mesmo timestamp source
CREATE OR REPLACE FUNCTION audit.validate_chain(p_limit int DEFAULT NULL)
RETURNS TABLE (
  log_id uuid,
  is_valid boolean,
  expected_hash text,
  actual_hash text,
  pos int
)
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  r record;
  v_prev_hash text := NULL;
  v_expected_hash text;
  v_pos int := 0;
BEGIN
  FOR r IN
    SELECT al.id, al.action, al.entity_type, al.entity_id,
           al.payload_hash, al.prev_log_hash, al.log_hash, al.created_at
    FROM audit_logs al
    ORDER BY al.created_at ASC, al.id ASC
    LIMIT COALESCE(p_limit, 1000000)
  LOOP
    v_pos := v_pos + 1;
    v_expected_hash := encode(
      digest(
        COALESCE(v_prev_hash, '') ||
        r.action || '|' ||
        r.entity_type || '|' ||
        COALESCE(r.entity_id, '') || '|' ||
        r.payload_hash || '|' ||
        r.created_at::text,
        'sha256'
      ),
      'hex'
    );

    log_id := r.id;
    is_valid := (r.log_hash = v_expected_hash) AND (COALESCE(r.prev_log_hash, '') = COALESCE(v_prev_hash, ''));
    expected_hash := v_expected_hash;
    actual_hash := r.log_hash;
    pos := v_pos;

    RETURN NEXT;
    v_prev_hash := r.log_hash;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------
-- PARTE 2 — Substituir auth.uid() por current_user_id() em policies
--           user-scoped (compatibilidade com conexão Prisma + Supabase).
-- ---------------------------------------------------------------------

-- user_health_checkins
DROP POLICY IF EXISTS "user_checkins_self_only" ON "user_health_checkins";
CREATE POLICY "user_checkins_self_only" ON "user_health_checkins"
  FOR ALL
  USING (
    "user_id" = COALESCE(public.current_user_id(), auth.uid())
    OR public.is_super_admin()
  )
  WITH CHECK (
    "user_id" = COALESCE(public.current_user_id(), auth.uid())
  );

-- (mantém policy de nutri read inalterada — já usa current_org_id via app.current_org)

-- user_health_streaks
DROP POLICY IF EXISTS "user_streaks_self_only" ON "user_health_streaks";
CREATE POLICY "user_streaks_self_only" ON "user_health_streaks"
  FOR ALL
  USING (
    "user_id" = COALESCE(public.current_user_id(), auth.uid())
    OR public.is_super_admin()
  )
  WITH CHECK (
    "user_id" = COALESCE(public.current_user_id(), auth.uid())
  );

-- health_data_points (Lock 3)
DROP POLICY IF EXISTS "health_data_points_self_only" ON "health_data_points";
CREATE POLICY "health_data_points_self_only" ON "health_data_points"
  FOR ALL
  USING (
    "user_id" = COALESCE(public.current_user_id(), auth.uid())
    OR public.is_super_admin()
  )
  WITH CHECK (
    "user_id" = COALESCE(public.current_user_id(), auth.uid())
  );

-- ---------------------------------------------------------------------
-- PARTE 3 — Remover restrição TO authenticated em policies tenant-scoped
--           para que apliquem também a conexões via postgres role (Prisma).
--           A segurança vem do current_setting('app.current_org') que só
--           withTenant pode setar dentro de transação.
-- ---------------------------------------------------------------------

DROP POLICY IF EXISTS "patient_payments_tenant_isolation" ON "patient_payments";
CREATE POLICY "patient_payments_tenant_isolation" ON "patient_payments"
  FOR ALL
  USING (
    "organization_id" = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    "organization_id" = public.current_org_id()
  );

DROP POLICY IF EXISTS "patient_invites_tenant_isolation" ON "patient_invites";
CREATE POLICY "patient_invites_tenant_isolation" ON "patient_invites"
  FOR ALL
  USING (
    "organization_id" = public.current_org_id()
    OR public.is_super_admin()
  )
  WITH CHECK (
    "organization_id" = public.current_org_id()
  );

-- ---------------------------------------------------------------------
-- PARTE 4 — Comentários de auditoria
-- ---------------------------------------------------------------------
COMMENT ON FUNCTION audit.append_log IS
  'Append log com pg_advisory_xact_lock para serializar chain. QA #15 fix.';
