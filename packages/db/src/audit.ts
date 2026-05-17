// Audit log helpers (hash chain via audit.append_log SECURITY DEFINER)
// Atende CFN 599/2018 + Lei 13.787/2018

import { prisma } from "./client";
import { createHash } from "node:crypto";

export interface AuditEntry {
  organizationId?: string | null;
  actorUserId?: string | null;
  actorRole?: string | null;
  actorIp?: string | null;
  actorUserAgent?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  patientId?: string | null;
  fieldsAccessed?: string[];
  payload?: Record<string, unknown>;
}

/**
 * Insere um audit log via função SECURITY DEFINER audit.append_log.
 * A função calcula hash encadeado automaticamente.
 *
 * Uso:
 *   await appendAuditLog({
 *     organizationId: ctx.organizationId,
 *     actorUserId: ctx.userId,
 *     action: 'read',
 *     entityType: 'Patient',
 *     entityId: patientId,
 *     patientId,
 *     fieldsAccessed: ['clinicalNote', 'examAttachment'],
 *   });
 */
export async function appendAuditLog(entry: AuditEntry): Promise<string> {
  const payloadJson = JSON.stringify(entry.payload ?? {});

  const result = await prisma.$queryRaw<{ id: string }[]>`
    SELECT audit.append_log(
      ${entry.organizationId}::uuid,
      ${entry.actorUserId}::uuid,
      ${entry.actorRole}::text,
      ${entry.actorIp}::inet,
      ${entry.actorUserAgent}::text,
      ${entry.action}::text,
      ${entry.entityType}::text,
      ${entry.entityId}::text,
      ${entry.patientId}::uuid,
      ${entry.fieldsAccessed ?? []}::text[],
      ${payloadJson}::jsonb
    ) AS id
  `;

  return result[0]!.id;
}

/**
 * Valida a integridade da chain (uso em testes + dashboard admin).
 */
export interface ChainValidationResult {
  logId: string;
  isValid: boolean;
  expectedHash: string;
  actualHash: string;
  pos: number;
}

export async function validateAuditChain(
  limit?: number,
): Promise<ChainValidationResult[]> {
  return prisma.$queryRaw<ChainValidationResult[]>`
    SELECT
      log_id as "logId",
      is_valid as "isValid",
      expected_hash as "expectedHash",
      actual_hash as "actualHash",
      pos
    FROM audit.validate_chain(${limit ?? null}::int)
  `;
}

/**
 * Helper para reproduzir o cálculo do hash em testes.
 * Mesma fórmula do SQL: SHA256(prev_hash + action|entityType|entityId|payloadHash|createdAt)
 */
export function computeLogHash(opts: {
  prevHash: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  payloadHash: string;
  createdAt: Date;
}): string {
  const content = [
    opts.prevHash ?? "",
    opts.action,
    opts.entityType,
    opts.entityId ?? "",
    opts.payloadHash,
    opts.createdAt.toISOString(),
  ].join("|");

  // SQL usa `created_at::text` que retorna ISO sem zona em alguns casos.
  // O reproducer JS pode divergir; validateAuditChain é a fonte de verdade.
  return createHash("sha256").update(content).digest("hex");
}

export function computePayloadHash(payload: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
