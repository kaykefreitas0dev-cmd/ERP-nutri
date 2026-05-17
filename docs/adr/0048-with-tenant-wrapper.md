# ADR 0048 — Tenant Context via `withTenant` wrapper

**Status:** Accepted
**Date:** 2026-05-16
**Sprint:** S2a

## Contexto

ADR 0035 — Next.js-only stack (sem NestJS). Não temos decorators `@CurrentOrg()`. Toda Route Handler tenant-aware precisa:

1. Extrair `organization_id` + `user_id` do JWT Supabase
2. Validar Membership ativa
3. Executar `SET LOCAL app.current_org = $1` + `SET LOCAL app.current_user = $2` na conexão Postgres
4. Garantir transação (SET LOCAL é transactional)
5. RLS policies se ativam baseadas nos GUCs

Sem pattern único, cada Route Handler vai inventar — inconsistência leva a vazamentos cross-tenant (P0).

## Decisão

**Wrapper único `withTenant`** em `packages/db/src/with-tenant.ts`:

```typescript
export async function withTenant<T>(
  request: NextRequest,
  handler: (ctx: TenantContext) => Promise<T>,
): Promise<T>
```

Uso obrigatório em Route Handlers tenant-aware (`apps/web/src/app/api/v1/**`):

```typescript
export async function GET(req: NextRequest) {
  return withTenant(req, async ({ prisma, organizationId, userId }) => {
    const patients = await prisma.patient.findMany(); // RLS aplicada via SET LOCAL
    return NextResponse.json({ patients });
  });
}
```

## Enforcement

**Semgrep custom rule** `no-route-without-with-tenant` (`.semgrep/nutricore-rules.yml`):

- Detecta Route Handler com `await prisma.*` que NÃO está dentro de `withTenant`
- Paths exclude: `/api/public/*`, `/api/internal/workers/*`, `/api/health/*`, `/api/auth/*`
- Severity: ERROR (CI fails)

## Comportamento

1. `extractTenantFromRequest(request)` — extrai do JWT (claim `sub` + `app_metadata.current_org`)
2. `prisma.membership.findUnique` — valida Membership ATIVA na org
3. `prisma.$transaction` — inicia tx
4. `SET LOCAL app.current_org = '<uuid>'` — transactional
5. `SET LOCAL app.current_user = '<uuid>'`
6. Chama `handler({ organizationId, userId, prisma: tx })`
7. RLS policies usam `current_setting('app.current_org', true)::uuid`

## Erros possíveis

- `TenantContextError 401`: token ausente, malformado ou expirado
- `TenantContextError 403`: org não selecionada (claim `current_org` ausente) ou Membership inativa

## Variante: `withTenantUnsafe`

Para workers internos (BullMQ/QStash handlers) onde org/user vêm do payload, não do JWT:

```typescript
await withTenantUnsafe(organizationId, userId, async ({ prisma }) => {
  // ...
});
```

ATENÇÃO: usar APENAS em workers internos. Em Route Handlers, sempre `withTenant`.

## Alternativas consideradas

- **Middleware Next.js**: não permite acesso ao body, complica error handling
- **Higher-order function customizada**: equivalente, mas `withTenant` é convenção mais clara
- **Decorators TypeScript**: TC39 ainda experimental + requer config tsconfig
- **Casbin direto sem wrapper**: não cobre RLS, só authorization. Complementar, não substituto.

## Casbin integration

`withTenant` foca em **isolamento tenant** (RLS). Para **permissões fine-grained** (action-level), usar Casbin standalone (ADR 0049) DENTRO do handler:

```typescript
return withTenant(req, async ({ prisma, organizationId, userId }) => {
  const allowed = await canAccess({
    userId, organizationId,
    resource: '/v1/patients/abc/clinical-notes',
    action: 'read',
  });
  if (!allowed) return new Response('Forbidden', { status: 403 });
  // ...
});
```

## Validação

- Suite `multi-tenant-isolation.spec.ts` (S2a):
  - Sem `SET LOCAL` → 0 rows em queries tenant
  - Com `SET LOCAL orgA` → vê só dados de orgA
- Semgrep rule no CI bloqueia merge se Route Handler esquecer `withTenant`
- Gate `validate` GitHub Actions roda ambos em todo PR

## Consequências

**Positivas:**
- Pattern único, fácil de revisar (Sherlock review)
- Convergência forçada por Semgrep (não depende de boa-vontade)
- RLS + applicação alinhados (defense in depth)

**Negativas:**
- Toda query precisa estar dentro de `withTenant` (sem queries fora de tenant context exceto public endpoints)
- Pequeno overhead de transação por request — aceitável para RPS típico de SaaS B2B
