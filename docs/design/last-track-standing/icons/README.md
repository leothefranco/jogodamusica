# Ícones para Last Track Standing — identidade C / Encore

O usuário preferiu a identidade C, mas considerou o ícone atual melhor que a coroa do mockup. Este estudo explora seis alternativas, preservando o original como referência.

Abra `index.html` para selecionar um ícone, alternar entre cores Encore, verde e monocromático, conferir a aplicação no cabeçalho e observar tamanhos reais. `comparison.png` e `comparison.jpg` apresentam as seis opções lado a lado.

| Opção | Nome              | Ideia                                              |
| ----- | ----------------- | -------------------------------------------------- |
| 01    | Original elétrico | Geometria atual integralmente em verde             |
| 02    | Original Encore   | Laterais azul/laranja e centro verde               |
| 03    | Pulso             | Colchetes abertos e onda musical assimétrica       |
| 04    | Última faixa      | Uma faixa verde mais alta que as demais            |
| 05    | Vinil             | Disco central envolvido por dois lados             |
| 06    | Chave final       | Caminhos do chaveamento convergindo para uma faixa |

As opções são SVGs nativos, seguindo a linguagem vetorial de `src/lib/brand.ts` e `src/app/icon.svg`. Não foi usada geração raster para desenhar esses ícones. O arquivo original não foi modificado. A escolha confirmada é **01 / Original elétrico**: [ícone com fundo](./svg/icon-01.svg) e [marca transparente](./svg/mark-01.svg). A imagem application-02.png é uma alternativa histórica, não a opção aprovada.

## Entregáveis

- `svg/icon-NN.svg`: ícone colorido com fundo escuro arredondado.
- `svg/mark-NN.svg`: marca sem fundo.
- Sufixos `-lime` e `-white`: versões em uma cor, com e sem fundo.
- `svg/original.svg`: referência do ícone atual.
- `png/`: ícones coloridos a 16, 32, 64, 128 e 512 px; versões de uma cor a 512 px.
- `application-02.png`: exemplo de uso da alternativa 02.
- `verification.json`: verificação de navegação, downloads e largura de tela.

O cabeçalho da galeria muda somente a prévia. O favicon, o ícone da PWA e a aplicação real permanecem intactos. A coroa dentro das artes raster do estudo anterior também permanece até escolhermos o símbolo que deverá substituí-la.

Roteiro visual: seis símbolos de leitura simples, sem coroa; referência atual ao lado; geometria comparada em um mesmo tamanho; cabeçalho com a marca Last Track Standing; teste visual em 16/32/64/128 px, fundo claro e uma cor. A tipografia e as cores de apoio seguem a identidade C.
