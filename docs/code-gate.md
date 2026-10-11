# Gate de código (OPS-02)

Em checkout limpo, use o Node exato de `.nvmrc` e o npm exato de
`packageManager` em `package.json`, depois execute:

```sh
npm run gate
```

O bootstrap usa módulos nativos do Node e não precisa de `node_modules`.
O comando funciona no Windows e no Linux e não exige credenciais do produto.
Runtime divergente, árvore Git suja, `.env*` diferente de `.env.example`,
`.npmrc` local ou pacote resolvido fora do registry público impedem a execução.
Não passe credenciais; o ambiente dos processos é uma allowlist de infraestrutura,
com configurações npm de usuário/global vazias e registry público explícito.

## Ordem e falha

| Estágio       | Comando                                                         |
| ------------- | --------------------------------------------------------------- |
| install       | `npm ci --no-audit --no-fund`                                   |
| format        | `npm run format:check`                                          |
| lint          | `npm run lint`                                                  |
| typegen       | `npm run typegen` (`next typegen`)                              |
| typecheck     | `npm run typecheck:only` (`tsc --noEmit`)                       |
| test          | `npm test` (Node e Vitest, descoberta automática)               |
| build         | `npm run build`, sem fixture                                    |
| build-fixture | `npm run build`, com `E2E_TEST_MODE=1`                          |
| e2e           | Instalação de Chromium e `npm run test:e2e` contra `next start` |
| audit         | `npm audit --omit=dev --audit-level=high --json`                |

O build usa o Next oficial, incluindo a verificação de versão já existente.
`CI=true` força o Playwright a iniciar o bundle de produção da fixture e impede
reuso de servidor. A porta loopback é 3182; ocupação bloqueia a execução.
Os testes de navegador conservam configuração de projetos, workers e retries da
suíte. Reporter textual e trace desligado evitam publicar relatórios brutos;
isso não muda quais testes executam. A instalação de Chromium pertence ao
estágio e2e; no Linux inclui dependências do navegador no runner efêmero do CI.

Uma falha interrompe os estágios dependentes, que ficam `not-run`, com exit code
nulo. As saídas e códigos anteriores são preservados. Timeout (20 minutos por
processo), interrupção ou limite de saída (32 MiB por processo) também bloqueiam.
O lockfile, manifesto, commit, árvore e status são conferidos após a instalação
e ao final; uma alteração impede resultado verde.

O audit aceita somente a versão 2 do relatório e contagens inteiras coerentes
por severidade. Alta e crítica bloqueiam, mesmo com exit code zero. JSON inválido,
erro do serviço, contagens incompletas ou saída incompatível bloqueiam como
`advisory-unavailable`. Não há waiver. O JSON bruto e detalhes dos advisories
nunca são publicados. Baixa/moderada são registradas; aceitação de risco de
release permanece no escopo OPS-05.

## Evidência e privacidade

Cada execução grava `tmp/gate/<execução>/evidence.json` e um `.log` por estágio
executado. O schema `jogodamusica/code-gate`, versão 1, contém commit, árvore,
runtime efetivo, Next exato, plataforma, timestamps, resultado e exit code do
gate; cada estágio contém identificador, resultado, exit code e duração. Audit
acrescenta classificação e contagens. Falhas de preflight retêm os dez estágios
como não executados, sem fabricar identidade validada.

Logs são capturados antes de qualquer publicação e redigem valores de ambiente,
URLs, e-mails, IPs, JWTs, UUIDs/capabilities e linhas de cookie, token, senha ou
segredo. O stdout da CLI contém somente progresso e classificações permitidas.
O CI publica apenas `evidence.json` e `.log` na raiz de cada execução. Diretórios
`.private` contêm cache npm, configuração vazia, navegador e temporários; saídas
privadas de Playwright ficam em `tmp/gate-private/test-results`. São descartáveis
e não entram no artefato ou no Git. Não publique esses diretórios, traces, HTML
de Playwright nem JSON bruto do audit.

## Rollout e equivalência

O primeiro checkpoint mantém `Quality gate` e adiciona o mesmo `npm run gate`
como job paralelo. O runner canônico faz checkout do SHA da PR para compará-lo
com a execução Windows. Antes de substituir o caminho antigo, compare ordem,
suítes descobertas, ambos os builds, resultados, árvore e falhas. O caminho
antigo usa o merge sintético; a composição deve ter a mesma árvore da branch
sincronizada com master e qualquer delta exige nova conferência.

O workflow usa `contents: read`, actions fixadas por SHA e nenhum segredo do
produto. A transição para fonte única do CI aguarda evidência Linux/Windows e
revisão independente. Não implica acesso a Preview/QA/produção ou promoção.

Rollback do runner precisa preservar instalação imutável, formatação, lint,
typegen antes de tipos, testes descobertos automaticamente, os dois builds,
Playwright, audit fail-closed e bloqueio de alta/crítica. Não remover checks para
contornar um resultado vermelho.

Os testes de contrato usam `runGate` e o adaptador de processo como seams,
conforme a issue #29: ordem literal, falha em cada estágio, preservação,
classificação do audit e sentinelas. A prova real usa todos os executáveis do
projeto; os doubles desses testes não são usados no comando canônico.
