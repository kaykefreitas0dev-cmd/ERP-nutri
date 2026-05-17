// ADR 0049 — Casbin standalone (sem NestJS)
//
// Padrão de uso em apps/web Route Handlers:
//
//   import { canAccess } from "@nutricore/config/casbin";
//   import { withTenant } from "@nutricore/db/with-tenant";
//
//   export async function GET(req: NextRequest) {
//     return withTenant(req, async ({ prisma, organizationId, userId }) => {
//       const allowed = await canAccess({
//         userId, organizationId, resource: '/v1/patients/abc123', action: 'read'
//       });
//       if (!allowed) return new Response('Forbidden', { status: 403 });
//       // ...
//     });
//   }
//
// O enforcer é cached como singleton por instância de Function (Vercel).
// Em produção, policies vêm do DB (via RolePermission + Membership.role lookup).
// Em dev, policies vêm de baseline-policies.csv (file adapter).

import { newEnforcer, Enforcer, FileAdapter } from "casbin";
import { join } from "node:path";

let cachedEnforcer: Enforcer | null = null;
let cachePromise: Promise<Enforcer> | null = null;

const MODEL_PATH = join(
  __dirname,
  "..",
  "casbin",
  "model.conf",
);

const BASELINE_POLICIES_PATH = join(
  __dirname,
  "..",
  "casbin",
  "baseline-policies.csv",
);

/**
 * Retorna enforcer singleton.
 *
 * Em produção (com DB), idealmente carrega policies do RolePermission
 * via custom adapter. No MVP, usa file adapter com baseline-policies.csv.
 */
export async function getEnforcer(): Promise<Enforcer> {
  if (cachedEnforcer) return cachedEnforcer;
  if (cachePromise) return cachePromise;

  cachePromise = (async () => {
    const adapter = new FileAdapter(BASELINE_POLICIES_PATH);
    const enforcer = await newEnforcer(MODEL_PATH, adapter);

    // Em produção, mergear policies do DB aqui:
    // const dbPolicies = await loadPoliciesFromDB();
    // for (const p of dbPolicies) {
    //   await enforcer.addPolicy(...p);
    // }

    await enforcer.loadPolicy();
    cachedEnforcer = enforcer;
    return enforcer;
  })();

  return cachePromise;
}

export interface AccessRequest {
  userId: string;
  organizationId: string;
  resource: string;
  action: "read" | "write" | "delete" | "*";
}

/**
 * Verifica se o user tem permissão para o resource+action na org.
 *
 * Sob o capô:
 * 1. Busca Membership(user, org) → Role
 * 2. Pergunta ao Casbin: enforce(role, orgId, resource, action)
 * 3. Retorna boolean
 *
 * Default: deny-by-default (se Casbin não encontrar match, retorna false).
 */
export async function canAccess(req: AccessRequest): Promise<boolean> {
  // role lookup é responsabilidade do caller (withTenant já tem)
  // ou fazemos via prisma aqui se exposto API
  const enforcer = await getEnforcer();

  // O caller passa role via parâmetro adicional em loadUserRole(userId, orgId)
  // Aqui assumimos que o user já tem grouping atribuído.

  return enforcer.enforce(req.userId, req.organizationId, req.resource, req.action);
}

/**
 * Atribui um role a um user numa org específica (grouping policy g).
 *
 * Chamado quando Membership.status muda para ACTIVE.
 */
export async function assignRole(
  userId: string,
  role: string,
  organizationId: string,
): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.addGroupingPolicy(userId, role, organizationId);
  await enforcer.savePolicy();
}

/**
 * Revoga role (Membership.status → REVOKED).
 */
export async function revokeRole(
  userId: string,
  role: string,
  organizationId: string,
): Promise<void> {
  const enforcer = await getEnforcer();
  await enforcer.removeGroupingPolicy(userId, role, organizationId);
  await enforcer.savePolicy();
}

/**
 * Invalida cache (para testes ou após mudança de policy via admin portal).
 */
export function invalidateEnforcerCache(): void {
  cachedEnforcer = null;
  cachePromise = null;
}
