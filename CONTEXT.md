# Jogo da Música

Contexto do catálogo musical e das partidas eliminatórias usadas para comparar
músicas e eleger uma campeã.

## Language

**Sorteio de rodada**:
Embaralhamento persistido dos vencedores de uma rodada para formar os confrontos da rodada seguinte. O resultado não muda ao recarregar a partida.
_Avoid_: Avanço automático, chave fixa

**Desempate**:
Decisão aleatória e definitiva entre as duas músicas de um confronto quando o grupo não escolhe uma vencedora. A roleta apenas revela o resultado já registrado.
_Avoid_: Novo voto, voto aleatório, sorteio visual

**Modalidade de partida**:
Quantidade de músicas de uma partida, escolhida pelo jogador entre os tamanhos suportados pelo catálogo ativo do tema. Não é uma configuração do tema.
_Avoid_: Quantidade de rodadas do tema, chave padrão

**Tema publicável**:
Tema com pelo menos quatro músicas ativas, quantidade mínima necessária para oferecer uma modalidade de partida.
_Avoid_: Tema configurado, tema com chave padrão

**Metadados de origem**:
Dados fornecidos pelo provedor de música, como título original, canal, duração e
miniatura. Representam a fonte consultada e não são ajustes editoriais.
_Avoid_: Dados exibidos, nome da música

**Dados exibidos**:
Título e artista revisáveis que identificam uma música dentro de um tema e são
apresentados durante a partida. Podem partir dos metadados de origem sem ficar
presos à forma como o provedor os publicou.
_Avoid_: Metadados de origem, nome da música
