# ADR 0049 — Casbin standalone para RBAC fine-grained

**Status:** Accepted
**Date:** 2026-05-16
**Sprint:** S2a

## Contexto

ADR 0048 (`withTenant`) garante **isolamento tenant** via RLS — User A não vê dados de Org B onde não tem Membership.

Mas dentro da mesma org, precisamos de permissões **action-level**:

- `nutritionist` só vê próprios pacientes (não os de outro nutri)
- `receptionist` agenda mas não vê notas clínicas
- `financial` vê pagamentos mas não dados clínicos
- `org_owner` controle total

Hierarquia + 7 roles built-in + permissões granulares = RBAC complexo. Não cabe em SQL policies (ficaria ilegível).

## Decisão

**Casbin v5 standalone** (não NestJS):

- Modelo: RBAC com **domínios** (`g(user, role, dom)` onde `dom = organization_id`)
- Adapter: **FileAdapter** com `baseline-policies.csv` no MVP; migrar para DB adapter pós-receita
- Cache: enforcer cached como singleton por instância de Vercel Function
- Helper `canAccess({ userId, organizationId, resource, action })` retorna boolean

## Arquivos

- `packages/config/casbin/model.conf` — modelo RBAC com domínio
- `packages/config/casbin/baseline-policies.csv` — policies dos 7 roles built-in
- `packages/config/src/casbin.ts` — `getEnforcer()`, `canAccess()`, `assignRole()`, `revokeRole()`

## Roles built-in (S2a)

| Role | Escopo |
|---|---|
| `org_owner` | Controle total da organização |
| `clinic_admin` | Gerencia clínica (subset de owner) |
| `senior_nutritionist` | Gerencia equipe + atende |
| `nutritionist` | Atende próprios pacientes |
| `assistant` | Agenda + visualiza dados não-sensíveis |
| `receptionist` | Apenas agenda + pacientes (read-only) |
| `financial` | Financeiro + relatórios |

## Padrão de uso

```typescript
import { canAccess } from "@nutricore/config/casbin";
import { withTenant } from "@nutricore/db/with-tenant";

export async function GET(req: NextRequest) {
  return withTenant(req, async ({ prisma, organizationId, userId }) => {
    const allowed = await canAccess({
      userId, organizationId,
      resource: '/v1/patients/abc/clinical-notes',
      action: 'read',
    });
    if (!allowed) {
      return new Response('Forbidden', { status: 403 });
    }

    // RLS + Casbin: defense in depth
    const notes = await prisma.clinicalNote.findMany({ where: { patientId: 'abc' }});
    return NextResponse.json({ notes });
  });
}
```

## Alternativas consideradas

- **CASL** (TypeScript-native): ótimo DX mas menos performante em policies grandes
- **OSO** (Polar): linguagem nova de policies (curva de aprendizado)
- **SQL policies only**: ilegível para regras com hierarquia + ownership chain
- **Custom code if/else**: insustentável após 20+ roles/permissões

## Cache strategy

- Enforcer carregado uma vez por instância Vercel Function (cold start)
- Subsequentes requests reusam singleton (warm)
- Mudança de policy via admin portal (S18) → invalidate cache via revalidation flag em Upstash Redis
- TTL natural: cold start ou deploy

## DB integration (pós-MVP)

No MVP, policies vêm de `baseline-policies.csv` (FileAdapter). Pós-receita:

1. Criar adapter custom que lê de `RolePermission` table (Prisma)
2. `assignRole(userId, role, orgId)` ao Membership.create
3. `revokeRole(...)` ao Membership.status = REVOKED
4. Sync via worker QStash `casbin.sync-from-db`

## Validação

- Suite Vitest em `packages/config/tests/casbin.spec.ts` cobre:
  - 7 roles × cenários de allow/deny por endpoint
  - Domínio isolation (role em orgA não vale em orgB)
  - Edge cases (action `*`, resource com keyMatch)
- Em Route Handlers reais, e2e Playwright valida 403 quando role não permite

## Consequências

**Positivas:**
- Policies legíveis em CSV (versionadas em git)
- Performance OK (Casbin é Go-rewrite em TS, ~10k checks/s)
- Defense in depth com RLS

**Negativas:**
- Curva de aprendizado para sintaxe Casbin
- Carregar policies a cada cold start (~50ms) — aceitável
- Migration para DB adapter exige código (TODO pós-receita)
