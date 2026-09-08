# Jogo da Música

Contexto do catálogo musical e das partidas eliminatórias usadas para comparar
músicas e eleger uma campeã.

## Language

**Sorteio de rodada**:
Embaralhamento persistido dos vencedores de uma rodada para formar os confrontos da rodada seguinte. O resultado não muda ao recarregar a partida.
_Avoid_: Avanço automático, chave fixa

**Transição do chaveamento**:
Mudança definitiva provocada por uma decisão de confronto. Pode concluir a rodada, iniciar o Sorteio de rodada ou declarar a campeã da partida.
_Avoid_: Atualização da chave, avanço automático

**Desempate**:
Decisão aleatória e definitiva entre as duas músicas de um confronto quando o grupo não escolhe uma vencedora. A roleta apenas revela o resultado já registrado.
_Avoid_: Novo voto, voto aleatório, sorteio visual

**Modalidade de partida**:
Quantidade de músicas de uma partida, escolhida pelo jogador entre os tamanhos suportados pelo catálogo ativo do tema. Não é uma configuração do tema.
_Avoid_: Quantidade de rodadas do tema, chave padrão

**Entrada do tema**:
Vínculo editorial que apresenta uma música dentro de um Tema, com seus dados exibidos e trecho de reprodução.
_Avoid_: Música global, item da playlist, vídeo

**Entrada aprovada**:
Entrada do tema aceita pela curadoria para participar de partidas, desde que possua uma Fonte reproduzível disponível.
_Avoid_: Música ativa, vídeo válido

**Fonte reproduzível**:
Origem técnica capaz de tocar uma gravação, como um conteúdo específico de um provedor de vídeo ou áudio.
_Avoid_: Música, Faixa canônica, link

**Disponibilidade da fonte**:
Observação regional e temporal sobre a capacidade de uma Fonte reproduzível ser usada em uma partida.
_Avoid_: Ativo, incorporável, saúde da música

**Tema publicável**:
Tema em rascunho que satisfaz o mínimo de quatro Entradas aprovadas e jogáveis exigido para a primeira publicação.
_Avoid_: Tema publicado, Tema configurado, tema com chave padrão

**Tema publicado**:
Tema cuja oferta foi aprovada editorialmente; a publicação registra intenção e não garante visibilidade técnica.
_Avoid_: Tema ativo, Tema visível, Tema jogável

**Tema jogável**:
Tema com pelo menos quatro Entradas aprovadas cujas Fontes reproduzíveis contam como disponíveis pela política vigente.
_Avoid_: Tema publicado, Tema saudável

**Tema visível**:
Tema publicado e jogável que pode ser descoberto e usado para iniciar uma partida.
_Avoid_: Tema publicado, Tema ativo

**Tema degradado**:
Tema visível e ainda jogável que possui um aviso operacional, como fonte em tolerância ou perda de uma modalidade principal por falha de saúde.
_Avoid_: Tema suspenso, Tema quebrado

**Tema suspenso**:
Tema publicado temporariamente oculto por não possuir Entradas jogáveis suficientes; sua intenção editorial é preservada.
_Avoid_: Tema despublicado, Tema inativo, Tema degradado

**Metadados de origem**:
Dados fornecidos pelo provedor de música, como título original, canal, duração e
miniatura. Representam a fonte consultada e não são ajustes editoriais.
_Avoid_: Dados exibidos, nome da música

**Dados exibidos**:
Título e artista revisáveis que identificam uma música dentro de um tema e são
apresentados durante a partida. Podem partir dos metadados de origem sem ficar
presos à forma como o provedor os publicou.
_Avoid_: Metadados de origem, nome da música
