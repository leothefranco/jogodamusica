# Propagação global da saúde de Fontes — CAT-08

Uma observação de disponibilidade de uma Fonte compartilhada afeta todos os seus
Temas. Cadastro manual, revalidação e confirmação de playlist usam a mesma
persistência regional. A consulta ao provedor termina antes da transação; somente
resultados normalizados entram nela. A região permanece BR.

## Transação e concorrência

O coordenador lê Fonte → Entradas → Temas e acrescenta a origem da ação. Bloqueia
Temas em ordem de UUID, depois Fontes em ordem de identidade e suas observações.
Relê as dependências depois dos locks. Uma alteração do conjunto aborta a tentativa;
o retry limitado relê o conjunto, sem repetir a consulta externa válida. O timeout
de locks também cobre a primeira ativação do writer.

O resultado normalizado é aplicado ao predecessor corrente sob lock. Uma tentativa
antiga ou idêntica não avança revisão nem gera projeção ou outbox. A revisão avança
no banco, evitando que candidatos preparados sobre a mesma revisão inicial percam
uma observação posterior. Um erro transitório usa a confirmação corrente.

Observação, metadados vencedores, projeções de todos os dependentes, marcador de
ativação e outbox pertencem à mesma transação. Projeções usam uma consulta agregada
e um upsert em lote com o mesmo instante e política. Qualquer falha reverte todos
os efeitos. A confirmação de playlist também mantém suas associações no mesmo
commit; a associação manual posterior é uma alteração editorial separada.

A transição de saúde compara dados autoritativos antes/depois da observação, sem
usar uma projeção antiga como predecessor. Recuperação preserva `published`.
Retirar uma Entrada editorialmente não se torna incidente de saúde de 32/64.

## Outbox interno

`catalog_invalidation_outbox` identifica cada Fonte/região/revisão/Tema uma única
vez. Seu payload contém versões, hash interno da Fonte, ID/slug do Tema, transição
de domínio e cinco caminhos derivados: home, slug, admin, lista de Temas e editor.
Não contém título, URL do provedor, resposta bruta ou credencial. Constraints SQL e
parser estrito validam chaves, tipos, versões, destinos e modalidades 32/64.

O consumidor recebe linhas somente após commit. Uma instrução com
`FOR UPDATE SKIP LOCKED` reserva até 50 eventos com lease de 30 segundos e token.
O token protege confirmação/reagendamento contra um consumidor antigo. Todos os
caminhos precisam ser invalidados antes do ack. Falhas mantêm a linha pendente,
com retry exponencial limitado a 60 segundos. Repetir invalidação é idempotente;
falha de entrega ou telemetria não transforma saúde confirmada em erro da ação.

Os serviços acionam a drenagem após commit. Agendamento e processamento periódico
pertencem ao CAT-09; este ticket não cria scheduler nem endpoint de revalidação.

As migrations 0013/0014 são expansivas. Os dois novos recursos internos têm RLS
forçada, sem policies, com todos os privilégios revogados de PUBLIC, anon e
authenticated. O backend mantém sua conexão privilegiada existente. Os índices
cobrem Fonte → Entradas → Temas, Tema → Entradas, revisão e outbox pendente.

## Controle de QA e rollback

`CATALOG_GLOBAL_HEALTH_WRITE_MODE` é um controle interno do servidor. Não vem de
requests, formulários ou claims e não muda o modo público por conta própria.

| Configuração                                                                         | Resultado                                                        |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Ausente, dataset nunca ativado                                                       | Compatibilidade anterior e default público preservados           |
| enabled, Preview/QA, leitura authoritative_direct, schema interno seguro             | Writer global habilitado                                         |
| enabled, leitura authoritative_projected, projetor enabled                           | Mesmo writer com projeção atualizada                             |
| Projetor disabled, leitura authoritative_direct, writer enabled                      | Observação/outbox globais; leitura direta correta                |
| Consumidor disabled ou falho                                                         | Commit preservado e backlog recuperável                          |
| disabled, desconhecido, produção, schema inseguro/incompleto ou leitura incompatível | CATALOG_BUSY/409 antes do provedor                               |
| Ausente após ativação persistida                                                     | CATALOG_BUSY/409; sem fallback para um Tema                      |
| Modo muda entre provedor e transação                                                 | Operação recusada sem efeitos parciais                           |
| enabled retomado                                                                     | Revisões, observações, projeções, marcador e eventos preservados |

O guard consulta o schema e o marcador antes do provedor e dentro da transação.
A primeira ativação e um writer legado concorrente compartilham uma barreira
transacional; retirar a variável depois da ativação não restaura o legado.
Rollback mantém leitura CAT-05 direta, desliga projetor/consumidor conforme a
necessidade e preserva os dados. Desligar o writer bloqueia as três entradas.
Leitura projetada com projetor desligado é recusada pelo writer.

Não aplicar migrations ao banco do produto nem ativar ambientes externos como
parte de QA local. Backfill, reconciliação, cutover e decisão de produção são CAT-12.

## Observabilidade e evidência

Métricas de saúde registram resultado, número de Temas, transições, eventos,
retries e versões com causa health_change. Alterações editoriais registram
editorial_change e perdas agregadas de 32/64. Entrega registra ack/retry e idade do
evento. Nenhuma métrica usa IDs de Fonte/Tema como labels.

`tests/integration/source-health-global.test.ts` percorre serviços reais,
migrations/SQL, projeções, leitores direto/projetado e consumidor, usando PGlite e
provedor/cache controlados. Isso não prova locks entre conexões PostgreSQL reais
nem cache de um servidor Next em execução. Esses suplementos, gates canônicos e
revisão independente são requisitos separados antes do aceite integral.
