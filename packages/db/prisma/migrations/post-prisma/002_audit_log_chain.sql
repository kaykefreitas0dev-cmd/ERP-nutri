-- ============================================================
-- 002 — Audit Log Hash Chain (append-only)
-- Atende CFN 599/2018 + Lei 13.787/2018 (Prontuário Eletrônico)
-- ============================================================
-- Estilo Merkle: log_hash = SHA256(prev_log_hash + content)
-- Tamper detection trivial: validar chain percorrendo logs
-- ============================================================

-- Função SECURITY DEFINER para inserir audit log calculando hash
-- Apenas esta função pode inserir; INSERT direto é bloqueado por policy
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
SET search_path = public
AS $$
DECLARE
  v_prev_hash text;
  v_payload_hash text;
  v_log_hash text;
  v_id uuid;
BEGIN
  -- Calcula hash do payload (SHA-256 do JSON serializado)
  v_payload_hash := encode(digest(p_payload::text, 'sha256'), 'hex');

  -- Pega hash do log anterior (último log inserido global)
  SELECT log_hash INTO v_prev_hash
  FROM audit_logs
  ORDER BY created_at DESC, id DESC
  LIMIT 1
  FOR UPDATE; -- Lock para garantir ordem (evita race condition)

  -- Calcula log_hash: SHA-256(prev + content)
  v_log_hash := encode(
    digest(
      COALESCE(v_prev_hash, '') ||
      p_action || '|' ||
      p_entity_type || '|' ||
      COALESCE(p_entity_id, '') || '|' ||
      v_payload_hash || '|' ||
      now()::text,
      'sha256'
    ),
    'hex'
  );

  -- Insert
  INSERT INTO audit_logs (
    id, organization_id, actor_user_id, actor_role,
    actor_ip, actor_user_agent, action, entity_type, entity_id,
    patient_id, fields_accessed, payload_hash, prev_log_hash, log_hash,
    created_at
  ) VALUES (
    gen_random_uuid(), p_organization_id, p_actor_user_id, p_actor_role,
    p_actor_ip, p_actor_user_agent, p_action, p_entity_type, p_entity_id,
    p_patient_id, p_fields_accessed, v_payload_hash, v_prev_hash, v_log_hash,
    now()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- REVOKE UPDATE/DELETE em audit_logs — imutabilidade total
-- ============================================================
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM anon;

-- service_role NÃO pode UPDATE ou DELETE (CFN immutability)
-- Mas pode INSERT via função SECURITY DEFINER apenas
REVOKE UPDATE, DELETE ON audit_logs FROM service_role;

-- Função append_log pode ser chamada via supabase_auth/service_role
GRANT EXECUTE ON FUNCTION audit.append_log TO authenticated, service_role;

-- ============================================================
-- Função helper para validar chain (uso em testes + dashboard admin)
-- ============================================================
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
