# REL-02 — Contrato válido dos arquivos especiais do Next.js

**Status:** ready-for-agent
**Depende de:** nenhuma

## Problem Statement

Como mantenedor, não consigo produzir o bundle atual. O código compila, os testes
e o typecheck isolado passam, mas o typecheck gerado pelo Next.js rejeita exports
auxiliares em seis arquivos especiais de rota. Esses arquivos misturam a API
reservada do framework com factories criadas para teste.

Isso bloqueia qualquer release e impede validar com confiança o patch de segurança
do framework.

## Solution

Mover builders de manifest e factories de handlers HTTP para módulos comuns,
mantendo os arquivos especiais do Next.js como adapters mínimos. Eles exportarão
somente métodos HTTP e configurações reconhecidas pelo framework.

Os testes continuarão exercitando as factories nos módulos comuns, enquanto
typegen e build de produção validarão o contrato dos arquivos especiais.

## User Stories

1. Como desenvolvedor, quero que o build de produção passe, para poder validar um
   release real.
2. Como desenvolvedor, quero manter injeção de dependências nos handlers, para
   testar sem acessar YouTube, banco ou relógio reais.
3. Como desenvolvedor, quero que as factories vivam fora dos arquivos especiais,
   para que helpers de teste não façam parte da API de rota.
4. Como mantenedor do PWA, quero testar os manifests público e administrativo,
   para preservar nome, ícones, cores e escopo.
5. Como administrador, quero que busca, resolução, preview e importação do YouTube
   preservem o comportamento atual.
6. Como administrador, quero que autenticação, rate limit e erros das rotas não
   mudem durante a correção estrutural.
7. Como revisor, quero um diff mecânico e pequeno, para distinguir movimentação de
   código de alteração funcional.
8. Como revisor, quero que os testes importem módulos comuns, para não depender de
   uma convenção privada do Next.js.
9. Como operador, quero que typegen falhe no CI se um export inválido voltar, para
   não descobrir a regressão apenas no deploy.
10. Como operador, quero que o build da fixture E2E também passe, para não manter
    dois contratos de rota divergentes.
11. Como responsável por segurança, quero concluir esta correção antes do patch do
    Next.js, para que o patch possa ser validado integralmente.
12. Como mantenedor, quero que arquivos especiais permaneçam reconhecíveis como
    adapters, para reduzir a chance de nova mistura.
13. Como jogador, quero que manifests e APIs continuem respondendo igual, para que
    a correção não altere a experiência.
14. Como desenvolvedor, quero diagnóstico claro se outra convenção especial for
    violada, para corrigir a origem e não contornar o typecheck.

## Implementation Decisions

- Builders de manifest serão funções puras em um módulo comum de PWA.
- Factories de handlers administrativos serão módulos comuns do servidor,
  preservando as interfaces de dependência já usadas pelos testes.
- Arquivos especiais de rota importarão esses módulos e exportarão apenas métodos
  HTTP e opções de configuração aceitas pela versão instalada do Next.js.
- Nenhuma factory ou builder auxiliar será reexportada pelo arquivo especial.
- Os handlers de produção continuarão sendo construídos uma vez com as mesmas
  dependências atuais.
- A forma e os status das respostas HTTP não mudarão.
- Conteúdo, headers e escopo dos manifests não mudarão.
- Testes deixarão de importar helpers a partir do diretório de rotas.
- Esta correção deverá passar typegen e build real. A orquestração global e a ordem
  desses passos no gate pertencem a OPS-01.
- A correção abrangerá todos os arquivos especiais apontados pelo build, não apenas
  o primeiro erro.
- Não serão adicionadas exceções de tipo, casts ou configuração para esconder o
  erro.

## Testing Decisions

- O seam principal é o build real do Next.js, que deve concluir typegen,
  compilação e validação das rotas.
- O mesmo build será executado para o aplicativo normal e para a fixture de
  browser.
- Os testes unitários poderão observar o builder comum, mas o seam obrigatório dos
  manifests fará um GET HTTP ao endpoint gerado e verificará status, MIME, política
  de cache, escopo, ícones e corpo serializado.
- Os testes de handlers observarão autenticação, validação, rate limit e resposta
  HTTP nas factories comuns, com mocks somente nas fronteiras externas.
- Um teste de estrutura ou o typegen deve falhar se uma factory auxiliar voltar a
  ser exportada por um arquivo especial.
- Testes existentes de rotas administrativas do YouTube e de manifests são o
  prior art e devem ser preservados, alterando somente o ponto de importação.
- Não serão escritos testes que afirmem caminhos físicos internos; o contrato
  relevante é build válido e comportamento HTTP/manifest inalterado.

## Out of Scope

- Atualizar a versão do Next.js.
- Alterar conteúdo dos manifests.
- Redesenhar APIs administrativas.
- Refatorar serviços de YouTube ou regras de importação.
- Mudar rate limits, autenticação ou mensagens.
- Migrar para outro bundler.
- Corrigir warnings não relacionados.

## Further Notes

- O build com Webpack compilou o código em 24/08/2026 e falhou quando os tipos
  gerados validaram os exports especiais. O backend padrão local foi impedido por
  uma restrição do sandbox antes de chegar a essa validação.
- Rollout: correção estrutural em um único pull request, seguida por typegen,
  quality gate, builds e E2E.
- Rollback: como não há alteração de dados ou contrato HTTP, o commit pode ser
  revertido se qualquer resposta divergir; o release permanece bloqueado enquanto
  o build antigo estiver inválido.
