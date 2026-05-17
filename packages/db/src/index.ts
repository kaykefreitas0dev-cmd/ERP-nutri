// @nutricore/db — Prisma client + tenant context + audit helpers
//
// Public API:
//   import { prisma, withTenant, appendAuditLog } from "@nutricore/db";
//
// withTenant é obrigatório em Route Handlers tenant-aware (ADR 0048).
// Semgrep custom rule no-route-without-with-tenant enforça em CI.

export { prisma } from "./client";
export type { PrismaClient } from "./client";
export * from "./client";

export {
  withTenant,
  withTenantUnsafe,
  extractTenantFromRequest,
  TenantContextError,
} from "./with-tenant";
export type { TenantContext } from "./with-tenant";

export {
  appendAuditLog,
  validateAuditChain,
  computeLogHash,
  computePayloadHash,
} from "./audit";
export type { AuditEntry, ChainValidationResult } from "./audit";
