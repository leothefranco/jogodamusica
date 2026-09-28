# Last Track Standing — plano de marca, interface e idiomas

Data: 28/09/2026. Estado: aprovado para execução e encaminhamento ao PM; implementação de produto pendente.

## Decisões confirmadas

- Nome: **Last Track Standing**, mantido em todos os idiomas.
- Identidade: **C / Encore**, conforme os mockups em `docs/design/last-track-standing/`.
- Símbolo: **01 / Original elétrico**, geometria atual inteiramente em verde elétrico. Arquivo de referência: `docs/design/last-track-standing/icons/svg/icon-01.svg`.
- Verde elétrico `#D4FF46` para marca, ações principais e celebração; azul `#38BDF8` e laranja `#FF923D` para identificar os lados do confronto.
- Fundo escuro, vinil, pódio e referência ao chaveamento. Substituir a coroa usada como marca nas artes pelo símbolo escolhido.
- Preservar o jogo em grupo em um único aparelho, seleção de tema e modalidade, dois players empilhados e votação com confirmação.
- Primeira entrega visual em português. Português brasileiro e inglês serão os primeiros idiomas da etapa seguinte. Inglês é uma proposta de lançamento, não uma tradução já concluída.

## Base consultada e implicações

| Área                    | Evidência local                                                                                   | Consequência para a execução                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Marca                   | `src/lib/site.ts`, `src/lib/brand.ts`, `src/components/brand-mark.tsx`                            | Centralizar nome e símbolo; aproveitar o desenho existente                                                  |
| Cores                   | `src/app/globals.css`; cores literais em roleta, progresso e resultado                            | Separar cor da marca e cores dos lados, sem substituir todo azul por verde                                  |
| Telas                   | `src/app`, `src/components`; inventário visual com 11 rotas e 36 telas/estados                    | Portar a direção visual para os componentes reais; os mockups não são código de produção                    |
| Compartilhamento        | `result-story-image.tsx`, `result-share-card.ts`, rota de imagem de resultado                     | Atualizar arte, nome, nome do arquivo e idioma com atenção ao cache público                                 |
| Instalação              | Manifests público/admin, `PwaManager`, `scripts/generate-app-icons.mts`, `public/sw.js`           | Atualizar aplicações instaláveis e migrar assets em cache mantendo a identidade da instalação               |
| Idioma                  | `siteConfig.locale = pt-BR`; `countLabel`; mensagens literais em componentes, APIs e validação    | Internacionalizar mensagens completas, plurais, metadados, erros e acessibilidade                           |
| Autenticação            | `src/proxy.ts` protege `/admin/:path*` e isenta seu manifesto                                     | A migração de idioma não pode abrir uma rota administrativa desprotegida                                    |
| Disponibilidade musical | Política de fontes e pesquisas YouTube usam região BR                                             | Idioma e país de reprodução são dimensões independentes                                                     |
| Trabalho existente      | `docs/estado-implementacao.md`, conferido em 28/09, registra CAT-05 na PR #51 ainda não integrada | Reconciliar a situação atual antes de editar catálogo/home; este plano não muda ownership nem fecha tickets |

Guia técnico consultado: `node_modules/next/dist/docs/01-app/02-guides/internationalization.md`, da instalação local. Antes de implementar cada mudança de Next.js, conferir também o guia instalado pertinente. Não fixar uma dependência de idiomas sem verificar sua compatibilidade com a versão do projeto.

## Ordem de execução

### LTS-01 — Consolidar marca e assets

1. Criar configuração compartilhada para nome completo, nome administrativo, apresentação compacta e cores semânticas. Usar o símbolo para espaços pequenos; testar uma forma curta da marca no launcher da PWA.
2. Preservar a geometria original e aplicar o verde ao símbolo. Atualizar o gerador para reproduzir a mesma marca em SVG, favicon, PNG, ícones Apple e versões pública/administrativa. Manter a identificação do app administrativo e área segura dos ícones maskable.
3. Adaptar a arte do vinil/pódio da opção C, substituindo a coroa pelo símbolo 01. Produzir arquivos otimizados e variantes adequadas a desktop/mobile. As imagens do estudo são referências, não devem ser importadas integralmente sem otimização.
4. Definir tokens distintos para marca, lados A/B, texto, superfícies, foco e estados de sucesso/erro. Azul/laranja continuam nas comparações; verde não deve competir com os botões A/B durante o voto.
5. Atualizar nome nos metadados, cabeçalhos, textos acessíveis, placeholders de imagem e avisos de instalação.

Saída: nome e ícone consistentes em todos os pontos de marca; assets sem coroa como símbolo; nome legível em mobile; nenhuma mudança em regras, IDs, links de partida ou dados.

### LTS-02 — Adaptar a experiência pública

1. Início: hero com marca, vinil/pódio e chamada para escolher tema; preservar o catálogo real, quatro posições de capa por tema, estados vazios e evolução de paginação existente.
2. Tema: descrição, capa e seleção explícita de modalidade. Preservar equivalência entre 2–7 rodadas e 4–128 músicas e disponibilidade derivada do catálogo. Nenhuma opção pré-selecionada.
3. Partida: aplicar a identidade C aos componentes atuais, manter players empilhados, reprodução exclusiva, rótulos A/B, confirmação de voto/desempate e proteção contra decisões duplicadas.
4. Transições: adaptar sorteio/revelação, passagem de rodada e final; respeitar movimento reduzido e ação de continuar. O desenho do chaveamento não pode sugerir uma chave fixa: as vencedoras são embaralhadas entre rodadas.
5. Resultado: destaque para a música e o artista reais; vinil/pódio como apoio visual, histórico completo de confrontos, repetir partida e compartilhamento.
6. Estados: erro, carregamento, 404, sem conexão, falha do vídeo e catálogo vazio, com a mesma hierarquia visual.

Saída: fluxo catálogo → tema → partida → campeã funcionando com dados reais/fixtures existentes. Preservar o contrato de 390×844 em estado normal, players com dimensão mínima e controles acessíveis. Textos longos, zoom e paisagem podem rolar; não ocultar conteúdo para caber.

### LTS-03 — Completar administração, compartilhamento e PWA

1. Adaptar login, painel, temas, criação/edição, música/trecho, importação/prévia/conclusão, saúde do catálogo e confirmações. Manter distinção entre publicação editorial e disponibilidade operacional.
2. Gerar a imagem 1080×1920 de resultado com a marca nova, título/artista reais, tema e endereço canônico. Trocar o prefixo do download; manter URLs históricas de resultado válidas.
3. Atualizar manifests público/admin e avisos de instalação. Preservar `id`, `start_url` e `scope` efetivos da instalação existente nesta entrega. Testar atualização em instalação já existente e instalação nova; a atualização do nome/ícone depende também do navegador e do sistema operacional.
4. Versionar o cache estático para renovar ícones/fallback. Se o prefixo mudar, a limpeza precisa reconhecer os caches antigos; a opção mais simples nesta etapa é manter o prefixo técnico e mudar sua versão.
5. Preservar exclusão de APIs, administração autenticada e recursos do YouTube do cache offline. A PWA continua exigindo internet para jogar.

Saída: **Release A — Last Track Standing em português**, com a identidade C e ícone 01 em todo o produto. É possível entregar este release antes da migração de idiomas.

### LTS-04 — Introduzir a estrutura de idiomas

Proposta técnica para validar antes da migração em massa:

- Idiomas iniciais: `pt-BR` e `en`. Traduções por áreas: comum, catálogo, partida, resultado, administração, erros e PWA.
- URLs públicas com prefixo de idioma, por exemplo `/pt-BR/tema/...` e `/en/tema/...`. Os segmentos e slugs atuais podem permanecer iguais nesta primeira versão; traduzir o endereço não é necessário para traduzir o conteúdo.
- Preservar `/tema/...`, `/jogo/...` e `/resultado/...` como entradas de compatibilidade que resolvem para o mesmo recurso e mantêm query strings. Idioma explícito na URL prevalece sobre preferência salva; sem idioma explícito, usar preferência salva, idioma suportado do navegador e fallback em português.
- Manter `/admin` e seus endpoints estáveis; aplicar idioma da preferência à interface administrativa. APIs, manifests, assets e service worker ficam fora do redirecionamento genérico de idioma.
- Antes de adotar a topologia de layouts, comprovar `html lang`, metadados, 404, carregamento, navegação servidor/cliente e proteção administrativa em uma pequena fatia funcional. O guia local de Next.js orienta a implementação; não copiar middleware de versões antigas.
- Manter uma camada pequena para resolver locale, carregar mensagens, interpolar variáveis, tratar plurais e formatar números/datas com `Intl`. Avaliar uma biblioteca compatível se ela reduzir a complexidade de roteamento e mensagens; a escolha deve ser registrada com a prova de compatibilidade.
- Migrar textos visíveis e acessíveis: botões, confirmações, labels, loading, erros, campos de formulário e metadados. Evitar montar frases a partir de fragmentos traduzidos ou pluralizar apenas adicionando “s”.
- Traduzir erros por códigos estáveis e parâmetros, preservando status HTTP e contratos existentes durante a transição. Incluir erros de campo e mensagens de validação; um erro desconhecido recebe mensagem genérica no idioma selecionado.
- Carregar no servidor o que é usado no servidor; enviar aos componentes cliente apenas mensagens necessárias. Testar o efeito da preferência/locale no cache e na renderização, evitando flashes no idioma incorreto.
- Permitir alternar o idioma mantendo tema, sessão e resultado. Não reiniciar, sortear novamente nem alterar decisões ao trocar idioma.

Compatibilidade de PWA e compartilhamento nesta fase:

- Adaptar a regra que oculta a oferta de instalação durante a partida para reconhecer as rotas com locale.
- Revisar a composição entre negociação de idioma e proxy de autenticação; manifests públicos mantêm a isenção atual.
- Manter identidade das duas PWAs e garantir que o início alcance uma rota válida no idioma escolhido.
- Definir fallbacks offline por locale e assegurar que o service worker alcance a versão correta sem cachear navegações autenticadas.
- Incluir o idioma explicitamente na URL/chave da imagem de resultado e na geração de metadados. Não variar silenciosamente por cookie uma imagem servida com cache público compartilhado.
- Definir URLs canônicas e alternativas por idioma para páginas públicas indexáveis; evitar indexar resultados privados por suposição ou indexar páginas ainda sem conteúdo traduzido.

Saída: todas as telas continuam em português, agora consumindo a estrutura de tradução; testes demonstram compatibilidade das URLs antigas, identidade da instalação, autorização e preservação da partida.

### LTS-05 — Publicar português e inglês

1. Traduzir e revisar o fluxo público completo, administração, erros, avisos de instalação e imagem de resultado. Incluir revisão de termos como round, match, track e theme/collection para consistência.
2. Expor seletor de idioma discreto, sem bandeiras; manter preferência entre visitas e acesso direto por links localizados.
3. Separar tradução da interface de conteúdo editorial. Preparar nome/descrição dos temas nos dois idiomas, com fallback explícito ao conteúdo original quando necessário. Música e artista não são traduzidos automaticamente.
4. Para metadados editoriais localizados, definir extensão aditiva à camada de catálogo vigente: identidade e slug do tema estáveis, conteúdo por locale e fallback. Se exigir banco, usar migração compatível e sem substituir registros atuais. Coordenar com o trabalho de catálogo em andamento.
5. Revisar seleção de imagem de capa e conteúdo regionalmente pertinente; o idioma não deve ocultar temas sem motivo nem mudar regras de elegibilidade.
6. Verificar comprimentos de texto, leitores de tela, imagens compartilhadas, números e plurais nos dois idiomas.

Saída: **Release B — produto bilíngue**, com uma partida completa e administração utilizáveis em português e inglês. A disponibilidade de fontes permanece limitada aos mercados efetivamente validados.

### LTS-06 — Preparar a expansão por país

Esta é uma frente posterior, necessária para divulgar suporte a mercados fora do Brasil. A interface em inglês pode ser entregue antes.

1. Escolher os primeiros mercados e a forma de resolver o país de reprodução. Não usar o idioma como país: inglês não implica Estados Unidos, e português não implica Brasil.
2. Planejar disponibilidade de fonte por região, busca/importação editorial, cache e contagem de entradas jogáveis. A política atual fixa BR; remover esse literal isoladamente não completa a adaptação.
3. Definir comportamento para uma sessão retomada em outra região e vídeos que se tornam indisponíveis. Não mudar silenciosamente participantes nem decisões; reutilizar o fluxo de recuperação do produto e acordar a regra que faltar.
4. Verificar reprodução real nos mercados escolhidos, variantes de catálogo, latência percebida e mensagens de falha. Não prometer cobertura mundial com base apenas nas fixtures locais.

Saída: mercados explicitamente suportados e evidência de catálogo/reprodução compatível. A escolha dos países será necessária antes de executar esta etapa.

## Validação e critérios de aceite

| Área               | Prova esperada                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Marca              | Nome novo em UI/metadados/instalação/resultado; ícone 01 consistente em 16, 32, 192 e 512 px; nenhuma coroa usada como assinatura da marca |
| Responsividade     | Mobile 320/360/390 px, desktop 1280 px, landscape e texto ampliado; sem corte de controles ou overflow indevido                            |
| Partida            | Dois players, reprodução exclusiva, confirmações, sorteio por rodada, desempate, conclusão, abandono e retomada mantidos                   |
| Catálogo/admin     | Elegibilidade, saúde/publicação, importação, edição de trecho e proteções de exclusão preservadas                                          |
| Idiomas            | Chaves consistentes, plurais, fallback, erros, metadados, `lang`, preferência e troca sem perder sessão                                    |
| URLs               | Links antigos e novos atingem o mesmo tema/partida/resultado; sem loops de redirect ou exposição administrativa                            |
| PWA/cache          | Nova instalação e atualização; duas PWAs distinguíveis; fallback correto e assets renovados; administração/API continuam fora do cache     |
| Compartilhamento   | Imagem real em 9:16, marca/URL corretas e cache separado por idioma                                                                        |
| Reprodução externa | QA real de YouTube e dispositivos; fixtures não substituem a prova regional                                                                |

Ampliar os testes existentes apenas onde o comportamento ou contrato mudar: `site`, `pwa-manifest`, `pwa-icons`, `service-worker`, `pwa-install`, `language`, `errors`, `result-share-card`, `ui-complete`, `two-players`, `theme-state-admin`, `public-catalog` e `manifests`. Acrescentar cenários de locale/URLs/autorização e uma jornada completa por idioma.

Executar os gates definidos pelo projeto: formatação, lint, tipos, testes, build e Playwright. Antes de publicar, obter preview concreto com comparação visual, testes e QA aplicável. Este plano não inicia deploy, troca de domínio ou alteração de contas externas.

## Organização das entregas

Ordem sugerida de PRs: LTS-01 → LTS-02 → LTS-03 → LTS-04 → LTS-05. LTS-06 depende de decisão de mercados e de coordenação com a evolução do catálogo. Os códigos LTS identificam lotes deste documento, não issues já criadas.

O usuário solicitou em 28/09 a consolidação no repositório e o encaminhamento ao PM para prosseguir com a implantação, com sucessão de sessão se necessária. Seguir o handoff em [Planos do projeto](./planos.md#continuidade-do-pm), a escolha Astra de `AGENTS.md` e o limite de dois tickets. Conferir checkout/base e ownership antes de editar a home e o catálogo. Preservar o trabalho dos responsáveis existentes.

O primeiro lote a executar é **LTS-01**, seguido de uma fatia real início → tema → confronto para verificar a identidade com o player e os dados do sistema. As demais telas vêm sobre essa base. A migração de idioma começa após a identidade estar consistente, reduzindo a sobreposição de mudanças visuais e de roteamento.
