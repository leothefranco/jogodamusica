# CAT-05 — catálogo público autoritativo BR

Contrato da [issue #13](https://github.com/leothefranco/jogodamusica/issues/13).
Esta entrega adiciona o caminho direto; não faz cutover, não autoriza uma partida
e não revalida Fontes. A ativação pública pertence à CAT-12 (#20).

## Modos e segurança

- O padrão permanece `legacy_guardrail`, com o mínimo de quatro da CAT-02.
- `PUBLIC_CATALOG_READ_MODE=authoritative_direct` é configuração exclusiva do
  servidor, sem prefixo `NEXT_PUBLIC_`. Só tem efeito em Preview Vercel ou em
  execução local não produtiva. Produção Vercel e produção self-hosted continuam
  no legado mesmo com esse valor. Nenhuma variável de ambiente foi provisionada
  por esta entrega.
- Query strings não selecionam modo, região, relógio ou versão de política.
- O caminho direto captura um instante e a política CAT-03 BR por consulta.
  Conta Entradas ativas com Fonte fresh ou grace, sem usar `isEmbeddable`.
  A classificação do Tema e suas modalidades pertencem à função única CAT-04.
- Home, API e slug usam a mesma composição. API e RSC recebem somente campos
  explícitos de apresentação, contagem jogável e modalidades; slugs ocultos
  recebem o mesmo estado genérico que um slug inexistente.
- Não há chamada a provedor, persistência de projeção, migration, alteração de
  policy/grant ou acesso direto do navegador às tabelas internas.

## Paginação e custo

`GET /api/themes?page=2` e `/?page=2#temas` aceitam páginas inteiras positivas.
A listagem direta consulta até 201 Temas published por janela: 200 candidatos e
um sentinela de continuação. Classifica os primeiros 200 e retorna apenas os
visíveis. Portanto uma página pode estar vazia e ainda ter `nextPage`.
O consumidor deve seguir a continuação, não interpretar uma página vazia como fim.
O campo `nextPage` da API é omitido no fim; o modo legado mantém sua resposta
sem continuação. O slug usa a mesma consulta com um único Tema.

A ordem é nome + ID do Tema. Usa-se página numérica com OFFSET para não expor
nomes ou IDs dos Temas ocultos em cursores. A agregação tem uma única consulta,
sem N+1, e no máximo 201 Temas por leitura. Os índices existentes cobrem
Entrada→Tema/ativa e Fonte+região. As miniaturas incluem somente candidatas
jogáveis, limitadas às primeiras quatro em ordem editorial, criação e ID.

Limites: OFFSET custa mais em páginas profundas e alterações concorrentes no
catálogo podem deslocar resultados entre páginas. O limite de Temas não limita
a quantidade de Entradas agregadas por Tema. As provas funcionais em PGlite não
substituem EXPLAIN e medição de latência no tamanho real do catálogo. Nenhuma
alegação de SLO ou benchmark de produção é feita nesta entrega.

## Observabilidade

O evento `public_catalog_read` registra duração, Temas examinados/visíveis, modo,
versão da política e distribuição agregada dos cinco estados CAT-04. Não inclui
slugs, IDs, razões de observação ou payloads de Fonte. O sentinela não participa
da distribuição. No legado, `states` é `null`: `isEmbeddable` não fornece saúde
autoritativa. Falha síncrona do exportador de métricas não interrompe a leitura.
Não foi criado um segundo mecanismo de comparação com projeção.

## Provas reproduzíveis, sem ambiente vivo

- `npm test -- --maxWorkers=2`: inclui PostgreSQL em memória com migrations reais,
  fixture compartilhada por múltiplos Temas, limites 3/4, 31/32 e 63/64,
  draft com 128, validade/grace inclusivos, indisponível/desconhecido, fonte de
  outra região, Entrada inativa, ordem editorial e desempate de miniaturas.
- `tests/integration/authoritative-public-catalog.test.ts` atravessa repositório,
  serviço, home, API e slug; prova um clock por consulta, uma consulta com várias
  centenas de Temas, continuação após janela oculta, projeção adulterada sem
  efeito, allowlist, ausência de I/O de provedor e guardrail de produção.
- `tests/unit/public-theme-service.test.ts` mantém o contrato legado e sua
  allowlist; `tests/unit/start-game-form.test.ts` prova agrupamento e ausência de
  seleção automática.
- `tests/e2e/authoritative-catalog.spec.ts` usa PostgreSQL efêmero, repositório e
  serviço reais, HomeExperience e StartGameForm. Navega home→página seguinte→Tema,
  verifica modalidades, quatro miniaturas e slugs ocultos genéricos. Seleciona
  uma modalidade, mas não inicia partida. A fixture de detalhe não substitui a
  prova da página pública real nos testes de integração.
- As rotas `e2e-test/authoritative-catalog` exigem build com `E2E_TEST_MODE=1` e
  header `x-e2e-test: authoritative-catalog`; ficam fora do build normal. Não
  possuem endpoint mutador nem apontam para um banco externo.

Para E2E otimizado, fazer build local com `E2E_TEST_MODE=1`, depois executar
`npm run test:e2e` com `CI=1` e porta livre em `PLAYWRIGHT_PORT`. Para o build
normal, desativar `E2E_TEST_MODE` e confirmar ausência das rotas de fixture no
manifesto. Usar apenas credenciais fictícias nas verificações locais.

## Rollout e rollback pendentes

Não foi feito push, deploy, alteração de configuração remota ou cutover.
CAT-12 deve preparar leitura sombra e ativação. Depois do cutover, o fallback
seguro será a consulta direta, nunca o legado baseado em `isEmbeddable`.
Esta implementação não modifica a transação de início da CAT-06: a resposta de
descoberta não é autorização para criar partida.
