// Envelope encryption helpers para PHI
// Usa phi.encrypt_for_org / phi.decrypt_for_org SQL functions (Vault DEK)

import { prisma } from "./client";

/**
 * Criptografa texto plano usando DEK da org no Vault.
 *
 * Antes do primeiro uso, a org precisa ter DEK provisionada:
 *   await ensureOrgDek(organizationId);
 *
 * @returns bytea criptografado (armazenar em coluna BYTEA)
 */
export async function encryptForOrg(
  organizationId: string,
  plaintext: string,
): Promise<Buffer> {
  const rows = await prisma.$queryRaw<{ encrypted: Buffer }[]>`
    SELECT phi.encrypt_for_org(${plaintext}, ${organizationId}::uuid) AS encrypted
  `;
  if (!rows[0]?.encrypted) {
    throw new Error("Falha ao criptografar (DEK ausente?)");
  }
  return rows[0].encrypted;
}

export async function decryptForOrg(
  organizationId: string,
  ciphertext: Buffer,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ decrypted: string | null }[]>`
    SELECT phi.decrypt_for_org(${ciphertext}::bytea, ${organizationId}::uuid) AS decrypted
  `;
  return rows[0]?.decrypted ?? null;
}

/**
 * Garante que a org tem DEK no Vault.
 * Se não tem, cria uma nova chave aleatória e registra na phi.organization_keys.
 *
 * Chamar no fluxo de onboarding (após criar Organization).
 */
export async function ensureOrgDek(organizationId: string): Promise<void> {
  const existing = await prisma.$queryRaw<{ secret: string | null }[]>`
    SELECT vault_secret_name AS secret FROM phi.organization_keys
    WHERE organization_id = ${organizationId}::uuid
  `;

  if (existing[0]?.secret) return; // já tem

  const secretName = `dek_org_${organizationId.replace(/-/g, "_")}`;

  // Cria secret no Vault (encoded_secret é base64 de 32 bytes random)
  // Supabase Vault: vault.create_secret(secret_text, name, description)
  await prisma.$executeRaw`
    SELECT vault.create_secret(
      encode(gen_random_bytes(32), 'base64'),
      ${secretName},
      ${`DEK for org ${organizationId}`}
    )
  `;

  await prisma.$executeRaw`
    INSERT INTO phi.organization_keys (organization_id, vault_secret_name)
    VALUES (${organizationId}::uuid, ${secretName})
    ON CONFLICT (organization_id) DO NOTHING
  `;
}
