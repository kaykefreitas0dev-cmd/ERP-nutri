# 🚨 URGENTE: Legacy Supabase API Keys desabilitadas

**Status:** Bloqueia login em produção
**Data descoberta:** 2026-05-24
**Projeto Supabase:** `uzhqlfgwcummukyfriez` (NutriCore)

## Sintoma

Qualquer chamada a `supabase.auth.signInWithPassword()` ou
`supabase.auth.signInWithOtp()` retorna:

```json
{
  "message": "Legacy API keys are disabled",
  "hint": "Your legacy API keys (anon, service_role) were disabled on 2026-05-17T13:30:04.678699+00:00..."
}
```

## Causa raiz

Em **2026-05-17**, o Supabase desabilitou as legacy API keys (formato JWT
HS256 `eyJhbGciOiJIUzI1NiIs...`) deste projeto. O `.env.local` e as Vercel
env vars dos 3 apps ainda usam as keys legacy:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — JWT legacy (formato antigo)
- `SUPABASE_SERVICE_ROLE_KEY` — JWT legacy (formato antigo)

## Por que afeta login

A nova versão do `withTenant` (commit `217d0b7`) usa
`supabase.auth.getUser(token)` para validar JWTs server-side — esse endpoint
está bloqueado.

Adicionalmente: `signInWithPassword` (commit `803fa44`) também está bloqueado.

## Solução em 60 segundos

### Opção A — Re-habilitar legacy keys (rápido, mas Supabase vai descontinuar)

1. Acesse: <https://supabase.com/dashboard/project/uzhqlfgwcummukyfriez/settings/api-keys>
2. Procure seção "Legacy API Keys" → clique em "Re-enable"
3. Login funciona em ~1 min

### Opção B — Gerar novas keys (recomendado)

1. Acesse: <https://supabase.com/dashboard/project/uzhqlfgwcummukyfriez/settings/api-keys>
2. Na seção "API Keys", revele e copie:
   - **Publishable key** (`sb_publishable_...`)
   - **Secret key** (`sb_secret_...`)
3. Atualize em **3 lugares**:

#### a) `.env.local` em `apps/web`

```diff
- NEXT_PUBLIC_SUPABASE_ANON_KEY="<JWT-LEGACY-TRUNCADO>"  # formato antigo
- SUPABASE_SERVICE_ROLE_KEY="<JWT-LEGACY-TRUNCADO>"      # formato antigo
+ NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_..."
+ SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
```

#### b) Vercel env vars (production + development) — 3 apps

```bash
# Para cada projeto (erp-nutri-web, erp-nutri-patient, erp-nutri-marketing):
cd apps/web    # depois apps/patient, apps/marketing
for env in production development preview; do
  npx vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY $env --yes
  printf 'sb_publishable_xxxxx' | npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY $env
  npx vercel env rm SUPABASE_SERVICE_ROLE_KEY $env --yes
  printf 'sb_secret_xxxxx' | npx vercel env add SUPABASE_SERVICE_ROLE_KEY $env
done
```

#### c) Restart dev local

```bash
pnpm --filter web run dev
```

## Validação após o fix

```bash
# Substitua <SB_URL> e <PUB_KEY> pelos valores reais
curl -X POST '<SB_URL>/auth/v1/token?grant_type=password' \
  -H 'apikey: <PUB_KEY>' \
  -H 'Content-Type: application/json' \
  -d '{"email":"kaykefreitas0dev@gmail.com","password":"kayke123"}'
```

Resposta esperada: JSON com `access_token` (não com `Legacy API keys are disabled`).

## Conta admin já criada

| Campo       | Valor                        |
| ----------- | ---------------------------- |
| Email       | `kaykefreitas0dev@gmail.com` |
| Senha       | `kayke123`                   |
| Super admin | ✅ true                      |

A conta foi criada via Supabase Auth Admin API (endpoint que ainda aceita legacy).
A senha está válida no banco — só falta destravar o endpoint de login.

## Por que `@supabase/supabase-js` não precisa de mudança de código

A biblioteca aceita ambos os formatos (`eyJhbGci...` E `sb_publishable_...`)
automaticamente desde a v2.45. Não há refactor de código necessário — só
trocar valores de env vars.
