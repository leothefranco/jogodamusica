# OPS-01 — Gate de release e preflight operacional

**Status:** queued-for-integration
**Depende de:** REL-01, REL-02, AST-01, AST-02, tickets de CAT-01 e contrato mínimo de OBS-01

## Problem Statement

Como operador, não consigo demonstrar com um único processo reproduzível que um
commit está seguro para promoção. O typecheck isolado já passou enquanto o build
real do Next.js encontrou exports inválidos. As novas garantias de capa e catálogo
também atravessam browser, Server Actions, Storage e banco.

Um único comando não pode, contudo, misturar CI determinístico sem credenciais,
leitura de saúde de um ambiente real e smoke administrativo mutável. Sem fronteiras
explícitas, o gate ou depende de segredos em CI, ou dá falsa confiança com mocks em
uma verificação que se dizia operacional.

## Solution

Criar um protocolo de release em três camadas, todas vinculadas ao mesmo commit:

1. **gate determinístico de código:** executado localmente e no CI, sem credenciais
   reais e sem rede de produção;
2. **preflight do ambiente-alvo:** consulta somente leitura com credencial mínima,
   executada em Preview/QA e antes da promoção;
3. **smoke controlado:** jornada mutável somente em Preview/QA com dados
   descartáveis e limpeza explícita; produção recebe apenas smoke não destrutivo.

Uma matriz única classificará blockers e avisos. A promoção continuará manual e
orientada por critérios de saída, não por calendário.

## User Stories

1. Como operador, quero um comando canônico de gate de código, para não escolher
   checks diferentes a cada release.
2. Como operador, quero que toda evidência registre o commit candidato, para não
   promover artefato diferente do validado.
3. Como desenvolvedor, quero instalação determinística pelo lockfile, para reproduzir
   exatamente a árvore de dependências.
4. Como desenvolvedor, quero typegen antes do typecheck, para detectar contratos
   especiais gerados pelo Next.js.
5. Como desenvolvedor, quero o build real de produção obrigatório, para não trocar
   compilação do framework por TypeScript isolado.
6. Como desenvolvedor, quero construir a fixture E2E, para manter o contrato de
   browser alinhado ao aplicativo.
7. Como revisor, quero resultados separados de formatação, lint, tipos, testes,
   builds, E2E e audit, para localizar o blocker.
8. Como responsável por segurança, quero bloquear qualquer vulnerabilidade crítica
   conhecida sem possibilidade de waiver.
9. Como responsável por segurança, quero que risco alto exija exceção temporária e
   explícita, para não virar ignore permanente.
10. Como responsável por segurança, quero que CI não receba credencial real do
    banco, Storage, YouTube ou ambiente de produção.
11. Como administrador, quero que o gate prove criação de Tema com capa, para não
    repetir a perda de referência.
12. Como jogador, quero que o gate prove o fallback público de imagens, para não
    receber card quebrado.
13. Como jogador, quero que o gate prove o mínimo de quatro e os limiares de 32/64,
    para não oferecer modalidade impossível.
14. Como operador, quero um preflight somente leitura do ambiente-alvo, para saber
    se dados e migrations suportam o release sem alterá-los.
15. Como operador, quero ver Temas por estado e quantos suportam 32 e 64, para
    reconhecer regressão das experiências principais.
16. Como operador, quero comparar o suporte 32/64 com o último release comparável,
    para separar perda inesperada de mudança editorial consciente.
17. Como operador, quero que uma perda inexplicada bloqueie a promoção, para não
    degradar o catálogo silenciosamente.
18. Como editor, quero registrar uma redução editorial intencional como aviso
    reconhecido, para ela não parecer falha técnica.
19. Como operador, quero testar criação com capa apenas em dados descartáveis de QA,
    para não poluir produção.
20. Como operador, quero que o smoke limpe Tema, associações e objeto de Storage,
    para deixar o ambiente repetível.
21. Como operador, quero que falha de limpeza seja visível, para não declarar smoke
    verde com resíduos.
22. Como operador, quero diagnóstico sem segredos, títulos livres ou capabilities,
    para compartilhar evidência com segurança.
23. Como operador, quero que uma falha interrompa a promoção, mas preserve os logs
    dos passos já concluídos.
24. Como operador, quero rollback para uma versão conhecida como boa e ainda
    corrigida, para não trocar regressão funcional por vulnerabilidade crítica.
25. Como mantenedor, quero adicionar garantias futuras ao mesmo protocolo, para não
    criar checklists concorrentes.
26. Como responsável por produto, quero que métricas sem baseline madura sejam
    informativas, para não inventar metas de performance sem dados.

## Implementation Decisions

### Gate determinístico de código

- Haverá um comando canônico local/CI; scripts menores continuarão disponíveis para
  desenvolvimento.
- A sequência mínima será: instalação imutável pelo lockfile, formatação, lint,
  typegen, typecheck, testes unitários/de integração, build de produção, build da
  fixture, E2E e audit de dependências de produção.
- Typegen antecederá o typecheck. O build real continuará obrigatório e não poderá
  ser substituído por um bundler alternativo usado apenas para contornar o CI.
- O CI usará fixtures, adapters falsos e dados efêmeros. Não receberá credenciais
  reais de Supabase, YouTube nem do ambiente-alvo.
- REL-02, AST-01, AST-02 e os contratos executáveis de CAT-01 entrarão como testes
  obrigatórios nos seams definidos pelas próprias specs.
- Cada passo produzirá código de saída próprio e evidência estruturada com commit,
  runtime, versão exata do Next.js e duração, sem valores de ambiente.

### Matriz de bloqueio

- Vulnerabilidade crítica conhecida em dependência de produção sempre bloqueia.
  Não existe waiver, aceite temporário ou retorno para versão crítica vulnerável.
- Vulnerabilidade alta bloqueia por padrão. Exceção só pode valer para um único
  release e exige responsável, justificativa, alcance, mitigação e condição
  verificável de remoção.
- Falha de instalação, formato, lint, tipo, teste, build, E2E ou contrato de
  segurança bloqueia.
- Tema visível com menos de quatro candidatas ou modalidade oferecida sem quantidade
  suficiente bloqueia.
- Perda de suporte a 32/64 sem causa explicada bloqueia. Mudança editorial
  intencional e registrada aparece como aviso, não como regressão técnica.
- Métricas de produto e performance sem baseline amostral suficiente não terão
  limiar inventado; serão evidência informativa. Invariantes funcionais e de
  segurança continuam blockers desde o primeiro release.

### Preflight do ambiente-alvo

- O preflight será uma operação separada do CI, executada com identidade somente
  leitura e escopo mínimo no ambiente selecionado.
- Ele verificará versão/migrations compatíveis, capacidade de consulta e o read
  model de saúde sem executar upload, criação, alteração ou exclusão.
- O relatório conterá Temas publicados, visíveis, degradados e suspensos; cobertura
  e frescor de Fontes; quantidade de Temas que suportam 32 e 64; e delta contra a
  última evidência comparável.
- O relatório não imprimirá nomes de Tema, URLs, IDs de provedor, e-mail, IP, tokens,
  connection strings ou capability de partida.
- Credenciais serão fornecidas pelo ambiente de execução seguro e nunca copiadas
  para artefatos ou logs do gate.

### Smoke controlado e promoção

- Preview/QA possuirá uma fixture administrativa autenticada e namespaced para o
  commit. O smoke cobrirá home, login administrativo, criação com capa, fallback,
  Tema jogável, início de partida e resultado.
- Toda mutação do smoke usará dados descartáveis e registrará recursos criados. A
  limpeza será parte obrigatória do resultado, inclusive objeto de Storage.
- Produção não receberá criação/deleção de Tema para validar release. Seu smoke
  usará páginas e fixtures existentes, em modo não destrutivo, após preflight.
- Promoção será manual somente quando gate, preflight e smoke aplicáveis apontarem
  para o mesmo commit.
- Banco da Fase 0 usará mudanças expansivas. Rollback do código manterá os dados
  novos e usará leitura segura compatível.
- A última versão boa para rollback deverá conter o patch crítico oficial. Se não
  existir versão anterior segura, preferir forward-fix ou desativação da superfície
  afetada a restaurar uma versão vulnerável.

## Testing Decisions

- O seam do gate será a execução completa em checkout limpo, com lockfile e sem
  credenciais reais.
- Um teste de contrato confirmará a ordem typegen → typecheck e a presença
  obrigatória dos dois builds.
- Builds serão observados por processo/código de saída, sem mockar o Next.js.
- Uma matriz injetará falha em cada estágio e provará que a promoção não é marcada
  como liberada.
- O audit será testado com fixtures de vulnerabilidade crítica e alta: crítica
  nunca aceita exceção; alta exige todos os campos e vale somente para o release.
- Os tracer tests do CI cobrirão capa persistida, fallback após erro real, mudança
  multi-Tema, mínimo de quatro, 32/64, partida e resultado com adapters locais.
- O preflight será testado contra banco representativo com papel somente leitura;
  qualquer tentativa de mutação deverá falhar.
- Um teste de delta cobrirá perda inexplicada de 64→63 e 32→31, além de alteração
  editorial registrada.
- O smoke de Preview/QA provará criação e limpeza completa. Uma falha deliberada de
  cleanup impedirá resultado verde e deixará identificadores seguros para ação.
- Um teste de redaction varrerá evidências contra valores sentinela de segredos,
  e-mail, URL com senha, IDs proibidos e capabilities.
- O rollback será ensaiado com schema expandido e consulta segura, sem restaurar
  dependência vulnerável nem contar Fonte regionalmente indisponível.

## Out of Scope

- Definir a baseline e a retenção de métricas; isso pertence a OBS-01.
- Escolher ou contratar plataforma de observabilidade.
- Automatizar promoção para produção.
- Executar smoke mutável em produção.
- Corrigir os achados das specs dependentes dentro de OPS-01.
- Implementar CSP com nonce, MFA ou novo RBAC.
- Definir datas-alvo, SLA comercial ou janela fixa de release.
- Publicar issues automaticamente a partir do gate.

## Further Notes

- OPS-01 só fica `ready-for-agent` depois que as dependências executáveis estiverem
  decompostas e seus contratos de teste existirem. Até lá, é a spec de integração
  final da Fase 0.
- O build padrão local pode sofrer restrição de criação de processo no sandbox do
  Windows; isso não autoriza mascarar o backend escolhido em CI. O ambiente oficial
  precisa executar o build de produção real.
- Rollout: observar o novo protocolo em paralelo ao checklist vigente, comparar a
  evidência e só então torná-lo a fonte canônica.
- Rollback: restaurar apenas o orquestrador anterior, mantendo manualmente todos os
  checks, a proibição de vulnerabilidade crítica e o preflight seguro.
- Critério de saída: gate determinístico, preflight read-only e smoke controlado
  produzem evidência redigida do mesmo commit e a matriz impede qualquer blocker de
  alcançar promoção.
