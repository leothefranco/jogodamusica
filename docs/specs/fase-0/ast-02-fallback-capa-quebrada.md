# AST-02 — Fallback público de capa quebrada

**Status:** ready-for-agent
**Depende de:** nenhuma

## Problem Statement

Como jogador, posso receber um card vazio ou o ícone de imagem quebrada quando uma
`cover_url` é sintaticamente válida, mas responde 404, entrega HTML, falha na
decodificação ou fica indisponível. A presença dessa URL tem precedência sobre as
thumbnails e a renderização atual não reage ao erro real de carregamento.

O problema também existe nas thumbnails: ter uma URL não significa que a imagem
será carregada. Um fallback que observa somente a capa ainda pode terminar em uma
grade de imagens quebradas.

## Solution

Criar uma fronteira visual cliente pequena e compartilhada pelas superfícies
públicas. Ela tentará, nesta ordem, a capa, até quatro thumbnails válidas
individualmente e o placeholder editorial. Cada candidata que falhar será retirada
daquela montagem; quando todas as thumbnails falharem, o placeholder assumirá o
mesmo espaço reservado.

A fronteira tratará também a corrida em que a imagem falha antes da hidratação:
depois de assumir o elemento, verificará se ele já terminou com largura natural
zero. Não haverá timeout para decidir falha.

## User Stories

1. Como jogador, quero ver a capa quando ela carrega, para preservar a escolha
   editorial.
2. Como jogador, quero cair automaticamente para thumbnails quando a capa falhar,
   para ainda reconhecer o Tema.
3. Como jogador, quero que cada thumbnail quebrada seja descartada sem invalidar
   as demais, para aproveitar as imagens que continuam disponíveis.
4. Como jogador, quero ver o placeholder editorial quando capa e todas as
   thumbnails falharem, para nunca receber uma área visual quebrada.
5. Como jogador, quero o mesmo comportamento na home e no detalhe do Tema, para
   não depender da rota pela qual cheguei.
6. Como jogador em conexão lenta, quero que carregamento não seja confundido com
   falha, para evitar troca prematura de imagem.
7. Como jogador, quero que uma resposta 404, HTML ou imagem indecodificável tenha
   o mesmo fallback seguro.
8. Como jogador, quero que a área mantenha proporção e dimensões em todos os
   estados, para evitar salto de layout.
9. Como jogador em tela pequena, quero que o fallback não cause overflow nem
   empurre o CTA para fora do card.
10. Como usuário de leitor de tela, quero um único nome acessível para o Tema, para
    não ouvir capa, thumbnails e título repetidos.
11. Como usuário com movimento reduzido, quero que a recuperação não dependa de
    animação para ser compreendida.
12. Como desenvolvedor, quero que a falha anterior à hidratação seja detectada,
    para não deixar o primeiro carregamento preso em imagem quebrada.
13. Como desenvolvedor, quero que uma URL falha não seja tentada em loop durante a
    mesma montagem, para não gerar requests e mudanças visuais repetidas.
14. Como revisor, quero interceptar a resposta antes da navegação real do browser,
    para testar a corrida que um evento sintético tardio não representa.
15. Como mantenedor, quero que o card e suas consultas continuem Server Components,
    para limitar JavaScript cliente ao estado visual indispensável.
16. Como responsável editorial, quero que o placeholder continue coerente com a
    identidade do produto, para a falha parecer um estado projetado.

## Implementation Decisions

- A precedência será: capa carregável → thumbnails carregáveis, no máximo quatro →
  placeholder editorial.
- “Carregável” será determinado pelo elemento de imagem no browser, não apenas
  pela existência ou sintaxe da URL.
- Uma fronteira cliente mínima possuirá o estado das candidatas que falharam. A
  consulta, o conteúdo do card e a estrutura principal continuarão no servidor.
- O estado inicial tentará a capa quando houver uma. Ausência de capa inicia nas
  thumbnails; ausência de ambas inicia no placeholder.
- O evento de erro removerá apenas a candidata correspondente.
- Após a hidratação, cada imagem assumida será verificada: se `complete` for
  verdadeiro e a largura natural for zero, será tratada como falha já ocorrida.
- Não haverá timeout arbitrário. Uma imagem ainda carregando preservará o estado de
  carregamento e o espaço reservado.
- Capa e thumbnails já marcadas como falhas não serão reintroduzidas na mesma
  montagem, mesmo que o componente renderize novamente.
- As thumbnails respeitarão a ordem editorial retornada pelo catálogo. A falha de
  uma não reordenará as demais além de fechar o espaço da candidata inválida.
- O contêiner manterá o mesmo aspect ratio, dimensões mínimas e recorte em todos os
  estados.
- O link/card terá um único nome acessível derivado do Tema. Imagens usadas na
  composição serão decorativas quando o título já nomear o destino.
- A troca poderá ser imediata ou usar transição puramente decorativa; com movimento
  reduzido, nenhuma informação dependerá dessa transição.
- A falha visual não alterará automaticamente o banco nem tentará apagar dados
  legados.
- AST-02 é independente de AST-01: corrige URLs legadas e thumbnails atuais sem
  depender do futuro contrato de assets.

## Testing Decisions

- O seam principal será uma navegação real de browser pela home e pelo detalhe,
  com a resposta da imagem interceptada antes da navegação.
- Um cenário fará a capa responder 404 e confirmará a aparição das thumbnails sem
  ícone de imagem quebrada.
- Outro fará a capa responder conteúdo HTML com status 200 e confirmará falha de
  decodificação seguida do mesmo fallback.
- Um cenário fará thumbnails individuais falharem em ordens diferentes e provará
  que as válidas permanecem.
- Um cenário fará capa e todas as thumbnails falharem e observará o placeholder
  editorial final.
- Um cenário de corrida entregará a falha antes da hidratação e verificará a
  checagem `complete`/largura natural após o componente assumir o elemento.
- Uma capa válida continuará tendo precedência e não carregará thumbnails de modo
  desnecessário.
- Um teste de rerender provará que a mesma URL falha não entra em retry infinito.
- Snapshots dimensionais antes/depois cobrirão desktop e mobile, sem mudança do
  contêiner, overflow horizontal ou controle encoberto.
- A verificação de acessibilidade confirmará um único nome do card, imagens
  decorativas e ausência de elemento quebrado focável.
- Testes de componente podem cobrir a máquina de candidatas, mas não substituem os
  cenários de browser que observam rede, decodificação e hidratação.

## Out of Scope

- Aviso, remoção ou remediação de capa no admin.
- Telemetria de origem gerenciada versus legada.
- Verificação proativa de todas as URLs pelo servidor.
- Fazer proxy de imagens externas.
- Migrar para `next/image`.
- Apagar ou substituir automaticamente dados legados.
- Implementar crop, ponto focal, variantes ou garbage collector.
- Alterar a composição visual definitiva dos cards.

## Further Notes

- Há um registro legado observado na auditoria que aponta para uma página web em
  vez de uma imagem; ele representa o caso de resposta 200 com falha de
  decodificação, mas o teste usará fixture determinística.
- Rollout: liberar a fronteira compartilhada na home e no detalhe no mesmo release,
  pois comportamento divergente entre as duas superfícies seria uma regressão.
- Rollback: restaurar a renderização anterior não exige mudança de dados.
- Critério de saída: nenhuma falha de capa ou thumbnail deixa área quebrada nas
  superfícies públicas, inclusive quando ocorre antes da hidratação; dimensões e
  nome acessível permanecem estáveis.
