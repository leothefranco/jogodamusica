# CAT-01 — Visibilidade efetiva e saúde do tema

**Status:** ready-for-decomposition
**Depende de:** nenhuma

## Problem Statement

Como jogador, posso ver um Tema editorialmente publicado que já não possui quatro
músicas reproduzíveis. A saúde de uma Fonte reproduzível é global, mas a
revalidação administrativa protege apenas o Tema que está sendo editado. Quando a
mesma fonte é usada em vários temas, atualizar seu estado pode degradar todos eles
sem recalcular sua visibilidade.

A listagem pública filtra o booleano global de incorporação, porém não exige no
resultado agrupado o mínimo de quatro. A criação de partida também não possui um
contrato explícito para revalidar a quantidade dentro da transação. O banco não
distingue disponibilidade regional, recência, intenção editorial, visibilidade e
estado operacional. “Publicado” acaba significando decisões incompatíveis.

## Solution

Separar três dimensões do Tema:

- **estado editorial:** `draft` ou `published`;
- **visibilidade:** `visible` ou `hidden`, sempre derivada;
- **estado operacional:** `editorial_draft`, `healthy`, `degraded`,
  `suspended_pending_verification` ou
  `suspended_insufficient_healthy_entries`.

Uma Entrada do tema será jogável quando estiver editorialmente aprovada/ativa e
sua Fonte reproduzível possuir disponibilidade efetiva no Brasil. Disponibilidade
confirmada terá validade de sete dias e tolerância de 24 horas. Durante a
tolerância a fonte ainda poderá entrar na partida, mas degradará o Tema; depois
dela vira `unknown` e deixa de contar. Indisponibilidade confirmada deixa de contar
imediatamente.

Uma única regra de domínio calculará contagens, modalidades, visibilidade e estado
operacional. Consultas públicas usarão essa regra/projeção; a criação de partida
confirmará as candidatas nos dados-base dentro da própria transação. Atualizar uma
Fonte reproduzível recalculará todos os Temas dependentes, invalidará as leituras
afetadas e manterá alertas deduplicados.

## User Stories

1. Como jogador, quero ver somente Temas capazes de iniciar uma partida, para não
   escolher uma experiência impossível.
2. Como jogador, quero que um link direto para Tema oculto apresente um estado
   indisponível útil, sem expor detalhes administrativos.
3. Como jogador, quero que um Tema publicado que perdeu saúde desapareça da
   descoberta, para não falhar somente depois da escolha.
4. Como jogador, quero que 32 e 64 músicas sejam oferecidas somente com 32 ou 64
   candidatas efetivamente jogáveis.
5. Como jogador, quero que a modalidade selecionada seja confirmada novamente ao
   iniciar, para não criar uma sessão com quantidade insuficiente.
6. Como jogador, quero que uma partida já criada preserve seu snapshot, para uma
   mudança posterior do catálogo não reescrever confrontos.
7. Como editor, quero publicar a intenção editorial separadamente da saúde
   operacional, para uma falha técnica não apagar minha decisão.
8. Como editor, quero que a primeira publicação seja recusada com menos de quatro
   Entradas jogáveis, para não publicar algo sabidamente impossível.
9. Como editor, quero que uma degradação posterior suspenda a visibilidade sem
   voltar o Tema para rascunho, para recuperar automaticamente quando a fonte voltar.
10. Como editor, quero ver estado editorial, visibilidade e estado operacional em
    campos separados, para não confundir publicação com disponibilidade.
11. Como editor, quero ver contagens frescas, em tolerância, indisponíveis e
    desconhecidas no Brasil, para entender a causa do estado.
12. Como editor, quero ver as modalidades atualmente suportadas, com destaque para
    32 e 64, para proteger as duas experiências principais.
13. Como editor, quero saber quando a observação vence e quando foi a última
    tentativa, para reconhecer informação atrasada.
14. Como editor, quero que recuperar uma fonte restaure visibilidade e modalidade
    sem nova publicação manual.
15. Como editor, quero que revalidar uma fonte compartilhada atualize todos os
    Temas que a usam, não apenas o Tema aberto.
16. Como editor, quero distinguir perda causada por saúde de alteração editorial
    intencional, para não receber alertas falsos ao remover conteúdo.
17. Como editor, quero que importações novas não tratem fonte confirmadamente
    indisponível como candidata jogável.
18. Como editor, quero que itens já associados também possam ser revalidados, para
    corrigir o catálogo existente.
19. Como operador, quero uma política central e versionada de validade, tolerância
    e retry, para não espalhar números diferentes pelo sistema.
20. Como operador, quero que falha transitória do provedor preserve a última
    confirmação enquanto ela for válida, para evitar suspensão em massa.
21. Como operador, quero que uma confirmação de indisponibilidade produza efeito
    imediato, para não iniciar novas sessões com fonte conhecida como inválida.
22. Como operador, quero que fontes indisponíveis sejam revisitadas, para permitir
    recuperação sem intervenção manual.
23. Como operador, quero priorizar fontes vencidas usadas em Temas publicados e em
    muitos Temas, para reduzir impacto com a capacidade disponível.
24. Como operador, quero um backfill retomável e idempotente, para não depender de
    uma transação longa.
25. Como operador, quero reconstruir projeções a partir dos dados-base, para
    corrigir drift após falha ou intervenção.
26. Como operador, quero comparar a regra nova com a leitura vigente antes do
    cutover, para explicar cada mudança de visibilidade.
27. Como operador, quero no máximo um alerta aberto por Tema e tipo, para evitar
    duplicação por múltiplas fontes causais.
28. Como operador, quero que fontes causais sejam metadados do alerta, para manter
    contexto sem multiplicar alertas equivalentes.
29. Como operador, quero alertas distintos para suspensão e perda de 32/64 causada
    por saúde, para priorizar impacto.
30. Como operador, quero que recuperação feche automaticamente o alerta, para o
    painel não acumular incidentes resolvidos.
31. Como mantenedor, quero uma única função de classificação, para home, detalhe,
    admin e analytics não recriarem a tabela de decisão.
32. Como mantenedor, quero ignorar observação atrasada, para uma resposta antiga
    não sobrescrever saúde recente.
33. Como mantenedor, quero atualização idempotente, para repetir jobs com segurança.
34. Como mantenedor, quero uma navegação indexada de Fonte para Temas, para evitar
    varredura global em cada mudança.
35. Como revisor, quero um teste com uma Fonte compartilhada por dois Temas, para
    impedir a regressão concreta encontrada.
36. Como responsável por produto, quero medir Temas que suportam e perdem 32/64,
    para acompanhar as modalidades principais sem tratá-las como “maratonas”.
37. Como responsável por analytics, quero eventos separados de publicação,
    visibilidade, degradação e suspensão, para interpretar corretamente a jornada.
38. Como responsável por segurança, quero que o link público não revele motivos,
    IDs de fontes ou estado interno de verificação.

## Implementation Decisions

### Regra transitória imediata

- Antes de qualquer migration, listagem, detalhe, modalidades e criação de partida
  passarão a exigir ao menos quatro associações ativas com fonte marcada como
  incorporável no modelo legado.
- Esse guardrail não representa saúde regional definitiva; ele apenas fecha a
  possibilidade atual de expor menos de quatro candidatas enquanto o modelo novo
  é construído.
- Depois de existir disponibilidade autoritativa, nenhum rollback poderá voltar a
  uma consulta que ignore uma indisponibilidade regional já conhecida.

### Dados-base e política de frescor

- O estado editorial explícito será `draft` ou `published`. O booleano legado
  continuará em dual-write somente durante a migração.
- Na Fase 0, a associação editorial ativa existente será a aproximação de Entrada
  aprovada. Um review status explícito poderá substituí-la depois sem mudar a
  definição pública.
- O registro musical existente será a aproximação de Fonte reproduzível até a
  introdução da Faixa canônica e de múltiplas fontes.
- Haverá uma observação de Disponibilidade da fonte por Fonte reproduzível e região.
  O recorte ativo será `BR`; a região permanecerá parte da chave.
- O estado observado persistido será `available`, `unavailable` ou `unknown`, com
  motivo controlado, instante observado, última tentativa, última confirmação,
  `valid_until`, `grace_until`, próxima verificação e revisão monotônica.
- A política inicial será centralizada e versionada: confirmação `available` vale
  sete dias; após vencer, há tolerância de 24 horas; confirmação `unavailable`
  produz efeito imediato e é priorizada para nova verificação após 24 horas.
- Os valores acima são configuração de domínio, não constantes repetidas. Uma
  mudança futura incrementará a versão da política e reconstruirá projeções.
- A disponibilidade efetiva derivada será:
  - `available_fresh`: confirmação disponível dentro da validade;
  - `available_grace`: confirmação disponível dentro da tolerância;
  - `unavailable`: indisponibilidade confirmada mais recente;
  - `unknown`: sem confirmação, confirmação disponível além da tolerância ou dado
    insuficiente.
- `available_fresh` e `available_grace` contam para a partida; a segunda sempre
  gera degradação. `unavailable` e `unknown` não contam.
- Erro transitório do provedor atualiza tentativa, erro e backoff, mas não troca
  uma confirmação disponível ainda válida por indisponível. Ao fim da tolerância,
  o estado efetivo se torna `unknown` mesmo que o verificador continue falhando.
- Observações com revisão/instante anterior ao estado persistido serão ignoradas.
  Repetir a mesma observação não criará nova versão nem novo alerta.

### Estado efetivo do Tema

- A projeção reconstruível persistirá contagens de Entradas aprovadas,
  `available_fresh`, `available_grace`, `unavailable` e `unknown`, modalidades
  suportadas, estado editorial, visibilidade, estado operacional, versão da regra
  e instante de cálculo.
- `playable_count` será a soma de `available_fresh` e `available_grace`.
  `potential_count` adicionará as fontes `unknown` para distinguir falta de
  confirmação de insuficiência conhecida.
- A tabela de decisão será exclusiva:

| Estado editorial | Condição operacional                                    | Visibilidade | Estado operacional                       |
| ---------------- | ------------------------------------------------------- | ------------ | ---------------------------------------- |
| `draft`          | qualquer                                                | `hidden`     | `editorial_draft`                        |
| `published`      | `playable_count >= 4` e nenhum aviso                    | `visible`    | `healthy`                                |
| `published`      | `playable_count >= 4` e há fonte em tolerância/problema | `visible`    | `degraded`                               |
| `published`      | `playable_count < 4` e `potential_count >= 4`           | `hidden`     | `suspended_pending_verification`         |
| `published`      | `playable_count < 4` e `potential_count < 4`            | `hidden`     | `suspended_insufficient_healthy_entries` |

- Aviso operacional inclui fonte aprovada ativa em tolerância, indisponível ou
  desconhecida e perda de uma modalidade principal causada por mudança de saúde.
- A transição inicial `draft → published` será recusada quando `playable_count < 4`.
  Uma queda posterior preservará `published`, mudará a projeção para suspensa e
  ocultará o Tema.
- Uma alteração editorial intencional terá causa distinta de uma atualização de
  saúde. Perda de 32/64 por saúde abrirá alerta; mudança editorial será registrada
  como decisão do editor, sem fingir incidente do provedor.
- Modalidades serão derivadas de `playable_count`. Os limiares 32 e 64 terão
  contagens e transições explícitas, sem categorização como “Maratona”.
- Uma função de domínio única produzirá a classificação. Repositórios e telas não
  recriarão condicionais equivalentes.

### Leituras, criação de partida e mutações globais

- A leitura de compatibilidade continuará agrupando e exigindo quatro candidatas.
  Depois do cutover, as superfícies públicas consumirão somente projeções visíveis.
- Home, detalhe, modalidades e analytics usarão o mesmo significado de visibilidade.
  Um link para Tema oculto retornará estado público genérico, sem motivo interno.
- A projeção acelera leitura, mas não autoriza sozinha a criação de partida.
- Dentro da transação de criação, o sistema bloqueará o Tema e as linhas relevantes
  sob uma ordem determinística, consultará Entradas e Disponibilidade nos dados-base
  com o mesmo instante/política, escolherá exatamente a modalidade solicitada e só
  então persistirá sessão, candidatas e confrontos.
- Se a quantidade autoritativa for insuficiente, a transação não persistirá sessão,
  músicas ou confrontos parciais. Uma mudança de saúde concorrente será serializada
  pela mesma disciplina de locks.
- Depois de criada, a sessão usa seu snapshot. Uma mudança externa posterior não
  reescreve a partida já iniciada.
- Toda atualização confirmada de uma Fonte reproduzível localizará a lista completa
  de Temas dependentes, inclusive o Tema que motivou a operação.
- Chamadas externas ocorrerão antes da transação curta. Persistência da observação,
  recálculo set-based, alertas e outbox/invalidação serão confirmados juntos.
- Locks de saúde e criação seguirão uma ordem global documentada para evitar
  deadlock entre Fonte e Temas.
- Atualizações invalidarão home, slugs e painel afetados. O mecanismo concreto de
  cache poderá mudar sem alterar o contrato.
- Importação e revalidação administrativa usarão a mesma mutação global; nenhuma
  delas atualizará apenas o Tema em tela.

### Alertas, jobs e reconciliação

- A chave de deduplicação será Tema + tipo de alerta. Fonte causal, contagens,
  modalidade e versão da política serão metadados, não parte da chave.
- Os tipos mínimos serão `theme_suspended` e `primary_mode_lost`. Recuperação
  resolverá o alerta; uma nova ocorrência poderá reabri-lo com histórico.
- Um job idempotente e invocável manualmente revalidará lotes por `next_check_at`,
  priorizando Temas publicados, fontes compartilhadas e observações na tolerância.
  O mecanismo de agendamento ficará fora do serviço de domínio.
- O backfill usará cursor e checkpoint persistido, aceitará retry e nunca exigirá
  transação do catálogo inteiro.
- Uma reconciliação recalculará projeções a partir dos dados-base, corrigirá drift
  e emitirá resultado sem duplicar alertas.
- Índices cobrirão Fonte/região/próxima verificação e a navegação Fonte → Entradas
  do tema → Tema.

### Cutover e rollback

- Uma leitura sombra comparará a regra de compatibilidade, a consulta autoritativa
  direta e a projeção sem alterar a experiência.
- O cutover exigirá cobertura de todas as Fontes candidatas de Temas publicados,
  divergências explicadas, reconciliação sem drift e seam multi-Tema verde.
- Antes de existir cobertura, o único rollback admissível é o guardrail legado com
  mínimo de quatro. Depois de a disponibilidade ser fonte de verdade, rollback da
  projeção usará a consulta autoritativa direta com a mesma política de frescor,
  ainda que seja mais lenta.
- Dados de Disponibilidade e dual-write serão preservados durante rollback. Nunca
  será restaurada uma leitura que conte fonte conhecida como indisponível no Brasil.

## Testing Decisions

- O seam principal começa numa atualização de Disponibilidade da fonte e termina
  nas consultas públicas, modalidades e criação de partida de todos os Temas
  dependentes.
- O teste crítico criará dois Temas publicados compartilhando uma Fonte. Ao
  confirmá-la `unavailable`, ambos serão recalculados e cada um abaixo de quatro
  ficará oculto.
- Um Tema com três candidatas nunca aparece; com quatro aparece. O detalhe por slug
  aplica exatamente a mesma regra da listagem.
- A primeira publicação com três candidatas será recusada. A degradação posterior
  de quatro para três preservará `published` e produzirá um estado suspenso.
- As transições 64→63 e 32→31 removem somente a modalidade correspondente e abrem
  alerta quando a causa é saúde; uma alteração editorial intencional não cria esse
  falso incidente.
- Casos de tabela cobrirão todos os estados operacionais e provarão que exatamente
  uma linha se aplica a cada combinação.
- Testes com relógio controlado cobrirão o último instante dos sete dias, o início e
  fim da tolerância de 24 horas e a transição final para `unknown`.
- Erro transitório preservará confirmação válida, usará tolerância e depois se
  tornará `unknown`; confirmação `unavailable` produzirá efeito imediato.
- Observação antiga não sobrescreverá uma nova; observação idêntica não mudará
  versão nem duplicará alertas.
- A deduplicação manterá um alerta aberto por Tema/tipo mesmo com várias Fontes
  causais; os metadados refletirão o conjunto atual.
- A recuperação restaurará visibilidade/modalidade e resolverá os alertas aplicáveis
  sem alternar o estado editorial.
- A criação de partida será testada com atualização de saúde concorrente. Ou o
  snapshot válido é persistido por inteiro, ou nenhuma parte da sessão existe.
- Um teste provará que a criação consulta dados-base e rejeita uma projeção
  deliberadamente desatualizada.
- Uma sessão já iniciada permanecerá imutável após a degradação.
- Revalidação de item existente e importação atualizarão todos os Temas que
  compartilham a Fonte.
- Backfill interrompido retomará do checkpoint sem duplicar dados; jobs concorrentes
  não processarão a mesma claim de forma conflitante.
- A reconciliação corrigirá uma projeção adulterada e registrará drift.
- A leitura sombra produzirá diferenças determinísticas sem alterar visibilidade.
- O teste de rollback pós-cutover usará a consulta autoritativa e provará que uma
  Fonte conhecida como indisponível não volta a contar.
- Testes reais de banco cobrirão unicidade Fonte/região, migrations, índices,
  concorrência, locks e dados legados.
- Um tracer público cobrirá home → Tema → início e confirmará que nenhuma modalidade
  apresentada excede a contagem efetivamente persistida no snapshot.

## Out of Scope

- Introduzir Faixa canônica e múltiplas Fontes por gravação.
- Implementar review status editorial completo.
- Criar ranking, pesquisa ou recomendação.
- Revalidar regiões além de BR.
- Substituir automaticamente uma Fonte indisponível.
- Alterar snapshots de partidas já iniciadas.
- Personalizar visibilidade por jogador.
- Despublicar editorialmente um Tema por falha técnica.
- Guardar histórico indefinido de cada tentativa do provedor.
- Resolver lifecycle de capas.
- Escolher e configurar canal externo de alertas.

## Further Notes

- Esta é uma spec de épico, não um ticket único. A execução será decomposta, sem
  sobrepor mais de duas frentes, em:
  1. guardrail legado imediato em listagem, detalhe, modalidades e criação;
  2. schema de estado editorial/Disponibilidade e backfill;
  3. projeção e leituras públicas;
  4. mutação global e concorrência multi-Tema;
  5. jobs e reconciliação;
  6. alertas e painel administrativo;
  7. leitura sombra, cutover e rollback autoritativo.
- O glossário do domínio passa a registrar Tema publicado, jogável, visível,
  degradado e suspenso, além de Entrada do tema, Fonte reproduzível e
  Disponibilidade da fonte.
- Métricas mínimas: Temas por estado operacional, Fontes por disponibilidade
  efetiva, idade p50/p95, cobertura, transições, impacto por Fonte, suporte e perda
  de 32/64, drift, alertas e falhas do verificador.
- Critério de saída do épico: nenhuma consulta pública nem criação de partida aceita
  Tema/modalidade com quantidade insuficiente; uma mudança de Fonte compartilhada
  afeta todos os dependentes; rollback não reintroduz indisponibilidade conhecida.
