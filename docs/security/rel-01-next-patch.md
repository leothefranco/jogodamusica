# REL-01 — Patch de segurança do Next.js

Referência: issue #11. Base da implementação: `dcd99be46e2751a039556ebdc532d885933a9ee0`.
Validação local em 2026-09-07, Windows, Node `24.18.0`, npm `11.16.0`.
O commit que contém este documento identifica a árvore revisada; obtenha seu SHA com `git rev-parse HEAD`.

## Correção e escopo

Next.js e eslint-config-next passam de `16.3.0` para o pin exato `16.3.3`.
O [comunicado oficial de agosto de 2026](https://nextjs.org/blog/august-2026-security-release)
publicou o patch estável; a barreira de publicação da issue está resolvida.

- [GHSA-2xp9-vwfh-vxw4](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4): execução remota de código no processamento AVIF/libheif; o patch desabilita a otimização AVIF afetada.
- [GHSA-p293-qw3h-jr36](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36): execução remota de código na combinação Pages/App Router em Windows sem Cache Components; a linha 16.3 é corrigida em 16.3.3.

A remediação cobre a versão do framework mesmo quando o cenário específico de um advisory não está habilitado no app.
A documentação empacotada em `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md` foi lida após a instalação; o bloco de AGENTS.md continua apontando para os guias instalados.

O lockfile foi regenerado com npm 11.16.0 e revisado. Além dos dois pins, mudam apenas os pacotes internos Next/SWC e `@swc/helpers` de 0.5.15 para 0.5.23, dependência exata exigida pelo Next 16.3.3. React/React DOM 19.2.8 e PGlite 0.5.8 permanecem na árvore existente. Não há alteração de rotas, cache, CSP, esquema de banco ou APIs de produto.

## Proteção contra downgrade

`npm run security:check` lê manifesto, lockfile v3 e os package.json realmente instalados de Next.js e eslint-config-next. Exige pins idênticos, estáveis, da linha 16.3, com patch numérico >=3. Divergência ou ausência dos artefatos faz o comando falhar.

O gate executa antes de `npm run build`, inclusive no CI e no build padrão da hospedagem. `npm test` executa os testes do gate antes do Vitest. Não exige rede nem credenciais. A regra é um piso desta remediação, não um substituto para consultar novos advisories; outra minor/major requer revisão deliberada do gate.

Os testes executam a CLI em diretórios temporários e observam o código de saída. O ciclo red/green demonstrou falha ao aceitar 16.3.0, ao ignorar downgrade instalado e ao ignorar divergências de lock/ESLint, antes das respectivas correções. Há cobertura para 16.3.1/2, ranges, prerelease, versão fora da linha, patch malformado, artefato ausente e comparação numérica do patch.

## Evidências de validação

| Verificação                           | Resultado                                                                        |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| `npm ci` em worktree sem node_modules | Passou, 682 pacotes                                                              |
| `npm run test:security`               | 16 testes passaram                                                               |
| `npm test`                            | 16 testes de segurança e 419 Vitest em 54 arquivos passaram                      |
| `npm run lint`                        | Passou                                                                           |
| `npm run typecheck` (inclui typegen)  | Passou                                                                           |
| `npm run build` normal                | Passou, Next 16.3.3 e gate de instalação confirmado                              |
| Build com `E2E_TEST_MODE=1`           | Passou                                                                           |
| Playwright contra o build da fixture  | 33 testes passaram, Chromium, CI=1, porta 3121                                   |
| `npm run format:check`                | Passou após normalizar CRLF do checkout Windows para LF; sem mudança de conteúdo |
| `npm audit --omit=dev`                | Zero críticos; um alto residual em fast-uri                                      |

A auditoria consulta o registro no momento da execução; o relatório não está limpo de todos os alertas. O achado residual é fast-uri 3.1.5, com correção indicada em 3.1.6, associado aos advisories GHSA-5jgf-p345-68v8, GHSA-f65p-4m7j-42xc, GHSA-fph4-wmhf-6fwf e GHSA-jqff-g426-hqxp. `npm explain fast-uri` mostra ajv/ajv-formats, incluindo dependências opcionais pares de @hookform/resolvers e ferramentas shadcn. Não foi classificado como inofensivo nem removido com atualização ampla; sua remediação deve ser tratada separadamente. O achado crítico do Next.js não aparece no audit desta árvore.

Os testes locais usam fixtures e PGlite, sem segredos reais de banco, Supabase ou YouTube. Cobrem contratos públicos, autorização administrativa, integração YouTube, criação de tema com capa, início de partida e resultado. Isso não comprova autenticação ou disponibilidade dos provedores externos em produção.

## QA e promoção

O patch ainda não foi promovido. Antes de promover manualmente o commit validado, conferir Preview/QA e o artefato staged: mesma versão instalada, checks verdes e revisão independente do SHA exato. Não promover com vulnerabilidade crítica conhecida.

A verificação operacional do ambiente publicado encontrou o Supabase recuperado (ACTIVE_HEALTHY), home e GET /api/themes com três temas. O banco real ainda registra somente migrations 0000–0007; 0008–0010 e as tabelas theme_cover_claims/source_availability estão pendentes. Regularizar esse estado pelo fluxo de migrations antes de declarar QA administrativo completo. Esta correção não aplica migrations nem altera dados de produção.

## Recuperação segura

Em regressão, interromper a promoção e fazer forward-fix no patch corrigido. Um rollback só pode apontar para outro artefato comprovadamente corrigido. Sem versão anterior segura, manter staged/interrompido ou desativar a superfície afetada; nunca restaurar Next 16.3.0 ou outra versão vulnerável.
