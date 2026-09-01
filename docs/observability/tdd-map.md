# OBS-02 — mapa TDD

| Critério | Seam confirmado                             | Prova planejada                                                                                        |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| AC-1     | `observabilityEventSchema`                  | Envelope válido, campo desconhecido, versão incompatível e obrigatório ausente                         |
| AC-2     | redaction central                           | Matriz aninhada de texto livre, e-mail, IP, bearer/token, capability, connection string e URL sensível |
| AC-3/4   | `handlePublicGameRequest` + `errorResponse` | Resposta HTTP real por superfície/classe, com igualdade entre header, corpo e evento                   |
| AC-5     | contexto de correlação da falha             | Duas fronteiras com a mesma falha emitem uma vez                                                       |
| AC-6     | reporter com exporter substituível          | Exporter que lança não altera a resposta pública                                                       |
| AC-7     | `reportGamePlaybackError`                   | Cinco códigos aceitos e evento sem identificadores crus                                                |
| AC-8     | exporters em memória e estruturado          | Contract tests compartilhados; correlation ID fora das dimensões                                       |
| AC-9     | fronteira canônica de env + exporters       | Ambiente derivado, falha explícita e declaração externa limitada a 30 dias                             |
| AC-10    | rotas e suíte existentes                    | Contratos 4xx/rate limit e gates completos                                                             |

O registro red/green/refactor será mantido neste documento durante os ciclos.

## Registro red/green

| Slice                          | Red                                        | Green                                                                    |
| ------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| Baseline focado                | —                                          | 33 testes existentes                                                     |
| AC-1 envelope `request_failed` | módulo ausente                             | envelope válido                                                          |
| AC-1 contrato estrito/UTC      | campo desconhecido aceito                  | desconhecido, versão, obrigatório, UTC e release inválidos rejeitados    |
| AC-1/7 playback                | evento desconhecido                        | cinco códigos e payload fechado                                          |
| AC-2 redaction                 | módulo ausente                             | matriz aninhada sem sentinelas                                           |
| AC-8 exporters                 | módulo ausente                             | memória e estruturado equivalentes                                       |
| AC-6 reporter                  | exceção do exporter propagada              | falha isolada e texto livre bloqueado                                    |
| AC-9 configuração              | parser ausente / retenção 31 aceita        | parser e adapters limitados a 30 dias                                    |
| AC-3/4/5 resposta              | AppError 5xx sem UUID/evento               | resposta segura, UUID comum e deduplicação                               |
| AC-3 superfícies               | `request_failed` ausente                   | cinco operações/quatro superfícies e duas classes                        |
| AC-7 playback no serviço       | factory ausente                            | cinco eventos sem IDs crus                                               |
| AC-6 playback                  | falha do reporter propagada                | resultado de negócio preservado                                          |
| AC-8 dimensões                 | helper ausente                             | `correlationId` excluído do agregado                                     |
| Revisão AC-2                   | IPv6 intacto / redactor fora do reporter   | IPv4/IPv6 e sentinelas passam por redaction antes do exporter            |
| Revisão AC-3/4/6               | prova parcial por mock                     | cinco operações 4xx, resposta HTTP + exporter em memória e falha isolada |
| Revisão AC-5                   | `WeakMap` global suprimia nova requisição  | contexto explícito deduplica apenas as fronteiras da mesma requisição    |
| Revisão de escopo              | AppError 5xx admin alterado                | correlação segura ativada somente pela fronteira pública                 |
| Follow-up surfaces             | themes/imagem fora da fronteira            | unexpected/AppError 5xx/4xx por rota, UUID comum e emissão única         |
| Follow-up redaction composta   | snake/kebab/camel vazavam                  | strings, objetos aninhados, console e exporter sem sentinelas            |
| Follow-up env                  | produção virava local / inválida desligava | env canônico deriva ambiente; diagnóstico seguro e falha explícita       |
| Follow-up retenção             | propriedade sugeria enforcement local      | declaração externa verificável; rollout bloqueado até gate do coletor    |

Refactor e revisão do diff são feitos somente depois dos ciclos verdes, conforme a
skill TDD.
