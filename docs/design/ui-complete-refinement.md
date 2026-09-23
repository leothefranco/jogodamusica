# UI-REFINO-02 — pacote visual completo

Este pacote sucede o refinamento móvel UI01. A autorização de 12/09/2026 reúne
três resultados: votação normal sem rolagem em 390×844, controles arredondados
consistentes e quatro posições de capas no catálogo. Não altera regras de partida,
elegibilidade, dados, autenticação ou integração com YouTube.

## Composição

- Confronto: recuperar altura com padding, gaps e cabeçalho compactos. Os players
  continuam com mínimo de 200×200, os votos e ações do confronto com mínimo de
  48px. Cards de 20px, votos de 14px e VS circular de 48px no mobile. Distância
  player→voto de 12px preservada; distância card→VS de 8px no mobile.
- Catálogo: cada tema é um card inteiro clicável, com título/metadados acima de
  quatro posições quadradas, gap de 8px, raio de 8px e referência de 60px por
  imagem (fileira limitada a 264px). A fileira encolhe em 320px sem sobreposição.
  Hero móvel mais curto; composição editorial de duas colunas no desktop.
- Controles: tokens `sm=8px`, `md=12px`, `lg=14px`, `xl=18px`, `2xl=20px`.
  O botão compartilhado usa `md`; formulários existentes que já usavam `md`
  passam a receber 12px reais. Overrides quadrados de modalidades, resultado e
  diálogos foram removidos; cards/painéis correspondentes usam 20px.

O estado normal em 390×844 deve caber integralmente a 100%, com tolerância de 1px.
Nomes longos, texto a 200%, erro, landscape baixo e telas menores podem rolar
naturalmente. Não se corta conteúdo nem se reduz a área de mídia para simular
esse resultado. Não há promessa de zero scroll universal.

## Capas e recuperação

`ThemeThumbnailStack` mantém a variante padrão e acrescenta a variante explícita
`catalog`, usada somente por `HomeExperience`. Ela usa as primeiras quatro URLs
únicas já recebidas, na mesma ordem. Cada falha ou ausência ocupa sua própria
posição com símbolo neutro: não há repetição de música nem busca extra.

Fora do catálogo, a seleção continua capa administrativa → miniaturas →
placeholder. O mecanismo de falha após carregamento ou antes da hidratação é
preservado. O raio das miniaturas dessa recuperação também é 8px; sua precedência
e geometria de pilha continuam inalteradas. Permanecem imagens nativas já usadas
pelo projeto: migrar para outro pipeline/allowlist não pertence ao pacote.

## Resultado

`GameResult` contém a renderização extraída da página de resultado. Não tem I/O,
estado global ou nova diretiva client. A página conserva params, loader, redirects
de partida ativa/abandonada, projeção e notFound. A fixture usa o mesmo componente,
com projeção válida; a imagem social é interceptada apenas no teste HTTP.

## Exceções deliberadas

Links textuais, barras/divisórias, badges decorativos, marca, troféu e etiquetas de
vencedora não são botões/painéis e não recebem arredondamento por substituição
global. Radios/checkboxes e confirmações nativas mantêm a aparência do navegador.
Player e iframe não recebem arredondamento ou clipping artificial. A prévia de
imagem do resultado é miniatura clicável (8px), não botão retangular de ação.
Avisos inline usam 12px; os painéis que os contêm usam 20px.

Cores e fontes existentes foram preservadas. As imagens neutras e players vazios
das capturas são fronteiras simuladas de teste, não assets incorporados ao produto.
A referência visual orienta composição, não substitui os controles nativos por
players desenhados. Veja o [inventário e as provas](../qa/ui-complete-refinement.md).
