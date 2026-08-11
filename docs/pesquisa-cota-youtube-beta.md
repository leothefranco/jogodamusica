# Pesquisa: cota da YouTube Data API no beta

Data da verificação: 10 de agosto de 2026.

## Conclusão

Para o uso atual do Jogo da Música, a cota padrão deve ser suficiente para um
beta com poucos administradores. Jogar e reproduzir músicas não consome a cota
da YouTube Data API: as partidas usam a YouTube IFrame Player API diretamente no
navegador. A Data API é chamada somente no painel administrativo para pesquisar,
resolver um vídeo e preparar ou confirmar uma importação de playlist.

O gargalo relevante é a pesquisa: desde a mudança documentada em junho de 2026,
`search.list` possui um balde próprio de **100 chamadas por dia**, e cada chamada
custa 1 unidade desse balde. Os demais endpoints usados pelo app compartilham
**10.000 unidades por dia**. Portanto, o beta não deve atingir o limite com uso
administrativo normal, mas 100 pesquisas distintas sem cache no mesmo dia
esgotariam especificamente o balde de pesquisa
([visão geral oficial](https://developers.google.com/youtube/v3/getting-started#quota),
[calculadora oficial](https://developers.google.com/youtube/v3/determine_quota_cost)).

## Limites e custos atuais

Projetos que ativam a YouTube Data API recebem, por padrão:

- 100 chamadas de `search.list` por dia, em balde próprio;
- 100 chamadas de `videos.insert` por dia, em balde próprio (não usado pelo app);
- 10.000 unidades por dia, combinadas para os demais endpoints.

Todas as requisições, inclusive inválidas, custam pelo menos uma unidade. Cada
página adicional também é uma nova chamada. As cotas diárias reiniciam à
meia-noite do horário do Pacífico (`PT`), e os valores padrão são declarados
como sujeitos a alteração
([calculadora oficial de cota](https://developers.google.com/youtube/v3/determine_quota_cost)).

| Método               |                                      Custo atual | Balde                                           |
| -------------------- | -----------------------------------------------: | ----------------------------------------------- |
| `search.list`        | 1 por chamada, máximo padrão de 100 chamadas/dia | Pesquisa                                        |
| `videos.list`        |                                        1 unidade | Geral, 10.000/dia                               |
| `playlistItems.list` |                             1 unidade por página | Geral, 10.000/dia                               |
| `playlists.list`     |                                        1 unidade | Geral, 10.000/dia                               |
| `channels.list`      |                                        1 unidade | Geral, 10.000/dia; não é usado pelo fluxo atual |

Os custos são confirmados nas referências oficiais de
[`search.list`](https://developers.google.com/youtube/v3/docs/search/list),
[`videos.list`](https://developers.google.com/youtube/v3/docs/videos/list),
[`playlistItems.list`](https://developers.google.com/youtube/v3/docs/playlistItems/list)
e [`channels.list`](https://developers.google.com/youtube/v3/docs/channels/list).

> Atenção: a informação histórica de que cada `search.list` custa 100 das
> 10.000 unidades gerais não descreve mais o modelo oficial vigente em agosto de 2026. Agora a chamada custa 1, mas existe o limite diário separado de 100
> pesquisas.

## Consumo do app

Pela implementação atual em `src/server/providers/youtube/youtube-provider.ts`:

- uma pesquisa administrativa sem cache usa 1 `search.list` e 1 `videos.list`:
  uma das 100 pesquisas e 1 unidade geral;
- resolver uma URL ou ID usa 1 `videos.list`: 1 unidade geral;
- a prévia de uma playlist de até 200 itens usa 1 `playlists.list`, até 4
  `playlistItems.list` e até 4 `videos.list`: até 9 unidades gerais;
- confirmar os 200 itens revalida os vídeos em lotes de 50: até 4 unidades
  gerais;
- uma prévia completa seguida de confirmação custa, portanto, até 13 unidades
  gerais.

Em termos de ordem de grandeza, as 10.000 unidades gerais comportariam cerca de
769 importações completas de 200 itens se não houvesse nenhum outro consumo.
Esse número é apenas uma aproximação matemática, não uma meta operacional.
Para a pesquisa, o limite é direto: no pior caso, 100 consultas sem cache por
dia.

O app reduz repetições com cache de cinco minutos por pesquisa normalizada e
cache de 15 minutos para a prévia de playlist. Também limita cada administrador
a 10 requisições de pesquisa por minuto e a 5 novas prévias por dez minutos.
Esses controles reduzem picos, mas **não garantem** que o balde diário de 100
pesquisas nunca seja esgotado; um único administrador ainda pode ultrapassá-lo ao
longo do dia.

## IFrame Player API não é Data API

A [referência oficial da IFrame Player API](https://developers.google.com/youtube/iframe_api_reference)
descreve uma API JavaScript para incorporar e controlar o player, enquanto a
cota acima contabiliza requisições aos métodos da YouTube Data API. A
documentação não atribui unidades da Data API a reproduções no iframe. Assim,
abrir uma partida, carregar os dois players, tocar, pausar ou trocar de vídeo não
deve ser contado como `search.list`, `videos.list` ou outro endpoint da Data API.

Isso significa que o número de jogadores e de reproduções não é o fator que
ameaça essa cota. O que deve ser acompanhado é a atividade administrativa.

## Quando a cota acaba

Ao exceder a cota, a Data API não conclui a requisição e responde HTTP 403 com o
motivo `quotaExceeded`
([tabela oficial de erros](https://developers.google.com/youtube/v3/docs/errors#Core_API_errors)).
No app atual, esse motivo é convertido em `YOUTUBE_QUOTA_EXCEEDED` e resposta 503.
As partidas com músicas já cadastradas continuam independentes dessas consultas;
as funções administrativas que precisam da Data API ficam indisponíveis até o
reset ou uma extensão de cota.

## Aumento de cota

Para obter cota além do padrão, o Google exige uma auditoria que demonstre a
conformidade do projeto com os Termos de Serviço das APIs do YouTube. O pedido é
feito pelo formulário oficial de auditoria e extensão; o Google pode realizar
novas auditorias periódicas. Quem concluiu uma auditoria nos últimos 12 meses e
precisa de outra extensão usa o mesmo processo
([guia oficial de auditoria e cota](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits),
[formulário oficial](https://support.google.com/youtube/contact/yt_api_form?hl=pt-BR)).

O formulário solicita informações sobre o responsável, o cliente da API, os
projetos Google Cloud, casos de uso, endpoints e volume esperado. Também pede URL
HTTPS acessível, política de privacidade e evidências de conformidade. Para o
beta, a recomendação é medir primeiro o uso real no Google Cloud Console e pedir
a extensão somente se a aproximação do limite de pesquisa se repetir.

## Recomendação para o beta

1. Começar com a cota gratuita padrão e um único projeto/chave de produção.
2. Monitorar separadamente o balde `Search Queries` e as 10.000 unidades gerais
   no Google Cloud Console.
3. Orientar administradores a colar URL/ID quando já conhecem o vídeo: isso usa
   apenas 1 unidade geral e preserva uma das 100 pesquisas diárias.
4. Evitar repetir consultas com termos ligeiramente diferentes e manter o cache.
5. Antes de abrir o beta para muitos curadores, considerar um limite diário
   compartilhado de pesquisas no app e telemetria de cache hit/miss.
