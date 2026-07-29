# Fase 2.1 — Importação de playlist e catálogo flexível

**Status:** ready-for-agent

## Problem Statement

Adicionar músicas individualmente torna a preparação de temas grandes lenta e
propensa a repetição. O administrador também não enxerga imediatamente quais
tamanhos de partida o catálogo ativo suporta.

## Solution

O administrador informa uma playlist pública ou não listada do YouTube em uma
página dedicada do tema. O sistema percorre até 200 posições, revalida os vídeos
em lotes, apresenta uma prévia classificando cada item e permite confirmar os
itens elegíveis selecionados. A importação preserva associações existentes e
atualiza as modalidades de rodadas suportadas pelo catálogo.

## User Stories

1. Como administrador, quero informar uma URL ou ID de playlist, para preencher
   um tema sem cadastrar cada vídeo manualmente.
2. Como administrador, quero importar playlists públicas ou não listadas usando
   a configuração atual da YouTube Data API.
3. Como administrador, quero receber um erro claro para playlists privadas,
   inexistentes ou inacessíveis.
4. Como administrador, quero que todas as páginas da playlist sejam percorridas
   até o teto operacional, para não receber apenas os primeiros resultados.
5. Como administrador, quero saber quando a playlist excede 200 posições, para
   entender que a prévia é parcial.
6. Como administrador, quero ver quantas posições, vídeos únicos e duplicatas
   foram encontrados.
7. Como administrador, quero distinguir itens prontos, já associados,
   duplicados, indisponíveis, não incorporáveis, bloqueados no Brasil e
   inválidos.
8. Como administrador, quero que todos os itens prontos venham selecionados,
   para confirmar uma importação comum rapidamente.
9. Como administrador, quero selecionar ou desmarcar todos os itens prontos.
10. Como administrador, quero desmarcar itens individuais antes de confirmar.
11. Como administrador, quero que itens inelegíveis permaneçam bloqueados, para
    não tentar importar conteúdo que não poderá ser reproduzido.
12. Como administrador, quero revisar a prévia por até 15 minutos.
13. Como administrador, quero que uma prévia expirada seja revalidada, para não
    importar dados obsoletos.
14. Como administrador, quero que uma falha de paginação, timeout ou cota
    invalide a prévia, para não confundir uma falha desconhecida com o limite
    intencional.
15. Como administrador, quero confirmar enviando somente os IDs selecionados,
    para que o navegador não seja fonte confiável de metadados.
16. Como administrador, quero que vídeos alterados após a prévia sejam
    reclassificados antes da gravação.
17. Como administrador, quero que itens já associados preservem título, artista,
    trecho, ativação e ordem.
18. Como administrador, quero que metadados de origem sejam atualizados quando o
    YouTube retornar dados mais recentes.
19. Como administrador, quero que novas músicas usem título e canal de origem
    como dados exibidos iniciais.
20. Como administrador, quero que novas músicas entrem ativas e sem ordem
    manual, para participarem imediatamente do sorteio.
21. Como administrador, quero editar os dados exibidos e o trecho no editor do
    tema após a importação.
22. Como administrador, quero que repetir a mesma importação não crie músicas ou
    associações duplicadas.
23. Como administrador, quero que vídeos individualmente inelegíveis não
    impeçam os demais itens válidos.
24. Como administrador, quero que uma falha de banco reverta todo o lote
    elegível, para evitar persistência sem resultado confiável.
25. Como administrador, quero ver quantos itens foram adicionados, já existiam
    ou foram ignorados.
26. Como administrador, quero voltar ao editor do tema após confirmar.
27. Como administrador, quero ver se o catálogo ativo suporta 2, 3, 4 ou 5
    rodadas.
28. Como administrador, quero que prévias repetidas em cache não consumam
    novamente meu limite operacional.
29. Como operador, quero limitar cada administrador a cinco prévias não
    cacheadas a cada dez minutos, para proteger a cota.

## Implementation Decisions

- A importação ocorre em uma página dedicada dentro do tema.
- O teto padrão é configurável e vale 200 posições da playlist, contando
  duplicatas.
- O teto produz uma prévia parcial explícita; falhas externas de paginação
  invalidam toda a prévia.
- A região de elegibilidade é Brasil.
- Playlists privadas e OAuth permanecem fora do MVP.
- A prévia dura 15 minutos e é vinculada ao administrador, tema e playlist.
- Prévia cacheada não consome o limite de cinco gerações a cada dez minutos.
- O navegador envia somente o identificador da prévia e os IDs selecionados.
- A confirmação usa a prévia válida para autorizar a seleção e sempre revalida
  no YouTube, em lotes, os itens que podem ser gravados.
- Todos os itens `pronto` começam selecionados. Outros estados são informativos
  e não selecionáveis.
- A prévia não edita dados exibidos nem trecho.
- Novas associações entram ativas, com música inteira, dados exibidos derivados
  da origem e sem ordem manual.
- Associações existentes nunca são sobrescritas pela importação.
- Metadados de origem globais podem ser atualizados.
- A gravação dos itens elegíveis ocorre em uma única transação por tema.
- Modalidades suportadas são derivadas da quantidade de músicas ativas:
  4/8/16/32 músicas correspondem a 2/3/4/5 rodadas.
- Não haverá persistência durável de prévias; uma ausência de cache ainda
  permite a revalidação segura dos IDs selecionados.

## Testing Decisions

- O seam de domínio do provedor verifica normalização de IDs, paginação, teto,
  lotes, deduplicação, classificação regional e erros externos.
- O seam do handler HTTP verifica autenticação, validação, formato de erro,
  cache e rate limit sem acessar o YouTube real.
- O seam do serviço de conteúdo verifica revalidação, preservação de
  associações, idempotência, resultado parcial e atomicidade.
- O helper público de modalidades verifica os limiares 4, 8, 16 e 32.
- Testes observam resultados públicos e usam mocks somente nas fronteiras com
  YouTube, banco e tempo.
- Os testes existentes das rotas YouTube e do serviço de conteúdo são o padrão
  de organização.

## Out of Scope

- Playlists privadas e OAuth do Google.
- Sincronização contínua com a playlist após a importação.
- Edição em lote de título, artista ou trecho na prévia.
- Preservação da ordem da playlist.
- Importação de áudio ou suporte a outro provedor musical.
- Implementação das partidas e do sorteio.

## Further Notes

- O QA manual da Fase 2 continua pendente e deve ocorrer antes do deploy.
- A publicação deste spec e dos tickets no GitHub está pendente porque a
  autenticação local do `gh` está inválida.
