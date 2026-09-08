# REL-01 — Patch crítico do Next.js

**Status:** blocked-external — aguarda patch oficial estável
**Depende de:** REL-02 e publicação do release oficial

## Problem Statement

Como operador, não posso promover com segurança a versão atual do Next.js. A
equipe do framework anunciou uma correção de severidade crítica para a linha 16.3,
mas o projeto ainda usa a versão anterior ao patch.

Atualizar antes de o release oficial existir exigiria adivinhar uma versão; promover
sem atualizar aceitaria um risco crítico conhecido. Ambos são incompatíveis com o
gate de release.

## Solution

Quando o comunicado oficial publicar a versão corrigida da linha suportada,
atualizar o Next.js e as dependências estritamente exigidas pelo advisory, fixar o
lockfile e executar integralmente os gates de produção.

O release permanecerá bloqueado até que a versão instalada seja explicitamente
listada como corrigida e todos os testes, builds e smokes passem.

## User Stories

1. Como jogador, quero usar uma versão corrigida do framework, para não ser exposto
   a uma vulnerabilidade crítica conhecida.
2. Como operador, quero aguardar a identificação oficial da versão corrigida, para
   não escolher uma versão por suposição.
3. Como operador, quero que o release seja bloqueado enquanto o patch não estiver
   instalado, para que calendário não prevaleça sobre segurança.
4. Como desenvolvedor, quero atualizar dentro da linha suportada, para reduzir
   mudanças não relacionadas.
5. Como desenvolvedor, quero ler a documentação empacotada da nova versão, para
   respeitar mudanças e deprecações atuais.
6. Como revisor, quero ver a alteração do lockfile, para saber exatamente quais
   pacotes mudaram.
7. Como revisor, quero distinguir dependências exigidas pelo patch de upgrades
   oportunistas, para manter o diff auditável.
8. Como responsável por segurança, quero confirmar a versão contra o advisory
   oficial, para registrar evidência de remediação.
9. Como responsável por segurança, quero um audit de dependências de produção,
   para encontrar achados adicionais após a atualização.
10. Como mantenedor, quero executar testes unitários, integração, build e E2E, para
    detectar regressões do framework.
11. Como mantenedor, quero um smoke de home, admin, partida, manifest e resultado,
    para validar os principais contratos de runtime.
12. Como operador, quero registrar a versão no artefato de release, para permitir
    auditoria posterior.
13. Como operador, quero um rollback funcional preparado, para reagir a regressão
    sem improviso.
14. Como responsável por segurança, quero que rollback não reintroduza uma versão
    vulnerável em produção, para não trocar estabilidade por exposição crítica.
15. Como mantenedor, quero que o CI continue verificando a linha corrigida, para
    evitar downgrade acidental.

## Implementation Decisions

- A fonte de verdade será o advisory/comunicado oficial do Next.js.
- A atualização usará a versão estável corrigida da linha 16.3, ou a versão exata
  indicada pelo advisory para projetos nessa linha.
- Versões canary, forks e patches não oficiais não serão usados.
- React e React DOM só mudarão se a matriz oficial do patch exigir.
- Upgrades funcionais não relacionados serão tickets separados.
- O lockfile será regenerado com o gerenciador e versão declarados pelo projeto.
- A documentação local empacotada da versão atualizada será lida antes de adaptar
  código.
- O quality gate completo incluirá format, lint, typegen/typecheck, testes, build,
  fixture E2E, Playwright e audit de produção.
- O smoke verificará home, manifests, autenticação administrativa, integração
  administrativa do YouTube, criação de tema com capa, início de partida e
  resultado.
- A evidência de release registrará versão anterior, versão corrigida, commit,
  advisory e resultado dos gates, sem copiar segredos.
- Uma regressão funcional bloqueia a promoção; ela não autoriza publicar a versão
  vulnerável.
- Se o patch exigir mudança incompatível, a adaptação será mínima e documentada
  dentro desta spec; refatorações adicionais permanecem fora.

## Testing Decisions

- O seam principal é o quality gate sobre a instalação limpa do lockfile.
- Um check automatizado compara a versão instalada com a versão mínima corrigida
  declarada pelo advisory.
- O build real valida Server Components, Server Actions, rotas e assets com a nova
  versão.
- Os tracer tests público e administrativo observam comportamento externo, não
  detalhes internos do framework.
- O audit de produção é executado após a atualização e seu resultado fica associado
  ao commit.
- Um teste negativo ou check do gate rejeita a versão anterior e qualquer
  downgrade abaixo da versão corrigida.
- Os testes de REL-02 precisam estar verdes antes de atribuir uma falha ao patch.
- O workflow atual de CI e o checklist de produção são o prior art.

## Out of Scope

- Atualizar para uma nova major.
- Adotar APIs novas do framework sem necessidade do patch.
- Refatorar cache, imagens, CSP ou arquitetura de rotas.
- Resolver vulnerabilidades apenas de desenvolvimento que não bloqueiem o limiar
  acordado, salvo exigência do advisory.
- Alterar infraestrutura de hospedagem.
- Definir uma data de promoção.

## Further Notes

- Referência primária: https://nextjs.org/blog
- A execução não começa com um número de versão presumido. O agente deve primeiro
  confirmar a publicação oficial e a versão corrigida.
- Rollout: validar em branch isolada, Preview/QA e deployment staged antes de
  promoção manual.
- Rollback: reverter o deployment se houver regressão, mas não promover novamente
  um build vulnerável. Manter o serviço staged/interrompido até uma correção
  compatível é preferível a restaurar a exposição crítica.
