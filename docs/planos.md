# Planos do projeto — índice e continuidade

Consolidado em **28/09/2026**. Este é o ponto de entrada para o PM e para novas
sessões. Consulte o [estado de implementação](./estado-implementacao.md) para o
retrato datado e o GitHub/Git para o estado vivo. Documento versionado não significa
funcionalidade implantada.

## Decisões e precedência

As instruções atuais do usuário e [AGENTS.md](../AGENTS.md) orientam a execução.
O [plano Last Track Standing](./plano-last-track-standing.md) é a decisão vigente
para nome, identidade e idiomas: **C / Encore + ícone 01 / Original elétrico**.
As propostas anteriores de marca ficam como histórico. Os contratos funcionais
de [CONTEXT.md](../CONTEXT.md) e os critérios das issues continuam válidos.

A Fase 0 do plano de evolução é posterior ao MVP; não reinicia sua fundação.
Identifique trabalho por URL/número de issue: o código SEC-02 do plano mestre
(rate limit/cardinalidade) não é a correção fast-uri encerrada na issue #42.

## Inventário conferido

| Documento                                                                                                                                 | Uso e situação                                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| [Especificação original do MVP](../jogo-da-musica-especificacao-codex.md)                                                                 | Base histórica; fases 0–5 implementadas, QA externo da fase 6 ainda exige evidência própria.                          |
| [Melhorias de 11/08](./plano-melhorias-projeto.md)                                                                                        | Diagnóstico histórico; números e falhas daquela data não substituem nova auditoria.                                   |
| [Plano mestre de evolução de 24/08](./plano-mestre-evolucao-2026-08-24.md)                                                                | Roadmap amplo preservado; estado atualizado no ledger, decisões visuais superadas pelo plano LTS.                     |
| [Specs da Fase 0 de evolução](./specs/fase-0/README.md) e [mapa de tickets](./specs/fase-0/proposta-tickets.md)                           | Recuperados da PR #34; especificações de origem das issues #5–#33. Estados antigos são históricos.                    |
| [Last Track Standing](./plano-last-track-standing.md)                                                                                     | Aprovado para execução: marca/interface/PWA em português, depois pt-BR/en; expansão regional em etapa posterior.      |
| [Mockups das três identidades](./design/last-track-standing/README.md) e [estudo de ícones](./design/last-track-standing/icons/README.md) | Referências versionadas; C e ícone 01 selecionados. Coroa nas capturas antigas deve ser substituída na implementação. |
| [Duelo visual](./design/duelo-visual.md)                                                                                                  | Histórico das entregas #47–#50; a marca futura passa a seguir LTS.                                                    |
| [UI-REFINO-02](./design/ui-complete-refinement.md)                                                                                        | Contrato funcional/responsivo integrado; preservado na nova identidade.                                               |
| [Importação de playlist, fase 2.1](./spec-fase-2.1-importacao-playlist.md)                                                                | Especificação existente, com [QA 2.1](./qa-fase-2.1.md) e [QA 2](./qa-fase-2.md).                                     |
| [Checklist de produção](./checklist-producao.md) e [QA externo](./qa-externo-fase-6.md)                                                   | Runbooks de validação/release; pendências não são encerradas pela consolidação documental.                            |
| [Pesquisa de publicação e breakeven](./pesquisa-breakeven-publicacao.md)                                                                  | Pesquisa local agora preservada; custos/políticas de 10/08, sem atualização ou aprovação comercial nesta rodada.      |
| [Pesquisa de importação](./pesquisa-importacao-playlist-youtube.md) e [cota YouTube](./pesquisa-cota-youtube-beta.md)                     | Referências já versionadas; revalidar informações temporais quando orientarem nova decisão.                           |
| [PM](./agents/project-manager.md), [desenvolvedor](./agents/developer.md) e [reviewer](./agents/reviewer.md)                              | Runbooks recuperados da PR #34; modelo e instruções atuais de AGENTS.md prevalecem.                                   |

As evidências de entregas integradas permanecem em [QA CAT-04](./qa/cat-04.md),
[QA editorial](./qa/visual-editorial.md), [QA mobile](./qa/duel-mobile-refinement.md),
[QA UI-REFINO-02](./qa/ui-complete-refinement.md) e
[REL-01](./security/rel-01-next-patch.md).

## Lacunas corrigidas e limites da conferência

O plano mestre, nove documentos da Fase 0 e três runbooks de agentes existiam
somente na PR #34, ainda conflitante. Foram recuperados do commit
`a1c3ecd987818c38863d0f8c0ed2ec52c3ed82e7`, com avisos de precedência,
sem substituir o CONTEXT.md atual. O plano LTS, seus assets e a pesquisa de
publicação estavam locais e sem versionamento.

A consolidação torna esse material disponível na branch/PR desta entrega. A PR
#34 só deve ser encerrada como substituída depois da integração desta documentação
e da conferência do seu diff remanescente. Sua alteração histórica em CONTEXT.md
precisa ser comparada semanticamente, sem restaurar regras obsoletas.

Conferência: arquivos locais de planejamento, planos das PRs abertas #34/#37/#51,
Git remoto e issues #5–#33. Material de sessões não salvo em arquivo ou tracker não
é considerado consolidado por inferência. A pasta local `listas-trap-2016-2022/`
contém material editorial separado e fica preservada fora desta entrega.

## Continuidade do PM

Pedido do usuário em 28/09: consolidar os planos, encaminhar ao PM e prosseguir
com a implantação; transferir para outra sessão se necessário. A direção visual
já está decidida. Use `gpt-6-astra`, conforme AGENTS.md.

1. Reconciliar e integrar a PR de consolidação após revisão/gates aplicáveis.
   Confirmar que os arquivos acima estão no commit-base dos desenvolvedores.
2. Atualizar CAT-05 #13 com a PR #51, head
   `c438642ba55a2089d418b17cac329946da6508e7`: draft, CI aprovado na conferência,
   sem merge. Preservar o escritor existente e concluir revisão/integração pelo
   protocolo do PM. #14/#15 continuam bloqueadas até #13 ser entregue.
3. Criar ou reutilizar issues para LTS-01 a LTS-05, com critérios do plano,
   dependências e links aos mockups. Iniciar LTS-01 na vaga disponível e coordenar
   a edição da home em LTS-02 com CAT-05. Manter no máximo dois tickets em andamento.
4. Entregar Release A (marca/interface/admin/PWA em português); depois Release B
   (pt-BR/en). LTS-06 exige escolha dos mercados antes de implementação regional.
5. Manter OBS-02 #10/PR #37 estacionado até retomada explícita pelo planejamento;
   seus checks antigos não validam uma resolução atual. Preservar as dependências
   OBS/OPS e do catálogo, sem confundir os novos releases com o cutover CAT-12.
6. Registrar por entrega issue, responsável, branch, commit revisado, testes,
   preview e resultado da publicação. Seguir o runbook de release para ambientes.
   Se houver sucessão, fazer um único handoff com ledger/WIP/autoridades e confirmar
   qual sessão é o PM ativo antes de delegar trabalho novamente.

Conclusão desta consolidação: documentação e referências publicadas em PR,
lacunas explicitadas e handoff enviado ao PM. Conclusão da implantação: entregas
integradas e publicadas com as provas exigidas, relatadas pelo PM.
