# Duelo musical — revisão da direção visual

## Estado e decisão

Plano atualizado a partir das duas referências visuais enviadas pelo usuário. Substitui a proposta azul × cinza do commit3f22634, que permanece local e não deve ser publicada como solução visual final.
Em 2026-09-08, o usuário ampliou explicitamente a reformulação para o app inteiro. Escopo: home, catálogo, tema/modalidade, confronto, resultado e imagem compartilhada, estados globais, instalação/PWA e administração. A composição desktop aprovada da home permanece a base, agora com identidade azul × laranja.
Objetivo: duas músicas adversárias com igual força visual para eleger a melhor. Cor identifica A/B; não indica escolha prévia.

## Direção visual

Referências: dois adversários, fundo escuro, azul × laranja, composição equilibrada e VS central. Traduzir esses princípios para música, com capas, títulos e artistas reais. Não incorporar as imagens de referência como arte do app.
Tokens compartilhados da implementação, sujeitos à verificação visual e de contraste:

| Papel                      | Token inicial |
| -------------------------- | ------------- |
| Fundo comum                | #101216       |
| Superfície comum           | #181C22       |
| Texto principal            | #F5F3ED       |
| Texto secundário           | #B8BEC8       |
| Lado A                     | #38BDF8       |
| Lado B                     | #FF923D       |
| Texto nos botões coloridos | #101216       |

Contraste calculado sRGB: texto #101216 sobre A =8,75:1; sobre B =8,42:1. Isso verifica contraste desses pares, não substitui inspeção do equilíbrio visual ou acessibilidade de toda a tela.
A e B usam a mesma área de cor, tamanho de botão, borda, tipografia e espaçamento. Cards predominantemente escuros, com faixas, letras e botões vibrantes. Nenhum lado fica cinza ou apagado no estado inicial.
Desktop: cards lado a lado com VS no intervalo. Celular: cards empilhados com VS pequeno no intervalo já disponível. Nada sobre os controles ou o conteúdo do player.
Cabeçalho compacto: tema e rodada/confronto; sem repetir a pergunta da home.

## Estados de interação

- Inicial: ambos igualmente disponíveis; rótulos A/B e ação de voto explícita; sem check ou brilho exclusivo que sugira seleção.
- Hover e foco: tratamento equivalente nos dois lados; foco visível independente da cor de identidade.
- Confirmação: música escolhida identificada por nome e ação explícita, mantendo opção de cancelar.
- Processamento: novas decisões bloqueadas de forma equivalente; mensagem de andamento; vitória só depois da resposta autoritativa.
- Erro: região viva permanente, mensagem legível e recuperação existente; não converter cor de identidade em estado de erro.
- Sorteio: ação neutra, fora da identidade cromática A/B, com texto visível “Sortear vencedora” e “Escolha aleatória”. Confirmação explica que escolhe uma das duas músicas ao acaso; não indica recomendação ou avaliação automática.

## Restrições funcionais e critérios de aceite

1. Mesmo peso visual e mesmas dimensões para A/B; repetir avaliação invertendo músicas e trocando posições das cores.
2. Em390×844, estado normal mostra players, ambos os votos, sorteio e progresso sem rolagem; fonte ampliada, erros e telas menores podem crescer naturalmente.
3. Players nativos com área mínima200×200; controles externos com alvo mínimo44px. Preservar pausa mútua, trecho, erros, confirmação, desempate e abandono.
4. Nenhuma cor sozinha comunica identidade ou estado. Letras, nomes e textos acompanham a apresentação.
5. Não adicionar áudio, autoplay, overlay decorativo sobre mídia, algoritmo de recomendação, consultas ou alterações de banco.
6. Implementação em componentes reais; capturas das fixtures existentes permitem avaliar aparência e estados antes da publicação. Preservar a composição desktop aprovada e as regras funcionais.

## Aplicação ao app inteiro

- Home e catálogo: composição editorial em duas colunas no desktop, tipografia de cartaz e dupla faixa de cor. Músicas e temas reais ocupam o espaço disponível; nenhuma opção parece pré-selecionada.
- Tema e modalidades: identidade nas bordas e cabeçalhos; modalidade selecionada comunicada por controle, texto e estado, além da cor.
- Resultado: a campeã tem destaque explícito por nome e troféu. A dupla cromática continua na marca e na imagem de compartilhamento, sem transformar a cor B em derrota.
- Estados e instalação: mesmos fundos, tipografia e ações; erros mantêm semântica própria e recuperação clara.
- Administração: identidade comum com identificação textual Admin; formulários, publicação, disponibilidade e destruição preservam significados distintos. Azul/laranja não substituem estados de sucesso/alerta/erro.
- Marca instalada: ícones e manifestos harmonizados, inclusive tema do navegador. SVG e imagem social não herdam CSS; seus valores precisam corresponder aos tokens.

## Equipe e sequência

Todos os especialistas usam GPT-6 Astra. Ownership por arquivo permite implementação paralela sem disputas:

- Coordenador: tokens, globals.css, layout raiz, botão compartilhado, documentação e integração.
- duel_art_direction: home, tema/modalidade, resultado e imagem social.
- duel_ux: confronto, diálogos, simetria e testes de votação/sorteio.
- app_visual_inventory: administração, estados, PWA e marca instalada.
- Revisão final: padrões e aderência à especificação por revisores independentes, após terminar a implementação.

Conclusão exige verificação dos fluxos existentes, capturas mobile/desktop de cada grupo e registro das limitações. A publicação usa somente o conjunto final revisado; a proposta azul/cinza rejeitada não é uma entrega válida.

## Evidência esperada

Capturas pareadas mobile/desktop, incluindo A/B com conteúdo invertido; verificação de altura e alvos; contraste dos tokens usados; fluxo de voto e sorteio com confirmação; relatório separado de aderência visual e regressões funcionais.

## Complemento de UX recebido

O teste anterior de fundos diferentes é insuficiente: incluir geometria equivalente dos cards/players/votos e área de destaque comparável. Avaliar imagens com nomes curtos e longos e posições invertidas.
Conferir contraste em hover, disabled e foco; avaliação visual em escala de cinza e simulação de deficiência de visão de cores.
Validar teclado na ordem A→B, retorno de foco nos diálogos, texto ampliado e erros. Cancelar voto ou sorteio não envia decisão. Reprodução não deve parecer seleção ou vitória.
Relatórios distinguem explicitamente capturas com players simulados de verificação de players reais.
