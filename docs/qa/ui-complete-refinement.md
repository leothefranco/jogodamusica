# QA — UI-REFINO-02

Base: `378381c109dc2d96ed4e62c4784f18afd8546e6f`. Branch:
`codex/ui-complete-refinement`. Esta prova substitui a permissão histórica de
rolagem **normal em 390×844** do QA UI01, sem retirar rolagem acessível nos estados
excepcionais. Não representa publicação nem validação com dados vivos.

## Critérios e provas

| Critério                  | Interface observada                                 | Evidência reproduzível                                                                                                                                                              |
| ------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: normal390×844 completo | GameExperience na fixture dois-players              | scrollHeight≤845, sem overflow horizontal e caixas de sorteio, mídia A/B, votos A/B, VS, progresso e abandono dentro do viewport; sem scrollIntoView nessa prova                    |
| A: mídia/toque e exceções | Mesmo componente; SDK YouTube simulado na fronteira | Mínimos200×200/48px, lados invertidos,320/360/390/landscape/1280/1440, nomes longos/texto200%/erro, alinhamento desktop, foco/cancelamento/contraste/reduced-motion                 |
| B: raios efetivos         | Componentes reais públicos/admin                    | Computed styles12–14px controles/campos,18–20px painéis,8px miniaturas; estados disabled/error, cancelamento nativo, foco visível                                                   |
| B: resultado              | GameResult usado pela ResultPage e fixture          | Campeã, chaveamento, hrefs de download/abrir/rejogar/início preservados; ações/painéis mobile390 e desktop1280                                                                      |
| C: quatro posições        | HomeExperience e ThemeThumbnailStack catalog        | 0/1/3/4 ×320/360/390/1280/1440, dedupe/ordem, ausência de requisição da cover no catálogo, título acima, gap8, quadrados≥48px, foco e ausência de overflow                          |
| C: falha/precedência      | Mesmos componentes                                  | Falha404 mantém as quatro caixas exatamente iguais, sem repetir música; fora do catálogo cover continua preferida; suíte theme-visual verifica falhas variadas/pré-hidratação/semJS |
| Jornada                   | home→tema→confronto→resultado                       | Clique real no card, modalidade, POST com payload esperado, voto/diálogo, resultado com campeã e ação de rejogar; respostas externas interceptadas                                  |

## Inventário de consumidores

Raios abaixo são CSSpx. As provas estão em `tests/e2e/ui-complete.spec.ts` e
`tests/e2e/two-players.spec.ts`, além das suítes relacionadas existentes.

| Consumidor                         | Componente/origem                                            | Resultado e prova                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Home/lista de temas                | HomeExperience/CSS module                                    | Card20, slots8;20cenários de quantidade/largura, capturas catalog.png; ligação inteira focável                                                                        |
| Tema/modalidades                   | StartGameForm; wrapper visual da página de tema              | Painel20, labels/ação12; radio nativo; theme.png390/1280 e regressão public-catalog                                                                                   |
| Votação/sorteio/abandono           | GameExperience/globals.css                                   | Cards20, votos14, sorteio14, acesso abandono48px; normal-390.png e matrizes duel.png                                                                                  |
| Confirmação/revelação              | DecisionOverlays/globals.css                                 | Dialog/card20, botões12/alvo48; jornada mede diálogo; testes existentes validam foco, cancelamento, busy, roleta e reduced-motion                                     |
| Resultado/ações                    | GameResult                                                   | Painéis20, ações12, imagens8; result.png390/1280, hrefs e título da campeã                                                                                            |
| Login                              | LoginForm/Button                                             | Campos/submit12; login.png390/1280 na rota real, sem autenticar; formulário desabilitado quando ambiente não configurado                                              |
| Formulário de tema                 | ThemeForm/form-styles/Button                                 | Inputs, textarea, file e ação12; preview8; theme-form.png, suíte theme-creation preserva validação/upload na fixture                                                  |
| Busca/resolução/edição YouTube     | YouTubeSongManager/form-styles                               | Formulários20, inputs/botões/seleção12; iframeparent0; admin-controls.png390/1280 com busca e seleção reais sobre HTTP controlado                                     |
| Prévia/importação                  | PlaylistImportManager/Button                                 | Painéis20, controles12; seleção/desmarcação, disabled e erro503 observáveis na captura; sem importação viva                                                           |
| Remoção/confirmar                  | ConfirmSubmitButton                                          | Botão12/destructive preservado; dismiss do diálogo nativo mantém status Não enviado                                                                                   |
| Disponibilidade/estado/modalidades | SourceAvailabilityStatus/ThemeStateStatus/SupportedGameModes | Painel20; chips de modalidade12 e badges circulares intencionais; componentes reais na captura admin; suítes source-availability-admin/theme-state-admin              |
| Dashboard/lista/novo/detalhe admin | Páginas protegidas existentes                                | Hunks exclusivamente rounded-2xl nos cards/painéis (20); inspeção estática dos wrappers, token medido nos componentes acima; não há captura autenticada de banco vivo |
| Offline/not-found                  | FullPageState + links reais                                  | Ações12, capturas offline.png/not-found.png390/1280; conteúdo/semântica preservados                                                                                   |
| Error/loading                      | ErrorPage/FullPageState/Button; loading.tsx                  | Inspeção estática: ações herdam12, layout partilhado provado offline/not-found; loading textual sem controle; sem provocar erro de serviço vivo                       |
| Instalação                         | PwaManager                                                   | Aside20, botões14; pwa.png390/1280 e dismiss real após evento beforeinstallprompt controlado; sem instalar aplicativo                                                 |

Paths de páginas admin inspecionados/alterados: `src/app/admin/(protected)/page.tsx`,
`temas/page.tsx`, `temas/novo/page.tsx`, `temas/[id]/page.tsx`. Layouts, actions,
queries e guards não foram modificados. `form-styles.ts` e `login-form.tsx` já
usavam token md; não precisaram de hunks próprios. Não há consumidores atuais
dos tokens3xl/4xl na UI inspecionada.

Exceções: links de texto, divisas/barras, badges e marcas decorativos, checkboxes,
radios, player/iframe e diálogo nativo não seguem a regra de painel. Alertas inline
12px não são cards. Miniatura clicável de imagem social usa8px.

## TDD e execução

Evidências locais ficam em `tmp/evidence-ui-complete/` (ignoradas pelo Git):

- `red-height.log`: exit1, altura1016>845; primeiro ajuste ainda858>845;
  `green-height-radius.log`: exit0, altura e campo reais verdes.
- `red-radius.log`: exit1, campo admin3,2<12.
- `red-covers.log`: exit1, uma posição em vez de quatro;
  `green-covers.log`: exit0.
- `matrix-first.log`:64passed/1failed, RED do botão do resultado com raio0;
  `new-scenarios-2.log`:exit0,6passed depois dos ajustes.
- `red-stack-radius.log`:exit1,14,4>8; regressão final confirma8.
- `regression-final.log`:exit0,95passed, sem retries; inclui todas as suítes E2E.
- `lint.log`:exit0; `test.log`:exit0,16testes segurança +464testes/58arquivos.
- `typecheck.log`:exit0, script real typegen→tsc.
- `build-e2e-final.log`:exit0, build real E2E_TEST_MODE=1.

Os primeiros testes novos identificaram um service worker que contornava a
interceptação de navegação e seletores que incluíam anunciador Next/inputs hidden.
As provas de UI agora bloqueiam service workers no contexto Playwright. Não houve
fornecimento de segredo, configuração de banco ou alteração dos loaders para
viabilizar o teste. A suíte de manifests permanece separada e inalterada.

Reproduzir com dependências já instaladas:

```powershell
$env:PLAYWRIGHT_PORT='3123'
$env:CI='1'
$env:E2E_TEST_MODE='1'
npm run build
npm run test:e2e -- --retries=0 --reporter=line
npm run typecheck
npm run lint
npm run test
Remove-Item Env:E2E_TEST_MODE
npm run build
```

Builds são sequenciais, nunca junto ao servidor E2E. Conferir ausência de
`/e2e-test/` em `.next/server/app-paths-manifest.json` no build normal. Conferir
Prettier somente no diff e `git diff --check`. Os exits finais, SHA fixo, reviews,
PR e checks ficam no handoff da rodada.

## Capturas e limites

Antes: pastas `red-height/`, `red-radius/`, `red-covers/`. Depois:
`regression-final/`, com normal-390.png, duel.png, long-names.png,
text-200-error.png, catalog.png, catalog-failed-image.png, result.png,
admin-controls.png, theme-form.png, login.png, offline.png, not-found.png,
pwa.png e theme.png. São pares mobile/desktop onde aplicável, não snapshots
substituindo asserts funcionais. O índice exato é registrado no handoff local.

As capturas mostram imagens neutras geradas pela resposta HTTP de teste e a
fronteira SDK YouTube simulada. Não certificam reprodução de vídeo externo,
Safari/iOS, teclado móvel físico, instalação PWA real nem conteúdo administrativo
autenticado. Protegidos admin têm componentes reais exercitados em fixture e
wrappers auditados no diff, sem executar loaders com dados vivos.

Implementação, revisão e publicação são estados separados. Somente o coordenador
pode integrar/publicar após aceite do PM no SHA exato. UI02 precede a reconciliação
da tarefa13, pois HomeExperience/StartGameForm possuem overlap conhecido.
