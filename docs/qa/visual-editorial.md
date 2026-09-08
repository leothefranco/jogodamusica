# Reformulação editorial — home e confronto

## Direção aprovada

Usuário aprovou composição combinada D do protótipo, paleta carvão/branco suave/azul-cobalto. Após crítica ao espaço vazio do desktop, aprovou pergunta à esquerda e catálogo à direita. Texto central: "Qual é a melhor música?". Objetivo é eleger a melhor, não sugerir o que ouvir.
Referência preservada: branch codex/prototype-cartaz-contemporaneo, commit de9165e. Não levar controles/variantes/dados fictícios à produção.

## Escopo

- Home real com tipografia de cartaz, lista de temas e capas reais, links e contagens existentes. Desktop em duas colunas, celular empilhado; nomes longos e catálogo vazio legíveis.
- Confronto em carvão e azul, sem decoração roxa/gradiente; pergunta Qual é a melhor?; título/artista e botões legíveis.
- Preservar players nativos, tamanho mínimo200px, pausa mútua, duração do trecho, confirmação acessível, erros, desempate, abandono, progresso e resultado. Votos continuam explícitos e dependentes das mesmas ações.
- Diálogos do jogo acompanham a paleta. Não alterar APIs, consultas públicas, autenticação ou banco. #13 CAT05 é independente e não integra esta entrega.
- Fonte Anton hospedada no app com licença OFL, para não depender de Impact instalada no dispositivo.
- Admin, detalhe de tema e resultado não são redesenhados nesta entrega.

## Validação

Base c47fec1bbdf34eaf2d8fb0d3dacb9d18b5e94c75. Testes de catálogo e dois players:16/16 passaram; regressões incluem dimensões, confirmação/cancelamento, pausa, erro, desempate/reduced-motion e abandono. Typecheck passou; gates e capturas finais registrados em tmp/visual-editorial-release.
Fonte: https://github.com/google/fonts/tree/main/ofl/anton (arquivo original e licença inclusos).
