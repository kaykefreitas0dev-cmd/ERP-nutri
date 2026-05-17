# SPRINT_STATE

current_sprint: S2a
status: ready
last_updated: 2026-05-16

---

## Como funciona (ADR 0041)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão. Se houver decisões pendentes na sprint atual marcada como `gates_pending`, recusa execução até PM marcar `[x]` em todas as decisões e atualizar `status: ready`.

Após sprint concluída e validada pelo PM, atualizar:
- `current_sprint` para a próxima
- `status` para `gates_pending`
- `last_updated` para a data atual

---

## Histórico

- 2026-05-16 — S1 entregue (T1 completa); PR #1 aguardando merge. PM aprovou defaults S2a + email super-admin via AskUserQuestion. S2a iniciada em branch `feat/s2a-auth-rbac-tenant-guard`.
