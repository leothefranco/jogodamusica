# Pesquisa: importação de playlists do YouTube

Data da verificação: 28 de julho de 2026.

## Conclusão

É tecnicamente viável importar uma playlist inteira para um tema usando a
YouTube Data API v3. A implementação deve ter duas etapas:

1. percorrer todos os itens da playlist com `playlistItems.list`;
2. consultar os vídeos encontrados com `videos.list` para obter metadados atuais
   e eliminar itens que não estejam disponíveis ou não possam ser incorporados.

A primeira entrega pode aceitar playlists públicas e não listadas usando a chave
de API já prevista no projeto. Importar playlists privadas exige um fluxo OAuth
2.0 do Google em nome do usuário que tem acesso à playlist; uma chave de API
sozinha não concede acesso a dados privados.

## Fluxo recomendado

### 1. Extrair e validar o ID da playlist

Aceitar uma URL de playlist ou o ID isolado e extrair o parâmetro `list`. Antes
de iniciar a importação, é útil consultar `playlists.list` para validar a
playlist e obter título e contagem declarada. Essa chamada custa 1 unidade de
quota. A referência registra `playlistForbidden` quando a requisição não é
autorizada e `playlistNotFound` quando o ID não é encontrado
([documentação oficial de `playlists.list`](https://developers.google.com/youtube/v3/docs/playlists/list)).

### 2. Percorrer todos os itens

Fazer chamadas a:

```text
GET https://www.googleapis.com/youtube/v3/playlistItems
  ?part=contentDetails,snippet,status
  &playlistId={PLAYLIST_ID}
  &maxResults=50
  &pageToken={NEXT_PAGE_TOKEN}
```

`playlistItems.list` retorna os itens de uma playlist, aceita no máximo 50
resultados por página (o padrão é 5) e custa 1 unidade por chamada. Enquanto a
resposta contiver `nextPageToken`, uma nova página deve ser solicitada usando
esse valor em `pageToken`
([referência do método](https://developers.google.com/youtube/v3/docs/playlistItems/list),
[guia oficial de paginação](https://developers.google.com/youtube/v3/guides/implementation/pagination)).

O ID do vídeo pode ser lido em `contentDetails.videoId` ou
`snippet.resourceId.videoId`. A posição original está em `snippet.position`
([recurso `playlistItem`](https://developers.google.com/youtube/v3/docs/playlistItems)).

### 3. Revalidar os vídeos

Os dados de `playlistItems.list` não devem ser a fonte final de disponibilidade.
Agrupar os IDs encontrados e chamar:

```text
GET https://www.googleapis.com/youtube/v3/videos
  ?part=id,snippet,contentDetails,status
  &id={IDS_SEPARADOS_POR_VIRGULA}
```

`videos.list` aceita uma lista de IDs separados por vírgula e custa 1 unidade
por chamada. Quando o filtro `id` é usado, `maxResults` e `pageToken` **não são
suportados**; portanto, a aplicação deve dividir os IDs em lotes em vez de
tentar paginar essa consulta
([referência oficial de `videos.list`](https://developers.google.com/youtube/v3/docs/videos/list)).

A página oficial não declara, na descrição do parâmetro `id`, um limite numérico
de IDs por requisição. Usar lotes de até 50 é uma decisão de implementação
conservadora e coerente com o tamanho máximo das páginas da API, mas não deve ser
documentado como um limite contratual de `videos.list`.

Para cada ID solicitado:

- manter somente recursos efetivamente retornados por `videos.list`;
- exigir `status.privacyStatus` igual a `public` ou `unlisted`;
- exigir `status.embeddable === true`;
- opcionalmente validar `contentDetails.regionRestriction` para o Brasil, pois
  um vídeo incorporável ainda pode ser bloqueado por região.

O recurso `video` define os estados de privacidade `private`, `public` e
`unlisted`, informa se o vídeo é incorporável em `status.embeddable` e descreve
as restrições territoriais em `contentDetails.regionRestriction`
([referência oficial do recurso `video`](https://developers.google.com/youtube/v3/docs/videos)).

### 4. Tratar removidos, privados e duplicados

Um item presente na playlist pode deixar de produzir um recurso de vídeo
utilizável. A aplicação deve comparar os IDs pedidos a `videos.list` com os IDs
retornados e classificar como ignorado qualquer ID ausente. A API não oferece,
para uma consulta pública em lote, uma distinção confiável que o produto deva
expor entre “removido”, “privado” e “indisponível para esta credencial”; a
mensagem segura para o administrador é **vídeo indisponível**. A referência
também prevê `videoNotFound` para vídeos que não podem ser encontrados
([erros de `videos.list`](https://developers.google.com/youtube/v3/docs/videos/list)).

Playlists podem conter o mesmo vídeo mais de uma vez. Se o modelo do tema admite
um único cadastro por vídeo, deduplicar pelo ID do YouTube e informar a
quantidade de duplicados ignorados.

O resultado da importação deve apresentar um resumo, por exemplo:

- itens encontrados na playlist;
- vídeos importados;
- duplicados ignorados;
- indisponíveis ou privados ignorados;
- não incorporáveis ignorados;
- bloqueados por região ignorados.

Como disponibilidade, privacidade e permissão de incorporação podem mudar, a
mesma validação deve ser repetida antes de publicar o tema ou criar uma partida,
sem depender de uma pesquisa do YouTube durante o jogo.

## Playlists privadas e autorização

Consultas sem autorização recuperam somente dados públicos; consultas
autorizadas também podem acessar dados privados do usuário autenticado quando
ele possui a permissão necessária
([visão geral da Data API](https://developers.google.com/youtube/v3/getting-started)).
O YouTube usa OAuth 2.0 para autorizar acesso a dados privados
([guia oficial de autorização](https://developers.google.com/youtube/v3/guides/authentication)).

Para uma importação somente de leitura, o escopo mínimo adequado é:

```text
https://www.googleapis.com/auth/youtube.readonly
```

Esse escopo permite visualizar a conta do YouTube do usuário
([OAuth 2.0 para aplicações web](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)).
Uma tentativa sem autorização suficiente pode produzir
`playlistItemsNotAccessible` (403), e playlists não localizadas produzem
`playlistNotFound` (404)
([erros de `playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list)).

Implicação para o produto: autenticação administrativa no sistema não substitui
o consentimento OAuth do Google. Suportar playlists privadas acrescenta cadastro
de cliente OAuth, tela de consentimento, armazenamento/renovação segura de
tokens e tratamento de revogação. Por isso, recomenda-se:

1. primeira versão: playlists públicas e não listadas com chave de API;
2. versão posterior, se houver demanda real: conexão opcional da conta Google
   com `youtube.readonly` para playlists privadas.

## Quota

Cada chamada a `playlistItems.list` custa 1 unidade e cada chamada a
`videos.list` também custa 1 unidade. Todas as requisições, inclusive inválidas,
consomem pelo menos uma unidade. O projeto recebe uma quota diária padrão, mas o
valor é sujeito a mudanças e deve ser acompanhado no Google Cloud
([visão geral de quota](https://developers.google.com/youtube/v3/getting-started#quota),
[calculadora oficial por método](https://developers.google.com/youtube/v3/determine_quota_cost)).

Com páginas de 50 itens e lotes de validação de 50 IDs, uma playlist com `N`
itens consome aproximadamente:

```text
ceil(N / 50) chamadas de playlistItems.list
+ ceil(N / 50) chamadas de videos.list
+ 1 chamada opcional de playlists.list
```

Exemplo: uma playlist de 120 itens usa aproximadamente 7 unidades: três páginas
de itens, três lotes de vídeos e uma validação inicial da playlist. Esse custo é
substancialmente menor que importar cada vídeo com uma chamada individual.

## Requisitos sugeridos para o plano

- campo/ação “Importar playlist do YouTube” na administração do tema;
- suporte inicial a URL ou ID de playlist pública/não listada;
- paginação completa de `playlistItems.list`, nunca apenas a primeira página;
- validação em lote via `videos.list`;
- descarte de vídeos indisponíveis, privados, não incorporáveis ou bloqueados na
  região do jogo;
- deduplicação por ID do YouTube;
- importação idempotente, sem recriar músicas já associadas ao tema;
- resumo de importados e ignorados, com motivo;
- limite de tamanho e rate limit definidos pelo produto para evitar abuso, mesmo
  que a playlist seja maior;
- revalidação antes da publicação ou da criação da partida;
- playlists privadas fora do primeiro escopo, a menos que também seja planejado
  o fluxo OAuth 2.0 do Google.
