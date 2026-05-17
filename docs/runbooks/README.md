# Runbooks NutriCore

> Procedimentos operacionais para mitigar incidentes via UI (sem código).
> Modelo Claude Code + PM Validador (ADR 0033) — PM não escreve código.

## Quando usar

Quando Sentry alerta P1/P2 ou métricas indicam degradação. Cada runbook tem:
1. **Sintoma** — como reconhecer
2. **Mitigação imediata** — passos UI (Vercel, Supabase Studio, GrowthBook)
3. **Mitigação alternativa** — se a primeira falhar
4. **Causa raiz** — investigação após mitigação
5. **Prevenção** — alertas + automações futuras

## Índice

| # | Runbook | Severidade |
|---|---|---|
| [01](./01-supabase-paused.md) | Supabase Free pausou DB | P1 |
| [02](./02-supabase-down.md) | Supabase Postgres down | P1 |
| [03](./03-rls-leak-detected.md) | RLS vazamento cross-tenant detectado | **P0** |
| [04](./04-aws-ses-sandbox-blocked.md) | AWS SES bloqueia envio fora sandbox | P2 |
| [05](./05-resend-down.md) | Resend down (fallback indisponível) | P2 |

## Princípios

- **Mitigação primeiro, root-cause depois.** Sentry/PostHog ficam para post-mortem.
- **Feature flag > deploy.** Use GrowthBook (S2b+) para desligar funcionalidades quebradas.
- **Status page atualizada SEMPRE** — `/status` deve refletir realidade.
- **Audit log preservado.** Mesmo em incidente, NÃO mexer em `audit_logs` (CFN imutabilidade).

## Quem responde

- **PM (você)** — primeiro nível, via UI
- **Sherlock review consultor** — escalação se MTTR >4h ou Sherlock-paths envolvidos
- **Auto-recuperação** — alguns cenários têm fallback automático (workers retry, CF Worker keepalive)
