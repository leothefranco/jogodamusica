# CAT-06 — criação autoritativa de partida

Issue: https://github.com/leothefranco/jogodamusica/issues/14.
Base desta rodada: `5d41b3a3a51994fa008272717ecb9101695860ca`.
Estado: implementação local com dez cenários PostgreSQL reais aprovados na R2;
**aguarda revisão independente de segurança/dados sobre o SHA final**. Sem cutover ou deploy.

## Contrato e implementação

O POST continua anônimo e limitado a 20 tentativas/hora, agora com schema estrito:
apenas `themeId` e `bracketSize` explícito (4/8/16/32/64/128). Não recebe região,
versão de política, contagem ou Fontes. O handler comum é usado pela rota real e
pela fixture isolada; a prova integrada da rota usa também o rate limiter real.

A mesma configuração server-only de CAT-05 (`PUBLIC_CATALOG_READ_MODE`) ativa a
criação direta somente em Preview/local não produtivo. Produção Vercel e produção
self-hosted continuam no legado CAT-02, mesmo se a variável pedir modo direto.
CAT-12 continua responsável por promover leitura e criação juntas. As opções de
injeção do repositório são server-only e usadas por QA; não são campos HTTP.

Cada tentativa transacional captura uma vez o relógio, a região BR e a política
CAT-03 versão 1. Depois de adquirir locks, relê publicação, Entradas ativas
(aproximação vigente de aprovação editorial) e Disponibilidade. Usa somente
available dentro de `valid_until` ou `grace_until`, com limites inclusivos.
`isEmbeddable` e projeção não autorizam esse caminho. O seletor existente escolhe
N candidatas distintas; a mesma transação persiste sessão, N snapshots por
allowlist e N−1 confrontos. O instante capturado também é `started_at`.

Rascunho, Tema inexistente e insuficiência recebem o mesmo conflito seguro no
modo autoritativo. Erros inesperados da transação viram `GAME_CREATION_FAILED`,
sem encaminhar SQL, bind values ou causas do driver ao logger HTTP. O motor de
confronto e a leitura de snapshots permanecem existentes.

## Coordenação

`catalog-transaction.ts` é compartilhado por criação, persistência de saúde e
importação editorial de múltiplas Fontes:

1. `SET LOCAL lock_timeout = '2000ms'`.
2. Temas distintos por UUID crescente, `FOR UPDATE`.
3. Fontes por `provider_content_id` crescente (YouTube): identity advisory lock
   transacional, linha de Fonte e observação regional, nessa ordem por Fonte.
4. Releitura de associações depois dos locks; diferenças abortam a tentativa.
   Saúde também relê após resolver uma Fonte antes ausente, cuja linha passa a
   bloquear novos vínculos via FK. Nunca adquire Tema novo depois de Fonte.

A identidade inclui o hash SHA-256 de provider+content-id e região; protege também
Fonte/observação ainda inexistentes. Criação descobre Fontes sob o lock do Tema;
saúde descobre todos os Temas da Fonte antes de bloquear e valida novamente. A
importação editorial mantém o lock do Tema e adquire todas as identidades e linhas
de Fonte na mesma ordem global antes dos upserts. Não bloqueia nem consulta
observações, pois não as escreve e precisa funcionar no schema legado. Os upserts
continuam na ordem original da playlist; Entradas existentes preservam curadoria. Nenhum provider é chamado
pela transação; a observação continua sendo buscada antes de persistir saúde.

Há no máximo três tentativas para mudança de dependências ou SQLSTATE 55P03,
40P01 e 40001, inclusive causa encapsulada pelo driver. Exaustão retorna
`CATALOG_BUSY` (409). Falha de conexão/commit ambíguo não é repetida. Métricas são
emitidas depois do retorno da transação e sua falha não repete uma sessão.

Nenhuma migration, grant, policy ou tabela nova de produto. RLS server-only e
snapshots existentes permanecem. Os locks por Fonte custam consultas proporcionais
às Entradas do Tema; medir latência e EXPLAIN em QA antes da promoção. Não há
alegação de SLO ou de equivalência entre PGlite e PostgreSQL concorrente.

## Critérios → provas

| Critério                                                                | Evidência                                                                                      |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Published e N−1/N, sem linhas parciais                                  | `authoritative-game-creation.test.ts`: cada tamanho e conflito uniforme                        |
| Uma sessão, N snapshots, N−1 confrontos distintos                       | Mesmo teste: seis modalidades, consulta de estado persistido                                   |
| Projeção incorreta não autoriza                                         | Tabela de projeção deliberadamente adulterada no harness                                       |
| Fresh/grace inclusivos; exclui unknown/unavailable/inativa/outra região | Matriz de nove candidatas em SQL descartável                                                   |
| Rollback depois da sessão e depois de snapshots                         | Triggers de falha antes de `session_songs` e `game_matches`                                    |
| Degradação não altera títulos, trechos, pares ou decisão                | Criação → decisão real → persistência real de unavailable → edição do catálogo → releitura     |
| Relógio/política únicos, sem provider, allowlist/telemetria             | Relógio injetado, fetch proibido, exportador que lança após commit, allowlists explícitas      |
| POST estrito, anônimo, rate limit, erro seguro                          | Rota real + serviço + repositório + rate limiter em SQL efêmero                                |
| Retry limitado/sem repetição ambígua                                    | Falhas SQLSTATE no limite do banco e contagem de sessões persistidas                           |
| 32/64 principais e seleção explícita                                    | Tracer `authoritative-game-creation.spec.ts`, componentes existentes                           |
| Corrida real/ordem/retry/novo vínculo                                   | `tests/qa/cat06-postgres.test.ts` — **10/10 PostgreSQL real na R2; revisão do delta pendente** |
| RLS sem novas exposições                                                | Nenhuma alteração de schema/policies; migrations reais aplicadas aos harnesses                 |

O teste existente do repositório de saúde deixou de afirmar a sequência privada
de SQL mockado. Os mesmos cinco comportamentos CAS/reconciliação são exercitados
contra PGlite com migrations reais. O adaptador de teste apenas converte o formato
de resultado raw de PGlite para o de postgres-js, sem simular SQL/transações.

## Navegador e isolamento

O tracer reutiliza a fixture CAT-05, com banco efêmero, componentes de home/Tema e
handler de criação reais. Verifica 32 e 64, ausência de seleção automática,
contagens persistidas e releitura após refresh. A página de resultado de fixture
apresenta as contagens lidas pelo repositório; não altera o player do produto.
O rate limit é provado separadamente na rota real integrada.

Rotas adicionais somente em build `E2E_TEST_MODE=1`, exigindo header
`x-e2e-test: authoritative-catalog`. Não usam banco externo. Build normal deve
excluir `/e2e-test/authoritative-catalog/games` e `/jogo/[sessionId]` dessa fixture.
Porta exclusiva da rodada: 3146.

## PostgreSQL QA

O harness é opt-in e recusa hosts externos. Exige `CAT06_QA_DISPOSABLE=1` e
`CAT06_POSTGRES_ADMIN_URL` apontando para PostgreSQL **descartável em loopback**
com autorização de criar banco. Não lê `.env`, não usa `DATABASE_URL` do produto,
nem instala dependências. Cria `cat06_qa_<uuid>`, aplica migrations de produto
(excluindo as específicas de Storage), usa conexões independentes e remove somente
essa base gerada ao terminar. Roles anon/authenticated são criadas no servidor
descartável se faltarem; descartar o servidor após QA.

Com o ambiente descartável disponibilizado e autorizado:

```powershell
node node_modules/vitest/vitest.mjs run --config tests/qa/vitest.config.ts
```

Sem as variáveis, dez testes ficam explicitamente skipped; exit 0 nesse cenário
**não** satisfaz o gate. Os testes usam barreiras de commit e `pg_stat_activity`
para observar espera real: criação primeiro, saúde primeiro, 32/64, timeout real
e mudança de vínculo durante aquisição. A corrida de criação primeiro usa N
candidatas, inclusive para 32, e entropia fixa válida: a Fonte degradada é sempre
participante. Os dois cenários adicionais serializam criação A e importação B
com Fontes compartilhadas em ordem inversa, verificando ausência de deadlock/retry,
contagens completas e imutabilidade do snapshot depois de novas importações. O
décimo cenário verifica datas e reconciliação de Fonte/observação inicialmente
ausentes com o driver real. Não ajustar timeouts para fazê-los passar.

## Rollout, rollback e revisão

Manter produção legada até CAT-12. Antes do cutover, rollback pode voltar à criação
legada CAT-02. Depois de Disponibilidade virar fonte de verdade, preservar a leitura
direta e a revalidação transacional. Não reescrever sessões/snapshots.

Antes de ready-for-pm: executar PostgreSQL QA, revisar o SHA final com independência
em segurança/dados e aceitar os gates do handoff. Esta rodada não autoriza push,
PR, tracker, merge, deploy, migrations externas ou envio a outros chats.

## Correções da revisão (R2)

F1: o ramo legado constrói SQL sem editorial_state nem Disponibilidade. Duas
regressões SQL com migrations 0–6 (e 0–6 + somente 0011) criam uma sessão, quatro
snapshots distintos e três confrontos. Guardrails de produção continuam cobertos.

F2: a corrida de 32 exige uma participante que agora pertence ao conjunto exato
de N candidatas; não depende de uma seleção aleatória dentre 64 incluir a Fonte.

F3: a ordem global abrange importPlaylistTracks, incluindo identidades de Fontes
ainda inexistentes, sem depender de migrations autoritativas na importação.

G1 (P3): centralizar o hash foi adiado. As duas fórmulas existentes permanecem
equivalentes; este delta se limita a compatibilidade, prova e ordenação de locks.
Não há novo grant, migration, dependência, cutover ou mudança de UI.

F4 observado em QA PostgreSQL: parâmetros Date em SQL raw de saúde não eram
serializados pelo driver. Os seis campos temporais são enviados em ISO UTC,
preservando os instantes e nulls; o CAS e a política não mudam. Prova vermelha
registrou ERR_INVALID_ARG_TYPE, e o cenário de reconciliação ficou verde após a
correção isolada. A primeira execução vermelha de F2 foi bloqueada por F4; a
reexecução depois de F4 demonstrou a assertion de participante falsa.

Runtime de QA: PostgreSQL 17.11 descartável do PM, loopback 127.0.0.1:55436,
sem credenciais de produto. Os dez testes executaram sem skips; os filtros das
provas vermelhas excluíram explicitamente os demais cenários. Não há promoção ou
aceite integral antes da revisão independente do commit incremental.
