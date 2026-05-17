-- =====================================================================
-- S21 prep — Fix audit chain timestamp serialization (Runbook 07 Opção B)
-- =====================================================================
-- Bug: append_log usa now()::text pro hash; validate_chain usa
-- r.created_at::text. PostgreSQL pode serializar TIMESTAMPTZ com formatos
-- divergentes (microseconds, timezone) entre INSERT e SELECT, fazendo a
-- hash chain ficar marcada como inválida mesmo sem tampering.
--
-- Fix: ambas funções usam to_char(... AT TIME ZONE 'UTC', 'YYYY-MM-DD
-- HH24:MI:SS.US') — formato determinístico, mesmo resultado em qualquer
-- timezone session do PG.
--
-- IMPORTANTE: entries pré-fix vão continuar reportando is_valid=false em
-- validate_chain. Não há tampering nessas entries — só o formato divergente.
-- Recomendação: manter as antigas como "legacy chain" (pré-22), validar
-- apenas entries criadas após esta migration.
-- =====================================================================

CREATE OR REPLACE FUNCTION audit.append_log(
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_actor_ip inet,
  p_actor_user_agent text,
  p_action text,
  p_entity_type text,
  p_entity_id text,
  p_patient_id uuid,
  p_fields_accessed text[],
  p_payload jsonb
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
  v_ts timestamptz := now();
  v_ts_str text;
BEGIN
  -- Formato determinístico — independe de timezone session
  v_ts_str := to_char(v_ts AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US');

  v_payload_hash := encode(digest(p_payload::text, 'sha256'), 'hex');

  SELECT log_hash INTO v_prev_hash
  FROM audit_logs
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE;

  v_log_hash := encode(
    digest(
      COALESCE(v_prev_hash, '') ||
      p_action || '|' ||
      p_entity_type || '|' ||
      COALESCE(p_entity_id, '') || '|' ||
      v_payload_hash || '|' ||
      v_ts_str,
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
    v_ts -- usa o MESMO timestamp do hash
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ----- validate_chain atualizada — formato to_char compatível -----
-- IMPORTANTE: pra entries antigas (pré-fix) continuará reportando false.
-- Em produção, restrinja validate_chain pra entries created_at >= migration_date
-- via p_since param (a adicionar em iteração futura se necessário).

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
AS $$
DECLARE
  r record;
  v_prev_hash text := NULL;
  v_expected_hash text;
  v_pos int := 0;
  v_ts_str text;
BEGIN
  FOR r IN
    SELECT al.id, al.action, al.entity_type, al.entity_id,
           al.payload_hash, al.prev_log_hash, al.log_hash, al.created_at
    FROM audit_logs al
    ORDER BY al.created_at ASC, al.id ASC
    LIMIT COALESCE(p_limit, 1000000)
  LOOP
    v_pos := v_pos + 1;
    -- Mesma serialização que append_log usa pra calcular hash
    v_ts_str := to_char(r.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS.US');

    v_expected_hash := encode(
      digest(
        COALESCE(v_prev_hash, '') ||
        r.action || '|' ||
        r.entity_type || '|' ||
        COALESCE(r.entity_id, '') || '|' ||
        r.payload_hash || '|' ||
        v_ts_str,
        'sha256'
      ),
      'hex'
    );

    log_id := r.id;
    is_valid := (r.log_hash = v_expected_hash)
      AND (COALESCE(r.prev_log_hash, '') = COALESCE(v_prev_hash, ''));
    expected_hash := v_expected_hash;
    actual_hash := r.log_hash;
    pos := v_pos;
    RETURN NEXT;

    v_prev_hash := r.log_hash;
  END LOOP;
END;
$$;
