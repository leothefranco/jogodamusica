# 01 — Pré-visualizar playlist do YouTube

**What to build:** permitir que um administrador abra a página dedicada de um
tema, informe uma playlist pública ou não listada e receba uma prévia revisável,
classificada e limitada a 200 posições.

**Blocked by:** None — can start immediately.

**Status:** completed

- [x] URL e ID de playlist são normalizados e validados.
- [x] Paginação, teto, lotes, duplicatas e restrição regional são cobertos.
- [x] Falhas externas invalidam a prévia com erro estruturado.
- [x] Cache de 15 minutos e rate limit de cinco prévias por dez minutos são
      aplicados por administrador.
- [x] A página mostra resumo, estados e seleção dos itens prontos.
