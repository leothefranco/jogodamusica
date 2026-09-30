# LTS-01 — Last Track Standing, C / Encore

Issue #53. Base fixa `98cd09887e4a417c257d2611ebabe3745fddad9a`;
branch `codex/lts-01-brand-assets`. Não é a Release A completa.

## Contratos e evidências

| AC  | Implementação e prova                                                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `siteConfig`: Last Track Standing / Last Track; Last Track Standing Admin / LTS Admin. Interface e `lang` pt-BR. Testes site e lts-brand, capturas de componentes reais em 320/360/390/1280.                                                                                                                  |
| 2   | Símbolo 01 verde #D4FF46. Comparação raster exata contra o SVG aprovado em 16/32/192/512. Admin usa o mesmo símbolo com badge de controles separado. PNG maskable opaco e conteúdo dentro do círculo seguro central de 80% do diâmetro. Apple 180px.                                                          |
| 3   | Arte C editada por imagegen, sem coroa; master preservado e derivados WebP reproduzíveis. Preview local e inventário abaixo. Não há screenshot incorporada como UI.                                                                                                                                           |
| 4   | Tokens distintos de marca, lados A/B, fundo/superfície/texto/foco/sucesso/erro. A/B #38BDF8/#FF923D preservados; foco marfim. Não há alteração de layout/players/targets. Suíte two-players conserva provas UI02 de 390×844, 200×200, 48px, nomes longos/200%/landscape.                                      |
| 5   | Público continua sem `id` explícito, identidade efetiva derivada de `/`; start/scope `/`. Admin id/start/scope `/admin`. Contratos HTTP completos dos manifests testados, incluindo MIME/cache/status. URLs históricas dos ícones mantidas. Sem mudanças de regras, dados, auth, providers ou service worker. |
| 6   | Gates reais e revisões exatas registrados no handoff da tarefa.                                                                                                                                                                                                                                               |

O cabeçalho de confronto usa a forma curta, com nome acessível completo. A home
mantém sua estrutura e catálogo; somente imports/textos nominais mudam. O delta
CAT05 integrado em `5d41b3a3a51994fa008272717ecb9101695860ca` foi inspecionado
read-only: paginação/dados não foram absorvidos nem alterados nesta branch.

## Assets e reprodução

Executar com as dependências já instaladas:

```text
node node_modules/tsx/dist/cli.mjs scripts/generate-app-icons.mts
```

O gerador usa o Sharp já disponível. Não introduz dependências. Reproduz ícones
vetoriais e rasteriza as variantes; otimiza a arte a partir do master versionado,
sem nova chamada generativa. Uma segunda execução reproduziu os 20 arquivos com
SHA-256 idêntico (`tmp/evidence-lts01/asset-inventory.json`).

Ícones em `public/icons/`; dimensões quadradas, exceto a coordenada vetorial que
usa viewBox 512×512:

| Arquivo                            | Dimensão | Formato | Bytes |
| ---------------------------------- | -------- | ------- | ----: |
| icon.svg (também src/app/icon.svg) | 512      | SVG     |   307 |
| admin-icon.svg                     | 512      | SVG     |   527 |
| icon-16.png                        | 16       | PNG     |   257 |
| icon-32.png                        | 32       | PNG     |   394 |
| icon-192.png                       | 192      | PNG     |  2628 |
| icon-512.png                       | 512      | PNG     | 11700 |
| admin-icon-16.png                  | 16       | PNG     |   290 |
| admin-icon-32.png                  | 32       | PNG     |   474 |
| admin-icon-192.png                 | 192      | PNG     |  2974 |
| admin-icon-512.png                 | 512      | PNG     | 12596 |
| icon-maskable-192.png              | 192      | PNG     |  1417 |
| icon-maskable-512.png              | 512      | PNG     |  8198 |
| admin-icon-maskable-192.png        | 192      | PNG     |  1771 |
| admin-icon-maskable-512.png        | 512      | PNG     |  9196 |
| apple-icon.png                     | 180      | PNG     |  1480 |
| admin-apple-icon.png               | 180      | PNG     |  2003 |

O favicon segue a convenção Next instalada `src/app/icon.svg`, com alternativas
PNG 16/32 declaradas em metadata. Apple usa metadata explícita por layout para
preservar a distinção pública/admin, sem criar um Apple global que sobreponha o
administrativo. Maskable tem fundo full-bleed, sem cantos transparentes.

Arte em `public/brand/last-track-standing/`:

| Arquivo             | Dimensão  | Formato |   Bytes | Uso                                     |
| ------------------- | --------- | ------- | ------: | --------------------------------------- |
| encore-master.png   | 1254×1254 | PNG     | 1784243 | Fonte reprodutível, não utilizada na UI |
| encore-mobile.webp  | 640×640   | WebP    |   26686 | Asset mobile para consumo LTS02         |
| encore-desktop.webp | 1200×1200 | WebP    |   77010 | Asset desktop para consumo LTS02        |

WebP quality 82, effort 6, sem crop ou ampliação. Orçamentos de teste: mobile
<100 KB e desktop <250 KB. A geometria dos ícones é determinística; a aparência
do símbolo aplicado ao vinil é verificada visualmente, não por um teste binário
que pretenda provar uma imagem generativa.

### Proveniência e prompt

Referências do próprio repositório: `docs/design/last-track-standing/assets/encore.png`
(gerada por imagegen, conforme README/prompts do estudo) e
`docs/design/last-track-standing/icons/png/icon-01-512.png` (símbolo vetorial original).
Ambas preservadas. Ferramenta usada: **image_gen integrada**, não CLI/API, sem
chaves, nova licença ou fornecedor. Edição de 30/09/2026; master SHA-256
`52d801176b0f04de8a2ff0628a59ebb3cfd8fc8367273d2a652e2fd37552f2db`.

Prompt exato:

> Use case: precise-object-edit. Asset type: reusable raster artwork for Last Track Standing, C / Encore. Image 1 is the edit target: preserve its entire square composition, glossy black vinyl grooves, cylindrical black marble podium, sleeves, lighting, quiet sky-blue left and orange right bracket lines and black background. Image 2 is the exact approved brand-symbol insert reference, NOT a second scene. Change ONLY the vinyl center label: remove the crown completely, make the circular label dark #101216, and print the precise lime #D4FF46 symbol from image 2 centered on it, with both open rectangular brackets and three centered equalizer bars (middle bar twice as tall as the two others). Preserve symbol proportions, negative space and squared geometry; do not add a rounded-square plate, use just the green mark on the circular dark label. Preserve original highlights and subtle lime rim light. No crown anywhere, no words, numbers, additional objects, or UI. This is an edit of image 1, not a redesign.

## TDD e ambiente

Vermelhos observados antes da implementação: nomes antigos (1), marca bicolor
contra referência verde (4), arquivos de ícones ausentes/antigos (6), tokens/arte
otimizada ausentes (3), manifests antigos (2), label acessível antigo na home
(1 E2E). Suíte relacionada final inicial: 27 testes verdes.

Runtime existente: Node 24.18.0 / npm 11.16.0. Nenhuma instalação. Testes locais
usam porta 3122, fixtures existentes e fronteiras HTTP simuladas onde já previsto;
não acessam DB/provedores vivos. Typecheck executa typegen antes de tsc.

| Comando real                                                    | Resultado                                                                        |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `npm run typecheck`                                             | exit 0; next typegen e tsc verdes                                                |
| `npm run lint`                                                  | exit 0; um warning preexistente em docs/design/last-track-standing/screen.js:400 |
| `npm test`                                                      | exit 0; 16 segurança + 477 Vitest, 60 arquivos                                   |
| `npm run build`                                                 | exit 0; Next real, modo normal                                                   |
| `E2E_TEST_MODE=1 npm run build`                                 | exit 0; Next real, fixtures incluídas                                            |
| `CI=1 PLAYWRIGHT_PORT=3122 npm run test:e2e -- --reporter=line` | exit 0; 105/105, sem retry necessário                                            |
| `npm run format:check` após reparo autorizado                   | exit 0, sem override                                                             |
| `git diff --check`                                              | exit 0                                                                           |

Logs em `tmp/evidence-lts01/*.log`. Capturas reais preservadas em
`tmp/evidence-lts01/captures/`: `lts-brand-*` para home/admin em quatro larguras,
launcher e assets; `two-players-*` para normal390, 200%, landscape, foco e duelos;
`ui-complete-*` para controles, estados, catálogo e resultado. A suíte mede
scroll, tamanho dos players e targets, gaps, contraste e foco. O HTML de launcher
é construído somente no teste a partir do JSON HTTP dos manifests.

O gate global de formato apontou 257 arquivos. A auditoria com Prettier 3.9.6 e
config/parser existentes separou 19 arquivos da tarefa, corrigidos e verdes, de
238 intocados que falham apenas por CRLF físico. Para cada um dos 238, a versão LF
em memória é exatamente o blob da base e passa. Zero falhas dos blobs da base,
zero exceções não explicadas. Após validação independente, o PM autorizou reparo
físico CRLF→LF exclusivamente desses 238 paths. Preflight integral, backup raw e
provas de HEAD/blobs/delta/arquivos próprios/tuplas/flags preservados passaram.
Uma única atualização restrita de statcache removeu os M sintéticos, sem staging
do delta LTS01. O gate global real passou depois (exit 0), **sem waiver**.
Backup recuperável: `tmp/evidence-lts01/eol-backup-20260930`. Relatórios por path:
`tmp/evidence-lts01/format-audit.json` e `format-summary.json`.

## Limites explícitos

O preview de launcher usa ícones e name/short_name efetivamente retornados pelos
dois manifests, em escala 100%, com ícones de 64px e medição de truncamento.
É **simulação local de legibilidade**, não instalação de sistema operacional.
Instalação nova, atualização instalada e renovação de cache pertencem a LTS03.

LTS02 fará a incorporação das artes nos fluxos; LTS03 fará imagem social completa,
lifecycle/cache e admin visual. Coroas como indicadores de vencedora não são
assinatura da marca e permanecem. URLs/IDs técnicos e textos da imagem social
histórica não são renomeados aqui. Nenhum deploy manual, cutover ou promessa de
Release A publicada. Rollback requer integração reversível posterior, não exclusão
de histórico ou assets por este agente.
