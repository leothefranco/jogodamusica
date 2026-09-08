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
Quantidade de músicas de uma partida, escolhida entre os tamanhos suportados pelas Entradas jogáveis do Tema. As principais têm 32 ou 64 músicas; as rápidas têm 4, 8 ou 16; a estendida tem 128.
_Avoid_: Quantidade de rodadas do tema, chave padrão

**Tema publicável**:
Tema com pelo menos quatro Entradas jogáveis, mínimo necessário para sua publicação editorial. Uma queda posterior de saúde preserva a intenção de publicação.
_Avoid_: Tema configurado, tema com chave padrão

**Entrada de catálogo**:
Inclusão editorial de uma música em um Tema. Uma Entrada ativa participa da avaliação de saúde desse Tema.
_Avoid_: Vídeo publicado, música globalmente aprovada

**Entrada jogável**:
Entrada ativa com disponibilidade confirmada ainda fresca ou em tolerância. Uma Entrada desconhecida é potencial, mas não conta como jogável.
_Avoid_: Música ativa e incorporável, disponibilidade presumida

**Publicação editorial**:
Intenção explícita de manter um Tema em rascunho ou publicado, independente da saúde atual. Somente uma decisão editorial o devolve a rascunho.
_Avoid_: Saúde do Tema, visibilidade

**Visibilidade derivada**:
Condição visível ou oculta resultante da intenção editorial e da quantidade de Entradas jogáveis. Um Tema publicado com menos de quatro fica oculto até se recuperar.
_Avoid_: Despublicação automática, intenção editorial

**Estado operacional do Tema**:
Classificação exclusiva em rascunho editorial, saudável, degradado, suspenso por verificação pendente ou suspenso por Entradas saudáveis insuficientes. Avisos de tolerância, indisponibilidade ou desconhecimento distinguem degradação de saúde plena.
_Avoid_: Publicação, estado da Fonte

**Suspensão por verificação pendente**:
Tema publicado com menos de quatro Entradas jogáveis, mas pelo menos quatro potenciais ao incluir as desconhecidas.
_Avoid_: Insuficiência conhecida, despublicação

**Suspensão por Entradas saudáveis insuficientes**:
Tema publicado com menos de quatro Entradas potenciais, mesmo incluindo as desconhecidas.
_Avoid_: Verificação pendente, rascunho

**Metadados de origem**:
Dados fornecidos pelo provedor de música, como título original, canal, duração e
miniatura. Representam a fonte consultada e não são ajustes editoriais.
_Avoid_: Dados exibidos, nome da música

**Dados exibidos**:
Título e artista revisáveis que identificam uma música dentro de um tema e são
apresentados durante a partida. Podem partir dos metadados de origem sem ficar
presos à forma como o provedor os publicou.
_Avoid_: Metadados de origem, nome da música
