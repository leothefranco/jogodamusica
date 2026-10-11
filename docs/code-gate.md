# Gate de código (OPS-02)

Em checkout limpo, use o Node exato de `.nvmrc` e o npm exato de
`packageManager` em `package.json`, depois execute:

```sh
npm run gate
```

A política `.gitattributes` usa `* text=auto eol=lf`: checkouts novos mantêm
texto em LF em ambas as plataformas, preservando arquivos binários pela detecção
automática. Em checkout anterior à política, use uma worktree limpa do SHA
validado; não altere a configuração global do Git nem reformate o produto para
contornar uma divergência de checkout.

O bootstrap usa módulos nativos do Node e não precisa de `node_modules`.
O comando funciona no Windows e no Linux e não exige credenciais do produto.
Runtime divergente, árvore Git suja, `.env*` diferente de `.env.example`,
`.npmrc` local ou pacote resolvido fora do registry público impedem a execução.
Não passe credenciais; o ambiente dos processos é uma allowlist de infraestrutura,
com configurações npm de usuário/global vazias e registry público explícito.

## Ordem e falha

| Estágio       | Comando                                                             |
| ------------- | ------------------------------------------------------------------- |
| install       | `npm ci --no-audit --no-fund`                                       |
| format        | `npm run format:check`                                              |
| lint          | `npm run lint`                                                      |
| typegen       | `npm run typegen` (`next typegen`)                                  |
| typecheck     | `npm run typecheck:only` (`tsc --noEmit`)                           |
| test          | `npm test -- --maxWorkers=1` (Node e Vitest, descoberta automática) |
| build         | `npm run build`, sem fixture                                        |
| build-fixture | `npm run build`, com `E2E_TEST_MODE=1`                              |
| e2e           | Instalação de Chromium e `npm run test:e2e` contra `next start`     |
| audit         | `npm audit --omit=dev --audit-level=high --json`                    |

O build usa o Next oficial, incluindo a verificação de versão já existente.
`CI=true` força o Playwright a iniciar o bundle de produção da fixture e impede
reuso de servidor. A porta loopback é 3182; ocupação bloqueia a execução.
Os testes de navegador conservam configuração de projetos, workers e retries da
suíte. Reporter textual e trace desligado evitam publicar relatórios brutos;
isso não muda quais testes executam. A instalação de Chromium pertence ao
estágio e2e; no Linux inclui dependências do navegador no runner efêmero do CI.

O estágio de testes limita o Vitest a um worker em ambas as plataformas. Esse
orçamento conserva todas as suítes e seus testes de concorrência internos; não
altera assertions, timeout ou configuração compartilhada. Em Windows com 8 GB,
a execução inicial com orçamento automático falhou em hooks PGlite de 10 segundos;
o controle com um worker passou com os limites originais. A carga de outro trabalho
mudou entre essas tentativas, portanto essa comparação não isola a causa. Um único
controle posterior, na janela exclusiva, também falhou com orçamento automático,
com um hook excedido, saídas inesperadas de workers e erro nativo de falta de memória.
O gate completo com um worker passou no mesmo host. Esses resultados sustentam o
orçamento comum, sem atribuir toda a falha inicial exclusivamente aos workers.
O script `npm test` isolado continua disponível com suas opções de desenvolvimento.

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

A validação posterior ao `npm ci` registra `validation.result` e
`validation.reason` separadamente. Divergência do Next instalado, alteração do
checkout ou erro de leitura/parse mantém o estágio falho, mas conserva o exit
code original do processo e sua saída redigida no log da instalação.

Logs são capturados antes de qualquer publicação e redigem valores de ambiente,
URLs, e-mails, IPs, JWTs, UUIDs/capabilities e linhas de cookie, token, senha ou
segredo. O stdout da CLI contém somente progresso e classificações permitidas.
O CI publica apenas `evidence.json` e `.log` na raiz de cada execução. Diretórios
`.private` contêm cache npm, configuração vazia, navegador e temporários; saídas
privadas de Playwright ficam em `tmp/gate-private/test-results`. São descartáveis
e não entram no artefato ou no Git. Não publique esses diretórios, traces, HTML
de Playwright nem JSON bruto do audit.

## Rollout e equivalência

A comparação anterior à transição foi concluída no checkpoint
`95ccb5bff6def722b930e96cd4eddba090a07cd9`, árvore
`eb99c350c8adcadb11b3b1fe5ec7b48cf919c29f`. No CI Linux
[38176747894](https://github.com/leothefranco/jogodamusica/actions/runs/38176747894),
os jobs antigo e canônico passaram; o merge sintético do job antigo tinha a mesma
árvore. O Windows passou os dez estágios, com exit code zero e postflight aprovado,
em checkout novo LF sem dependências iniciais. Ambos executaram 50 testes Node,
569 Vitest em 69 arquivos e 143 Playwright, os dois builds e auditoria de produção
com todas as severidades zeradas, no Node 24.18.0/npm 11.16.0/Next 16.3.8.

Os comandos conservam descoberta automática, configurações e assertions das suítes.
O canônico explicita typegen antes de tipos, limita o Vitest a um worker, instala
Chromium no estágio E2E após o build fixture e acrescenta audit fail-closed.
Reporter textual e trace desligado não selecionam testes. A redação remove a linha
com o nome authorization do log canônico; a contagem final de 69 arquivos é
preservada. O reporter antigo não lista arquivos E2E: a comparação usa o mesmo
Git/configuração e os 143 resultados, além da lista descoberta pelo canônico.

O workflow agora mantém o nome obrigatório `Quality gate` e executa somente
`npm run gate`, com checkout do SHA literal da PR, `contents: read`, actions
fixadas por SHA e artefatos restritos ao schema e logs redigidos. A revisão e as
provas Windows/Linux do novo commit confirmam a transição antes da integração;
o checkpoint acima comprova equivalência, não substitui provas do novo objeto.
Essa integração não implica QA externo, acesso a produção ou promoção de release.

Rollback do runner precisa preservar instalação imutável, formatação, lint,
typegen antes de tipos, testes descobertos automaticamente, os dois builds,
Playwright, audit fail-closed e bloqueio de alta/crítica. Não remover checks para
contornar um resultado vermelho.

Os testes de contrato usam `runGate` e o adaptador de processo como seams,
conforme a issue #29: ordem literal, falha em cada estágio, preservação,
classificação do audit e sentinelas. A prova real usa todos os executáveis do
projeto; os doubles desses testes não são usados no comando canônico.
