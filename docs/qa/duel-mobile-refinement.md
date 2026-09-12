# UI-REFINO-01 — confronto responsivo (fase A)

Base: `9fb72f759b1654dd980266b06144861870e84350`.
Branch: `codex/ui-duel-mobile-refinement`. Catálogo/fase B suspenso.

## Contrato preservado

Somente apresentação de `game-experience.tsx` e seletores `.game-*`:
cards de 20px, votos/sorteio de 14px e pelo menos 48px de altura,
selos A/B circulares, VS de 52px no fluxo, títulos completos e erro abaixo
da mídia. Desktop usa subgrid para alinhar players mesmo com títulos diferentes.
Nenhum handler, API, autenticação, decisão, player, dependência ou token global
foi alterado. Fixture estendida apenas com nomes longos e inversão dos lados.

## Critérios e evidências

Logs e capturas locais: `tmp/evidence-ui-refino/` na worktree da tarefa.

| AC  | Evidência                                                                                                                                                                                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Matriz 320×740, 360×800, 390×844, 844×390, 1280×800 e 1440×900, ambos os lados: VS 52px, central e fora dos cards, respiro mínimo 12px. Anexos `layout` do JSON E2E.                        |
| A2  | Computed styles: cards 20px, votos/sorteio 14px, alvos ≥48px; igualdade de dimensões A/B e inversão de conteúdo.                                                                            |
| A3  | Regressão do componente real com API externa do YouTube simulada; embed ≥200×200, voto abaixo com ≥12px; erro fora da mídia.                                                                |
| A4  | Nomes longos nas três larguras móveis, lados invertidos, fonte efetivamente 200%, erro, landscape e desktop; título completo, sem overflow horizontal e abandono alcançável por rolagem.    |
| A5  | Tab/Enter/Escape, foco visível nos votos e devolvido após diálogos; decisões canceladas não enviam requisição. Contraste texto/fundo medido abaixo. Estados funcionais existentes mantidos. |
| A6  | 40 E2E aprovados: inclui pausa mútua, trecho, recuperação, votos/cancelamento, sorteio/reduced-motion, progresso e abandono; diff de produção sem alterações de handlers.                   |
| A7  | Inspeção da metade direita da prancha aprovada e capturas finais, comparação anotada abaixo.                                                                                                |

Contraste normal A/B: voto 8,75:1 / 8,42:1; título 13,89:1 / 14,04:1;
artista 8,25:1 / 8,33:1; foco 13,89:1 / 14,04:1.
Sorteio 12,15:1 e descrição 7,21:1. Hover dos dois votos também ≥4,5:1.
Valores do anexo `contrast` de `regression-final.log`.

## Comparação visual anotada

Referência: `docs/design/references/mobile-capas-duelo-2026-09-12.png` no
checkout principal, SHA256
`0C222D7CD0D7C70B86329A209C210C4FF091CBAAE016869905DA58032BB271CD`.
Inspecionar exclusivamente o confronto à direita; catálogo à esquerda não integra esta entrega.

| Prancha: confronto                         | Captura real da fixture                                                                               | Observação                                                                             |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Cards suaves com A/B arredondados          | `regression-final/two-players-composição-acessível-320x740-lados-originais-chromium/duel.png`         | Raio 20px, borda discreta, ciano/laranja com igual peso.                               |
| VS circular entre cards e linhas coloridas | Mesma captura mobile e `two-players-composição-acessível-1440x900-lados-invertidos-chromium/duel.png` | 52px, linha ciano à esquerda e laranja à direita; coluna central desktop.              |
| Voto integrado abaixo da mídia             | Todas as capturas `duel.png`                                                                          | Botão ≥48px, sem overlay; mídia não recebe recorte decorativo.                         |
| Nomes ilustrativos curtos                  | `two-players-títulos-de-tam-8b580-nto-desktop-invertidos-true-chromium/duel-long-desktop.png`         | Nomes completos, alturas de mídia alinhadas entre adversários.                         |
| Composição mobile compacta                 | `two-players-nomes-longos-e-68daf-os-em320px-invertidos-false-chromium/text-200-error.png`            | Rolagem vertical deliberada, inclusive 390×844; não comprimir player/ações para caber. |

Todos os paths de capturas acima são relativos a
`tmp/evidence-ui-refino/regression-final/`, salvo o primeiro que já inclui `regression-final/`.
As áreas pretas são iframes da API externa simulada no teste, não um player
fictício de produção. Não houve QA de reprodução YouTube ao vivo, validação em
dispositivo físico ou certificação completa de acessibilidade. A prancha não foi
incorporada como asset, nem suas músicas/capas como dados do produto.

## TDD e ajustes da prova

- VS: RED 24px versus mínimo 48 (`red-vs.log`, exit 1) → GREEN 52px.
- Forma: RED raio 0 versus mínimo 18 (`red-shape.log`, exit 1) → GREEN 20px.
- Erro: RED geométrico y181 sobre player com fundo y375
  (`red-error-geometry.log`, exit 1) → GREEN erro após mídia.
- Texto: RED truncado (`red-text.log`, exit 1) → GREEN completo e fonte 200%.
  Tolerância de 1px apenas para arredondamento de scrollHeight, não truncamento.
- Desktop longo: RED diferença de y de 28,59px (`matrix-first.log`) → GREEN
  alinhado por subgrid (`matrix-aligned.log`, 14 testes).
- O antigo pressuposto de zero scroll foi substituído conforme aprovação.
  Em Chromium, `End` não rolou mesmo sem cancelamento do evento; `PageDown`
  rolou 456px (`scroll-diagnostic.log`). O teste mantém rolagem por teclado,
  foco explícito e verificação de acesso ao abandono. Instrumentação removida.

## Gates

Executados com ferramentas existentes, sem instalação; Playwright usa porta 3123.

| Comando                                                                                                                                                    | Resultado                                         | Log                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------- |
| `npm run security:check`                                                                                                                                   | exit 0                                            | `gate-security-check.log` |
| `npm run test:security`                                                                                                                                    | exit 0, 16/16                                     | `gate-test-security.log`  |
| `npm run lint`                                                                                                                                             | exit 0                                            | `gate-lint.log`           |
| `npm run typegen`                                                                                                                                          | exit 0                                            | `gate-typegen.log`        |
| `npm run typecheck`                                                                                                                                        | exit 0, typegen seguido de tsc                    | `gate-typecheck.log`      |
| `npm test`                                                                                                                                                 | exit 0, 58 arquivos/464 Vitest + 16 segurança     | `gate-test.log`           |
| `npm run build`                                                                                                                                            | exit 0                                            | `build-final-normal.log`  |
| `E2E_TEST_MODE=1 npm run build`                                                                                                                            | exit 0                                            | `build-final-e2e.log`     |
| `PLAYWRIGHT_PORT=3123 CI=1 npm run test:e2e -- tests/e2e/two-players.spec.ts --retries=0 --reporter=json --output=tmp/evidence-ui-refino/regression-final` | exit 0, 40 esperados, 0 inesperados/skipped/flaky | `regression-final.log`    |
| ESLint focado no arquivo E2E final                                                                                                                         | exit 0                                            | saída da tarefa           |
| Prettier `--check` nos quatro arquivos de código/teste                                                                                                     | exit 0                                            | saída da tarefa           |
| `git diff --check`                                                                                                                                         | exit 0                                            | saída da tarefa           |

Reconciliação: produto/fixture escritos em 12/09/2026 às 18:01:24 UTC; teste E2E
final às 18:03:18; regressão iniciou 18:03:25 e terminou verde. Lint/typecheck
anteriores precederam o último delta do teste, portanto ESLint focado e os dois
builds reais foram executados após a retomada. Nenhuma alteração posterior de
produção durante essa reconciliação. Não se repetiu Vitest/E2E sem necessidade.

Revisões independentes e checks remotos devem fixar o SHA publicado; o relatório
local de handoff registra esses resultados. Merge e produção são exclusivos do
coordenador após aceite PM, não do autor desta mudança.
