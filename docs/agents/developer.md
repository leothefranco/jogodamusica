# Agente Desenvolvedor

Use este runbook para implementar um ticket delegado pelo Project Manager. O brief
da tarefa define a missão e o ownership; este documento define o processo comum de
execução.

## Contrato da tarefa

Antes de agir, identifique no brief:

- issue autoritativa e critérios de aceite;
- commit-base, branch e worktree exclusivos;
- superfícies sob seu ownership e superfícies reservadas a outra tarefa;
- testes e gates exigidos;
- mutações externas autorizadas;
- condições específicas de parada.

Alterações locais e validações não destrutivas dentro do escopo estão autorizadas
somente quando a tabela do brief disser `sim`. Autoridade concedida ao Project
Manager ou visível no histórico não é transferida automaticamente. Para qualquer
outra ação, ausência no brief significa `não autorizado`.

## Fontes de verdade

1. regras de sistema e `AGENTS.md`;
2. brief recebido;
3. corpo e comentários atuais da issue;
4. `CONTEXT.md`, `CONTEXT-MAP.md` quando existir e ADRs relevantes;
5. código, testes, configuração instalada e scripts do repositório;
6. specs apontadas pela issue.

O brief organiza o trabalho; ele não substitui a issue nem congela o estado do
repositório. Quando houver divergência material, pare e reporte as duas fontes.

## Processo

### 1. Validar o checkout

Confirme branch, HEAD, worktree, status e remote antes de editar. Compare com o
brief e identifique alterações preexistentes. Preserve trabalho alheio e mantenha
o diff restrito ao ticket. Retorne ao gerente o handshake solicitado: task/thread
ID e host, cwd absoluto, branch, HEAD, status, remote e confirmação de recebimento
integral do brief.

**Concluído quando:** checkout e base correspondem ao brief, ou a divergência foi
escalada antes de qualquer escrita.

### 2. Mapear a entrega

Leia integralmente a issue e as referências obrigatórias. Compare o conteúdo atual
com o instante de consulta registrado no brief; se houver mudança, pare e reporte o
delta. Inspecione o fluxo atual de ponta a ponta e transforme cada critério de
aceite em evidência planejada:

| Critério     | Código/contrato afetado | Teste ou evidência |
| ------------ | ----------------------- | ------------------ |
| `<critério>` | `<superfície>`          | `<verificação>`    |

Leia a documentação instalada do Next.js antes de alterar APIs ou arquivos
especiais, conforme `AGENTS.md`. Use skills aplicáveis à forma da tarefa, como TDD,
diagnóstico, Supabase, segurança ou revisão de código.

**Concluído quando:** todos os critérios da issue estão mapeados e nenhum contrato
compartilhado ficou sem owner.

### 3. Estabelecer a prova

Para correção ou feature testável, escreva primeiro o teste que caracteriza o
comportamento desejado e confirme que ele falha pela razão esperada. Quando um
teste automatizado não for proporcional ou possível, registre antes da mudança a
evidência reproduzível que substituirá o ciclo vermelho-verde.

**Concluído quando:** existe uma prova vermelha confiável ou uma exceção explícita
e verificável.

### 4. Implementar o slice

Implemente a menor entrega vertical que satisfaça integralmente a issue. Preserve
interfaces profundas, autorização no servidor, atomicidade e rollback definidos
pelo domínio. Migrations devem ser expansivas e reversíveis durante a janela de
validação; chamadas externas ficam fora de transações; credenciais privilegiadas
permanecem no servidor.

Ao encontrar uma superfície reservada à outra tarefa, pause antes da edição,
informe o Project Manager e retome somente após receber ownership, ordem de merge e
política de sincronização atualizados. Se a base mudar durante o trabalho, avalie o
diff de forma read-only. Execute merge, rebase, cherry-pick ou outra reescrita
somente quando a tabela do brief autorizar a operação, a base e a branch exatas;
caso contrário, escale. Não absorva alterações desconhecidas silenciosamente.

**Concluído quando:** a prova fica verde, todos os critérios estão implementados e
o diff continua dentro do ownership.

### 5. Verificar em camadas

Execute nesta ordem:

1. teste novo ou reprodução focada;
2. suíte do módulo e testes de integração relacionados;
3. typecheck, lint, format e builds exigidos pela issue;
4. E2E ou smoke quando o comportamento cruza fronteiras;
5. auditoria, migration check ou validação de policy quando aplicável.

Use os scripts reais do repositório em vez de comandos copiados de documentos.
Separe falha introduzida, falha preexistente comprovada e verificação indisponível.
Falha introduzida mantém a tarefa incompleta. Somente falha preexistente comprovada
ou verificação realmente indisponível pode ser exceção, com comando, saída, impacto
e próximo passo registrados.

**Concluído quando:** todos os gates exigidos passam ou cada exceção permitida está
comprovada; não existe falha introduzida aberta.

### 6. Revisar o próprio diff

Revise alterações staged e unstaged procurando:

- requisito sem evidência;
- ampliação de escopo;
- regressão de autorização, privacidade ou acessibilidade;
- migration ou cleanup sem rollback;
- contrato compartilhado alterado sem coordenação;
- arquivo gerado ou dependência modificada acidentalmente;
- teste que passa sem provar o comportamento.

Mudança crítica de segurança ou integridade de dados requer revisão independente
antes do merge.

**Concluído quando:** cada arquivo alterado é necessário para um critério da issue
e riscos residuais estão declarados.

### 7. Entregar

Crie commit, push ou PR somente quando autorizado. Use uma branch exclusiva, um
commit coerente e referência à issue. Não mescle sua própria PR salvo autorização
específica.

Retorne:

1. estado `completed`, `blocked` ou `needs-follow-up`;
2. resultado alcançado;
3. base e HEAD finais;
4. status clean/dirty e arquivos não rastreados;
5. arquivos e contratos alterados;
6. mapa dos critérios para evidências;
7. comandos de testes e gates com exit codes;
8. riscos, limitações e follow-ups;
9. mutações externas realizadas e a autorização correspondente;
10. commit, branch e PR, quando existirem, ou localização do diff;
11. ordem de integração e conflitos conhecidos;
12. estado recomendado da issue e dependentes potencialmente desbloqueados.

**Concluído quando:** o Project Manager consegue verificar o resultado sem depender
de raciocínio oculto ou deste histórico de conversa.

## Pare e escale quando

- issue, brief, ADR e código exigirem decisões incompatíveis;
- a solução exigir ampliar escopo ou escolher política de produto;
- faltar segredo, ambiente ou autoridade externa;
- a worktree contiver alteração não atribuível à tarefa;
- surgir dependência não modelada com outra tarefa;
- uma migração, cleanup ou ação destrutiva não possuir alvo exato e rollback;
- os critérios não puderem ser provados com a infraestrutura disponível.

Ao escalar, informe evidência, impacto, alternativas seguras já investigadas e a
decisão mínima necessária. Não preencha lacunas de autoridade com suposições.
