# SPRINT_STATE

current_sprint: S1
status: gates_pending
last_updated: 2026-05-16

---

## Como funciona (ADR 0041)

Claude Code lê este arquivo + `SPRINT_GATES.md` no início de cada sessão. Se houver decisões pendentes na sprint atual marcada como `gates_pending`, recusa execução até PM marcar `[x]` em todas as decisões e atualizar `status: ready`.

Após sprint concluída e validada pelo PM, atualizar:
- `current_sprint` para a próxima
- `status` para `gates_pending`
- `last_updated` para a data atual
