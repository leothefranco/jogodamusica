# OBS-01 — Baseline operacional e de produto

**Status:** ready-for-decomposition
**Depende de:** vocabulário de CAT-01 para o recorte de catálogo

## Problem Statement

Como equipe pequena, ainda não possuímos uma baseline confiável para distinguir
melhoria, regressão e ruído em conclusão de partidas, abandono, erros, latência,
saúde do catálogo e falhas de assets. O plano mestre exige owner, definição e
retenção, mas o checklist atual registra apenas o resultado de comandos.

Sem um contrato mínimo, diferentes superfícies podem emitir eventos com textos
livres, dados sensíveis ou significados incompatíveis. Também existe o risco de
inventar metas numéricas antes de haver amostra representativa.

## Solution

Definir um contrato vendor-neutral de eventos estruturados, agregados e snapshots
de release. Cada métrica terá nome, significado, dimensão permitida, owner por
papel, fonte, retenção e ação esperada. Eventos brutos serão minimizados e
redigidos; relatórios operacionais não dependerão de conta de jogador nem
identificador persistente de pessoa.

Instrumentar primeiro as invariantes e os pontos de decisão da Fase 0. Limiares de
produto e performance só serão fixados depois de amostra mínima; segurança,
integridade e erros 5xx permanecem observáveis e acionáveis desde o primeiro evento.

## User Stories

1. Como responsável por produto, quero medir início, conclusão, abandono e retomada
   por modalidade, para entender especialmente 32 e 64 músicas.
2. Como responsável por produto, quero abandono por rodada/quartil, para localizar
   onde a experiência longa perde grupos.
3. Como responsável por produto, quero distinguir partida nova de retomada, para
   avaliar a recuperação sem criar contas.
4. Como responsável por produto, quero que a campeã ou título musical não vá para
   analytics, para evitar texto desnecessário.
5. Como responsável por engenharia, quero contar erros 5xx por código e superfície,
   para identificar falhas sistêmicas.
6. Como responsável por engenharia, quero latência p50/p95 de início e decisão,
   para construir uma baseline antes de definir SLO.
7. Como responsável por engenharia, quero vincular erro e release por commit, para
   localizar a regressão sem logar dados do jogador.
8. Como responsável por engenharia, quero um reporter comum para AppError e falhas
   inesperadas de Server Actions/rotas, para não perder erros fora de uma API.
9. Como responsável editorial, quero Temas por estado operacional e contagens de
   suporte a 32/64, para priorizar manutenção do catálogo.
10. Como responsável editorial, quero cobertura e idade de Disponibilidade da
    fonte, para reconhecer dado vencido.
11. Como responsável editorial, quero contar suspensão, recuperação e perda de
    modalidade, para medir impacto de fontes compartilhadas.
12. Como responsável editorial, quero contar compensações e falhas de compensação
    de capa, para reconhecer resíduo no Storage.
13. Como responsável editorial, quero conhecer ativações do fallback público, para
    localizar dívida de imagem sem registrar a URL quebrada.
14. Como responsável por segurança/operações, quero contar recusas de autorização,
    rate limit e audit incompleto, para detectar abuso ou configuração incorreta.
15. Como responsável por privacidade, quero proibir e-mail, IP bruto, token, URL com
    segredo, capability, texto livre e conteúdo musical nos eventos.
16. Como operador, quero um correlation ID seguro entre request, erro e release,
    para investigar sem expor o identificador de controle da partida.
17. Como operador, quero retenção curta de evento bruto e longa de agregado, para
    equilibrar investigação, tendência e minimização.
18. Como operador, quero um snapshot por release, para comparar estado antes/depois
    sem depender da retenção do backend de logs.
19. Como revisor, quero validar schema e redaction automaticamente, para um campo
    proibido falhar antes de produção.
20. Como mantenedor, quero trocar o fornecedor de observabilidade sem mudar o
    significado dos eventos, para evitar lock-in do domínio.
21. Como equipe, quero owner por papel e ação esperada, para uma métrica não existir
    sem alguém responsável por interpretá-la.
22. Como equipe, quero marcar amostra insuficiente, para não apresentar variação
    pequena como conclusão estatística.

## Implementation Decisions

### Contrato e privacidade

- Eventos terão envelope versionado com nome controlado, versão do schema,
  timestamp, ambiente, commit/release, correlation ID aleatório e payload tipado.
- IDs internos de Tema poderão existir somente quando necessários à ação editorial;
  títulos, artistas, termos livres, URLs de mídia e IDs do provedor não serão
  enviados.
- Não serão coletados e-mail, nome, IP bruto, user agent completo, token de sessão,
  capability de controle, URL com query sensível nem identificador publicitário.
- A jornada anônima usará eventos agregáveis de sessão da partida. Não haverá um
  perfil comportamental persistente de pessoa/dispositivo.
- Campos desconhecidos serão rejeitados ou descartados pelo adapter de telemetria;
  o domínio não aceitará um mapa livre de atributos.
- Um filtro central de redaction será aplicado antes de qualquer exporter. O
  exporter será uma porta substituível e poderá inicialmente escrever logs
  estruturados.

### Métricas e owners

| Owner primário      | Família                      | Medidas mínimas                                                                |
| ------------------- | ---------------------------- | ------------------------------------------------------------------------------ |
| Produto             | jornada da partida           | starts, completes, abandons, resumes e duração por modalidade/rodada-quartil   |
| Engenharia          | confiabilidade e performance | 5xx, códigos de erro, p50/p95 de início/decisão, build e smoke por release     |
| Editorial/Operações | catálogo e assets            | estados de Tema, frescor, cobertura, 32/64, transições, compensação e fallback |
| Segurança/Operações | abuso e controles            | recusas de autorização, 429, audit coverage e versão vulnerável                |

- Cada definição registrará fórmula, unidade, dimensões permitidas, fonte,
  cardinalidade máxima, owner secundário e ação esperada quando variar.
- `game_start`, `game_complete`, `game_abandon`, `game_resume`,
  `source_health_transition`, `theme_operational_transition`,
  `primary_mode_lost`, `cover_compensation`, `cover_fallback`,
  `request_failed`, `authorization_denied` e `rate_limited` formarão o vocabulário
  inicial; nomes finais permanecerão controlados no catálogo de eventos.
- Todo erro inesperado ou AppError com status maior ou igual a 500 passará pelo
  reporter comum. O cliente recebe código/correlation ID seguro; detalhes e stack
  ficam somente no canal operacional redigido.
- Erros esperados 4xx serão medidos por código agregado quando úteis, nunca com
  payload ou mensagem livre do usuário.

### Agregação, amostra e retenção

- Eventos brutos operacionais e de produto terão retenção padrão de 30 dias.
  Agregados diários e snapshots de release serão mantidos por 12 meses. Evidência
  do release será preservada enquanto o artefato puder ser promovido ou receber
  rollback.
- A retenção será configuração documentada no backend escolhido; mudar fornecedor
  não alterará os contratos.
- Agregados serão reconstruíveis ou verificáveis a partir de fixtures conhecidas.
  Acesso a evento bruto será restrito ao papel operacional necessário.
- Produto não fixará meta de conclusão por 32/64 até existir amostra mínima
  declarada. Performance não fixará p95 até existir volume suficiente por
  superfície. O relatório exibirá `insufficient_sample` em vez de extrapolar.
- A amostra mínima será uma decisão versionada do catálogo de métricas, baseada no
  tipo de medida e dispersão observada; não será uma constante arbitrária escondida
  na UI.
- Invariantes binárias — vulnerabilidade crítica, Tema visível injogável, perda de
  persistência, erro de build e vazamento de segredo — não dependem de amostra e
  permanecem blockers.
- Um snapshot de release reunirá commit, versões, resultados do gate, contagens
  agregadas de saúde e comparação com o último release compatível.

## Testing Decisions

- Schemas de evento serão testados com payload válido, campo desconhecido, versão
  incompatível e ausência de atributo obrigatório.
- Uma suíte de redaction usará valores sentinela para e-mail, IP, token, capability,
  URL com senha/query e texto livre, provando que nenhum chega ao exporter.
- O reporter será testado em rota, Server Action e falha inesperada: todo status
  5xx emite exatamente um evento correlacionado e não muda a mensagem segura do
  cliente.
- Eventos repetidos/retry terão chave ou regra idempotente quando a métrica exigir,
  para não inflar conclusão ou transição.
- Agregações de início, conclusão, abandono e retomada serão verificadas com
  fixtures de 32/64 e diferentes rodadas/quartis.
- A classificação de catálogo usará os estados definidos em CAT-01; transições
  duplicadas não inflarão alertas nem métricas.
- Compensação de capa e fallback serão testados sem object key completo, URL ou
  conteúdo no payload.
- Um teste de cardinalidade rejeitará dimensões livres e garantirá limites por
  família de evento.
- O snapshot de release será reproduzido com dados fixos e comparado ao release
  anterior, incluindo `insufficient_sample`.
- O mesmo contrato será executado com exporter em memória e exporter estruturado,
  provando independência de fornecedor.

## Out of Scope

- Escolher, comprar ou configurar dashboard de fornecedor específico.
- Criar conta ou perfil comportamental de jogador.
- Coletar termos livres de pesquisa ou conteúdo das músicas.
- Definir metas comerciais ou SLO antes da baseline amostral.
- Implementar experimentos A/B e atribuição de campanha.
- Construir data warehouse, vector database ou pipeline de ML.
- Definir alertas externos por e-mail, Slack, SMS ou pager.
- Substituir o admin por uma central completa de observabilidade.

## Further Notes

- Esta é uma spec de épico. A decomposição recomendada é: catálogo de eventos e
  redaction; reporter de erros; eventos/agregados de partida; snapshot de
  catálogo/assets; evidência de release e documentação de ownership.
- OBS-01 recebe os significados de estado de CAT-01, mas sua infraestrutura de
  eventos e erros pode avançar em paralelo à projeção de catálogo.
- Rollout: exporter em sombra, comparação com contagens determinísticas, validação
  de redaction e só então uso no preflight. Rollback desliga o exporter, preserva
  o reporter local e não afeta a transação de negócio.
- Critério de saída: cada métrica mínima possui contrato, owner, retenção e ação;
  eventos proibidos falham em teste; o release produz snapshot redigido sem fingir
  significância quando a amostra é insuficiente.
