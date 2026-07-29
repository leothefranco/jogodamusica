# 02 — Confirmar importação de playlist

**What to build:** permitir que o administrador confirme os vídeos selecionados,
com revalidação confiável, associação atômica e resultado idempotente.

**Blocked by:** 01 — Pré-visualizar playlist do YouTube.

**Status:** completed

- [x] A confirmação aceita somente preview e IDs selecionados.
- [x] Preview ausente ou expirado provoca revalidação segura.
- [x] Associações existentes preservam todos os ajustes editoriais.
- [x] Novas associações entram ativas, com duração completa e sem ordem manual.
- [x] Falhas individuais são classificadas antes da transação.
- [x] Falhas de banco revertem todo o lote.
- [x] O resultado informa adicionados, já existentes e ignorados.
