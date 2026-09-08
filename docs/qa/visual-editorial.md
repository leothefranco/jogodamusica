# Reformulação editorial — home e confronto

## Direção aprovada

Usuário aprovou composição combinada D do protótipo, paleta carvão/branco suave/azul-cobalto. Após crítica ao espaço vazio do desktop, aprovou pergunta à esquerda e catálogo à direita. Texto central: "Qual é a melhor música?". Objetivo é eleger a melhor, não sugerir o que ouvir.
Referência preservada: branch codex/prototype-cartaz-contemporaneo, commit de9165e. Não levar controles/variantes/dados fictícios à produção.

## Escopo

- Home real com tipografia de cartaz, lista de temas e capas reais, links e contagens existentes. Desktop em duas colunas, celular empilhado; nomes longos e catálogo vazio legíveis.
- Confronto em carvão e azul, sem decoração roxa/gradiente; cabeçalho compacto com Tema e rodada, sem repetir a pergunta da home; título/artista e botões legíveis.
- Preservar players nativos, tamanho mínimo200px, pausa mútua, duração do trecho, confirmação acessível, erros, desempate, abandono, progresso e resultado. Votos continuam explícitos e dependentes das mesmas ações.
- Diálogos do jogo acompanham a paleta. Não alterar APIs, consultas públicas, autenticação ou banco. #13 CAT05 é independente e não integra esta entrega.
- Fonte Anton hospedada no app com licença OFL, para não depender de Impact instalada no dispositivo.
- Admin, detalhe de tema e resultado não são redesenhados nesta entrega.

## Validação

Base c47fec1bbdf34eaf2d8fb0d3dacb9d18b5e94c75. Testes de catálogo e dois players:16/16 passaram; regressões incluem dimensões, confirmação/cancelamento, pausa, erro, desempate/reduced-motion e abandono. Typecheck passou; gates e capturas finais registrados em tmp/visual-editorial-release.
Fonte: https://github.com/google/fonts/tree/main/ofl/anton (arquivo original e licença inclusos).

## Correção do confronto móvel após avaliação em produção

Usuário apontou rolagem excessiva, repetição desnecessária da pergunta, separação A/B enfraquecida e sorteio escondido. Esta revisão substitui a pergunta antes prevista no confronto; a home aprovada permanece intacta.

- Cabeçalho móvel compacto, sem slogan, mantendo Tema e rodada.
- A com superfície azulada; B com grafite e borda clara. Letras A/B preservadas: identificação não depende só de cor.
- Botão visível “Sortear vencedora”, acompanhado de “Escolha aleatória”. Mantém confirmação e sorteio autoritativo existente.
- Em390×844, confronto e controles cabem sem rolagem no estado normal. Em telas mais baixas ou com fonte ampliada/erros, rolagem natural é permitida para preservar players mínimos200px, toques44px e acesso a todo conteúdo.
- Feedback de decisão aparece quando há mensagem; sem texto promocional ocupando espaço no estado normal.
- Teste de regressão mede viewport/altura, botão B visível, superfícies diferentes e confirmação do sorteio; suíte existente cobre players, decisão, erro, pausa, abandono e reduced-motion.
