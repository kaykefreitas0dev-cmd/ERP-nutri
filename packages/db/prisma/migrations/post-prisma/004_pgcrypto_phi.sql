-- ============================================================
-- 004 — pgcrypto helpers para envelope encryption de PHI
-- ADR 0002 — Encryption (envelope + KMS Supabase Vault)
-- ============================================================
-- DEK (Data Encryption Key) por organização, gerada por Vault
-- PHI sensível (anotações clínicas, exames) criptografada com DEK
-- via pgp_sym_encrypt do pgcrypto
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schema dedicado para funções de criptografia
CREATE SCHEMA IF NOT EXISTS phi;

-- ============================================================
-- Função: encrypt_text — criptografa texto com DEK da org
-- ============================================================
-- Uso: phi.encrypt_text('conteudo da nota', 'dek-org-abc123')
-- Retorna: bytea criptografado (armazenar em coluna BYTEA)
-- ============================================================
CREATE OR REPLACE FUNCTION phi.encrypt_text(p_plaintext text, p_dek text)
RETURNS bytea
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT pgp_sym_encrypt(p_plaintext, p_dek, 'compress-algo=2, cipher-algo=aes256');
$$;

-- ============================================================
-- Função: decrypt_text — descriptografa
-- ============================================================
CREATE OR REPLACE FUNCTION phi.decrypt_text(p_ciphertext bytea, p_dek text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT pgp_sym_decrypt(p_ciphertext, p_dek);
$$;

-- ============================================================
-- DEK Storage (mapeamento organization_id → DEK em Vault)
-- ============================================================
-- A DEK real fica em Supabase Vault (vault.secrets)
-- Esta tabela apenas mapeia organization_id → secret_name no Vault
-- ============================================================
CREATE TABLE IF NOT EXISTS phi.organization_keys (
  organization_id uuid PRIMARY KEY,
  vault_secret_name text NOT NULL,
  rotated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Apenas service_role pode ler esta tabela (nunca exposto a client)
REVOKE ALL ON phi.organization_keys FROM PUBLIC;
REVOKE ALL ON phi.organization_keys FROM authenticated;
REVOKE ALL ON phi.organization_keys FROM anon;
GRANT SELECT, INSERT, UPDATE ON phi.organization_keys TO service_role;

-- ============================================================
-- Helper combinado: encrypt_for_org
-- Busca DEK da org no Vault + criptografa
-- Uso em INSERT/UPDATE: phi.encrypt_for_org('nota', 'org-uuid')
-- ============================================================
CREATE OR REPLACE FUNCTION phi.encrypt_for_org(p_plaintext text, p_organization_id uuid)
RETURNS bytea
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, phi
AS $$
DECLARE
  v_secret_name text;
  v_dek text;
BEGIN
  SELECT vault_secret_name INTO v_secret_name
  FROM phi.organization_keys
  WHERE organization_id = p_organization_id;

  IF v_secret_name IS NULL THEN
    RAISE EXCEPTION 'No DEK registered for organization %', p_organization_id
      USING HINT = 'Provision DEK via Vault first';
  END IF;

  -- vault.decrypted_secrets é view fornecida pelo Supabase Vault
  SELECT decrypted_secret INTO v_dek
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name;

  IF v_dek IS NULL THEN
    RAISE EXCEPTION 'DEK secret % not found in vault', v_secret_name
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN phi.encrypt_text(p_plaintext, v_dek);
END;
$$;

CREATE OR REPLACE FUNCTION phi.decrypt_for_org(p_ciphertext bytea, p_organization_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, phi
AS $$
DECLARE
  v_secret_name text;
  v_dek text;
BEGIN
  SELECT vault_secret_name INTO v_secret_name
  FROM phi.organization_keys
  WHERE organization_id = p_organization_id;

  IF v_secret_name IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT decrypted_secret INTO v_dek
  FROM vault.decrypted_secrets
  WHERE name = v_secret_name;

  IF v_dek IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN phi.decrypt_text(p_ciphertext, v_dek);
END;
$$;

-- ============================================================
-- Permissões para uso a partir do app via service_role
-- ============================================================
GRANT USAGE ON SCHEMA phi TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION phi.encrypt_text TO service_role;
GRANT EXECUTE ON FUNCTION phi.decrypt_text TO service_role;
GRANT EXECUTE ON FUNCTION phi.encrypt_for_org TO service_role;
GRANT EXECUTE ON FUNCTION phi.decrypt_for_org TO service_role;
