# Projeção reconstruível de Tema — CAT-07

`theme_state_projections` é derivada de `themes`, Entradas ativas e observações BR.
Não participa da autorização de criação de partida. CAT-06 continua consultando os
dados-base sob seus locks. A projeção pode ser apagada sem perder catálogo.

O projetor usa `classifyThemeState`, a mesma classificadora da consulta direta;
captura um instante e política por operação e agrega todas as Entradas do Tema em
uma consulta. Guarda contagens, modos, estados, versões e `calculated_at`, além das
thumbnails derivadas e próxima borda temporal. As thumbnails não mudam a allowlist
pública. A borda permite abandonar o cache quando fresh/grace vence sem mutação.

## Escrita e reconstrução

Após a migration Drizzle `0012_theme_state_projection`, habilitar somente em QA
`THEME_PROJECTION_WRITE_MODE=enabled`. Qualquer outro valor desliga a manutenção.
Criação (inclusive com claim/lock de capa), edição/publicação/rascunho, associação,
retirada e importação recalculam na transação editorial. Falha no projetor reverte
também a alteração dos dados-base. Exclusão do Tema remove a projeção por FK.

Revalidação individual passa o Tema em contexto à persistência da observação. O
coordenador CAT-06 mantém a ordem de locks de Temas e Fontes; após rechecagem de
dependências, só recalcula o contexto ainda associado. Propagação para outros
Temas de uma Fonte compartilhada pertence a CAT-08. Sem contexto não há propagação.

O backend com sessão administrativa chama
`rebuildThemeProjection({ themeId })` de
`src/server/services/theme-projection-service.ts`. A entrada é estrita: não recebe
contagens, modos ou versões. `requireAdmin` autoriza a sessão; o perfil ativo é
revalidado e protegido na mesma transação do recálculo. O resultado contém apenas
`created`, `unchanged` ou `corrected` e nomes controlados de campos alterados. O
registro interno que recebe actorId é uma fronteira de backend, não endpoint.
Não foi criada rota pública, UI administrativa ou job global.

Upsert trava primeiro o Tema e serializa criação concorrente da linha ausente.
Repetição sem diferenças lógicas preserva `calculated_at`; não cria versão lógica.
Métricas saem após commit e incluem duração, resultado, quantidade de campos,
versões e drift agregado. Falha de telemetria não reverte um commit. Não incluem
Tema/Fonte ID, slug, títulos ou valores anteriores.

## Leitura e rollback

Em Preview/QA, `PUBLIC_CATALOG_READ_MODE=authoritative_projected` seleciona o
adaptador projetado, quando a escrita também estiver habilitada. Ausência, versão
incompatível, incoerência classificável ou vencimento temporal fazem fallback em
uma consulta direta em lote, sem escrita durante leitura. A janela de 200 Temas,
continuação, ordenação, buracos ocultos e allowlist permanecem os de CAT-05. Deriva
coerente de contagens ou thumbnails exige rebuild; esta etapa não implementa
detecção global de drift. CAT-06 continua rejeitando partida sem candidatas reais.

Para rollback em QA, desabilitar `THEME_PROJECTION_WRITE_MODE` e selecionar
`PUBLIC_CATALOG_READ_MODE=authoritative_direct`. Solicitação do modo projetado com
projetor desligado também usa o direto. Preservar tabela e migration para diagnóstico.

A base instalada ainda usa `legacy_guardrail` quando o seletor está ausente ou em
produção. CAT-07 preserva esse default preexistente e a guarda de QA; a definição
do cutover autoritativo e seu rollback de produção pertence a CAT-12. Depois desse
cutover, rollback deve servir a consulta direta, nunca o booleano legado. Os novos
adaptadores usam a consulta direta como fallback. Não habilitar este QA em produção.

## Proteção e índices

PK/FK por Tema, checks de contagens/fórmulas, enums e versões restringem corrupção
básica. RLS e FORCE RLS estão habilitadas; não há policy nem grants PUBLIC, anon ou
authenticated. A conexão de backend deve ter privilégios de leitura/escrita nas
tabelas de domínio e bypass de RLS adequado ao backend, como a conexão instalada;
nunca conceder bypass ou acesso à projeção aos clientes. QA testa um backend sem
superuser separadamente de anon/authenticated e um papel NOBYPASS com grant.

Os índices `(visibility, theme_id)` e `(operational_state, theme_id)` suportam
consulta backend por visibilidade/ordem de ID e estado operacional/ID. PostgreSQL
QA verifica seus planos nesses formatos; a janela pública atual ordena por nome
do Tema e usa a PK no join, não esses índices para alterar a janela CAT-05.
São eixos distintos, sem índice duplicado de theme_id além da PK. Listagens
administrativas globais e analytics permanecem etapas posteriores.

As suites CAT-07 cobrem cinco estados, 64→63/32→31, idempotência, igualdade pública,
fallback, autorização, drift, rollback e concorrência. O harness PostgreSQL exige
instância nova loopback17.11 no namespace próprio; PGlite não substitui essa prova.
O handoff local registra SHA, comandos, logs e limites de QA. YouTube, Supabase Auth
externo, PWA, dispositivos e produção não são validados por fixtures locais.
