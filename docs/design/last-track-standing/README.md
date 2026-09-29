# Last Track Standing — três identidades

**Escolha confirmada:** identidade C / Encore, com [ícone 01 / Original elétrico](./icons/svg/icon-01.svg). As capturas preservam o estudo comparativo; a coroa ainda presente nas artes deve ser substituída pelo ícone escolhido durante LTS-01. Execução: [plano LTS](../../plano-last-track-standing.md).

Estudo visual de todas as páginas de produção encontradas no projeto, complementado por estados e seções relevantes. Não altera o código da aplicação, autenticação, catálogo ou banco de dados.

## Abrir

- `index.html`: galeria interativa. Selecione uma tela, alterne a identidade, use **Comparar as 3** ou escolha desktop/mobile.
- `overview.html`: atlas com as 36 telas e estados nas três identidades.
- `identities-board.png`: comparação resumida de início, confronto mobile e resultado.
- `exports/{a,b,c}/{desktop,mobile}/`: 216 capturas PNG em resolução integral.
- `screen.html?identity=c&screen=duel`: exemplo de acesso direto a um mockup.
- Para servir localmente: `node docs/design/last-track-standing/serve.mjs`. Endereço: http://127.0.0.1:4178.

A pasta é portátil: HTML, CSS, scripts, fonte e imagens usam caminhos relativos. É possível abrir `index.html` diretamente no navegador. O servidor local facilita a prévia dentro do Codex.

## Direções

| Opção        | Marca                                   | Confronto                                 | Sensação                                               |
| ------------ | --------------------------------------- | ----------------------------------------- | ------------------------------------------------------ |
| A / Electric | Verde elétrico #D4FF46, grafite, marfim | A verde; B marfim; rótulos A/B explícitos | Musical, editorial, concentrada em uma cor             |
| B / Arena    | Azul #38BDF8 e laranja #FF923D          | A azul; B laranja                         | Competição como assinatura em todas as telas           |
| C / Encore   | Verde elétrico na marca e celebração    | A azul; B laranja                         | Identidade própria da marca com leitura clara do duelo |

As três opções mantêm vinil, pódio, coroa e referência ao chaveamento, além da mesma organização das telas. Variam a aplicação das cores, o tratamento da arte e o arredondamento. A cor nunca é o único identificador das músicas.

## Cobertura

Foram consultados `README.md`, `CONTEXT.md`, `src/app`, `src/components`, estilos e o documento `docs/design/ui-complete-refinement.md`.

Todas as 11 rotas de página de produção mapeadas:

| Rota                                | Mockup                       |
| ----------------------------------- | ---------------------------- |
| /                                   | Início e catálogo            |
| /tema/[slug]                        | Tema e escolha de modalidade |
| /jogo/[sessionId]                   | Confronto e votação          |
| /resultado/[sessionId]              | Campeã e chaveamento         |
| /offline                            | Sem conexão                  |
| /admin/login                        | Login                        |
| /admin                              | Visão geral                  |
| /admin/temas                        | Gestão de temas              |
| /admin/temas/novo                   | Criação de tema              |
| /admin/temas/[id]                   | Edição e músicas             |
| /admin/temas/[id]/importar-playlist | Importação de playlist       |

Estados e seções complementares: confirmação de voto, confirmação e revelação de desempate, transição de rodada, final, abandono, chaveamento ampliado, imagem de compartilhamento, falha de login, busca de música, revisão de trecho, prévia e conclusão da importação, exclusão de rascunho, saúde do catálogo, catálogo público vazio, administração vazia, carregamento, erro, 404, falha do player, instalação pública, instrução iOS, instalação administrativa e acesso não configurado.

A imagem de compartilhamento corresponde a uma saída visual da API, não a uma nova página do produto. Busca, edição da música e chaveamento são apresentados isoladamente na galeria para facilitar a avaliação de seções existentes. Rotas de fixture E2E, handlers de API, manifests e redirects sem UI própria não foram tratados como telas.

## Fidelidade ao fluxo

- O jogo funciona em grupo, em **um único aparelho**; não foram adicionadas salas, convites, cadastro de jogadores ou placares pessoais.
- Tema e modalidade precedem a partida. Nenhuma modalidade aparece selecionada por padrão.
- Os dois players permanecem empilhados, com espaço mínimo de 200 px de altura e controles próprios.
- Voto, desempate e abandono possuem confirmação explícita.
- O chaveamento representa o histórico por rodada, respeitando o sorteio de vencedoras entre rodadas. Não promete uma chave futura fixa.
- A marca permanece em inglês; os textos da interface estão em português para comparação com a experiência atual.
- O aviso de instalação identifica a versão administrativa separadamente.

## O que é demonstrativo

As músicas e artistas apresentados são fictícios; capas abstratas, quantidades e estados operacionais ilustram a interface. As telas são cenários independentes, não uma partida persistente. As métricas variam em telas de estado para mostrar casos diferentes. A galeria permite navegação, troca de identidade, seleção de modalidade, seleção de faixas na importação e confirmação visual de A/B. Não reproduz áudio, autentica, publica temas, instala aplicativos nem grava dados.

Os players são representações visuais; a implementação futura deverá preservar os controles e requisitos reais da API do YouTube. A exclusão demonstra um rascunho sem partidas; a regra que impede excluir temas com partidas continua pertencendo ao produto real.

Os downloads exportam os PNGs do estudo. A tradução para inglês e a implementação da identidade escolhida ainda são etapas futuras.

## Artes e prompts

As três artes raster de vinil/pódio foram geradas pela ferramenta integrada **image_gen**. O conjunto exato de prompts está em `prompts.json`; artes finais em `assets/electric.png`, `assets/arena.png` e `assets/encore.png`. Layouts, textos e elementos de interface são HTML/CSS. A fonte Anton e sua licença foram copiadas do próprio projeto.

## Verificação

Verificação em Chromium via Playwright disponível no projeto, com capturas em 1280 × 960 e 390 × 844 (páginas completas; imagem compartilhável recortada no formato 9:16). Foram conferidos erros de JavaScript, carregamento de imagens, overflow horizontal, seleção de modalidade, votação/cancelamento, desempate, escolha de importação, troca de identidade, comparação e mobile. Estados de instalação, acesso desabilitado e confirmação da música B receberam checagem adicional.

Resultado detalhado em `verification.json`. Os scripts `verify.mjs` e `verify-extra.mjs` servem para exportação e inspeção do artefato, não são testes de produção.
