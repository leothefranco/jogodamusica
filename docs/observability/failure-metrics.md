# Métricas de falha pública

## Contrato operacional

O exporter inicial escreve um JSON estruturado por linha e pode ser desligado com
`OBSERVABILITY_EXPORTER=none`. Desligá-lo não remove a resposta segura, o UUID de
correlação, a redaction nem restaura o log cru de playback.

Configuração versionada, sem valores secretos:

| Variável                           | Padrão       | Valores aceitos                           |
| ---------------------------------- | ------------ | ----------------------------------------- |
| `OBSERVABILITY_ENVIRONMENT`        | derivado     | `local`, `preview`, `production`          |
| `OBSERVABILITY_EXPORTER`           | `structured` | `structured`, `none`                      |
| `OBSERVABILITY_RAW_RETENTION_DAYS` | `30`         | inteiro de 1 a 30                         |
| `RELEASE_COMMIT`                   | ausente      | SHA Git hexadecimal com 7 a 64 caracteres |

`OBSERVABILITY_RAW_RETENTION_DAYS` configura somente a declaração de retenção dos
exporters. O parser e cada adapter recusam valores fora de 1–30 dias, e os
exporters expõem `configuredRawRetentionDays`, `enforcement=external_collector` e
`collectorVerification=required_before_rollout`. O adapter estruturado escreve em
`console.info`; ele não aplica expiração nem comprova exclusão no coletor. Não há
endpoint, credencial ou fornecedor embutido. Agregados diários são mantidos por
12 meses.

### Gate externo de retenção

O rollout em `preview` ou `production` permanece bloqueado até
Segurança/Operações, em uma atividade autorizada de ambiente, registrar evidência
de que o coletor real mantém o bruto por prazo igual ou menor que o declarado e
nunca superior a 30 dias. Esta tarefa não acessa nem configura esse coletor. A
declaração versionada prova a intenção/configuração da aplicação, não o
enforcement externo.

| Métrica                          | Fórmula                                                 | Unidade    | Owner primário | Owner secundário    | Ação esperada                                                                   |
| -------------------------------- | ------------------------------------------------------- | ---------- | -------------- | ------------------- | ------------------------------------------------------------------------------- |
| `request_failures_daily`         | `count(eventName = request_failed)` por dia UTC         | falhas/dia | Engenharia     | Segurança/Operações | Investigar qualquer novo 5xx e variação relevante por surface/code/release      |
| `player_playback_failures_daily` | `count(eventName = player_playback_failed)` por dia UTC | falhas/dia | Engenharia     | Segurança/Operações | Investigar variação relevante por código/release e indisponibilidade recorrente |

## Dimensões e cardinalidade

Dimensões comuns: `eventName` (2), `environment` (3) e `releaseCommit` (máximo
operacional de 20 releases observadas por dia; ausência vira `unknown` no
agregador). `correlationId`, timestamps individuais e qualquer identificador de
jogador, sessão, confronto ou provider nunca são dimensão, label ou parte do
snapshot agregado.

`request_failures_daily` acrescenta `surface` (6), `failureClass` (2),
`errorCode` (3) e `status` (100), para teto teórico de 216.000 combinações por dia
considerando os 20 releases e todos os ambientes. `player_playback_failures_daily`
acrescenta `surface` (1), `failureClass` (1) e `playerErrorCode` (5), para teto
teórico de 300 combinações por dia. Alertar e interromper novas dimensões se o
teto operacional de releases for excedido.

Depois de liberar o gate externo, o rollout começa em sombra: comparar a contagem
de `request_failed` com as respostas HTTP 5xx e validar a suíte de redaction antes
de usar os agregados em preflight ou snapshot.
