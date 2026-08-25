# AST-01 — Capa persistida na criação do tema

**Status:** ready-for-agent
**Depende de:** nenhuma

## Problem Statement

Como administrador, envio uma capa ao criar um Tema e recebo um fluxo aparentemente
bem-sucedido, mas o Tema é persistido sem a imagem. O upload ocorre antes da Server
Action e a action de criação descarta a referência recebida. O objeto permanece no
Storage sem dono.

Além da perda funcional, o servidor recebe hoje uma URL pública produzida no
navegador, sem um contrato explícito que prove bucket, caminho, autoria ou
existência do objeto. Uma falha posterior à transferência também pode acumular
objetos sem referência.

## Solution

Manter, na Fase 0, a ordem simples já compatível com o formulário — validar o
arquivo no cliente, fazer upload e só então submeter a criação —, mas trocar a URL
livre por uma Referência de capa gerenciada. Essa referência contém apenas o
bucket fixo e a chave do objeto criado no prefixo do administrador autenticado.

A Server Action autenticará novamente o administrador, validará os campos do Tema
e a Referência de capa, confirmará o objeto pela API oficial do Storage, derivará
a URL pública canônica no servidor e criará o Tema já com `cover_url` na mesma
transação de banco. Não haverá schema novo de assets nesta fase.

Quando uma falha controlada ocorrer depois de o servidor aceitar a referência e
antes de criar o Tema, o servidor tentará apagar o objeto. Uma queda de rede ou
fechamento do navegador antes de a action ser recebida não pode ser compensada
atomicamente entre navegador, Storage e banco; o prefixo autenticado e a chave
imutável tornam esse resíduo identificável para o reconciliador/GC da Fase 2.

## User Stories

1. Como administrador, quero criar um Tema com capa, para vê-lo com a identidade
   escolhida ao reabrir o editor.
2. Como administrador, quero que a mesma capa apareça na home e no detalhe público,
   para não existir diferença entre cadastro e publicação.
3. Como administrador, quero continuar criando Tema sem capa, para que a imagem
   permaneça opcional.
4. Como administrador, quero validar assinatura, MIME e tamanho antes do upload,
   para não transferir um arquivo sabidamente inválido.
5. Como administrador, quero ver estado de envio e impedir submissões concorrentes,
   para não criar uploads duplicados por clique repetido.
6. Como administrador, quero que uma falha de upload não crie o Tema, para poder
   corrigir o arquivo e tentar novamente com os mesmos campos.
7. Como administrador, quero que uma falha de validação do formulário preserve os
   valores editáveis, para corrigir o campo sem recomeçar o cadastro.
8. Como administrador, quero que um retry na mesma montagem reutilize a referência
   já enviada enquanto ela continuar válida, para não transferir o mesmo arquivo
   novamente.
9. Como administrador, quero que um retry após resposta perdida reconheça um Tema
   já criado com o mesmo slug, payload e objeto, para concluir sem duplicação.
10. Como administrador, quero que conflito real de slug continue sendo erro, para
    não converter por engano o cadastro em edição de outro Tema.
11. Como responsável por segurança, quero que URLs HTTP(S) arbitrárias sejam
    rejeitadas como capa gerenciada, para não confiar em um host escolhido no
    navegador.
12. Como responsável por segurança, quero que somente um administrador ativo
    associe objetos do próprio prefixo, para impedir associação cruzada.
13. Como responsável por segurança, quero que bucket, extensão e formato da chave
    sejam controlados pelo servidor, para reduzir a autoridade do campo oculto.
14. Como operador, quero que falha de validação, conflito ou persistência acione
    exclusão compensatória, para reduzir objetos órfãos em erros controlados.
15. Como operador, quero tratar objeto já ausente como compensação bem-sucedida,
    para tornar retry de limpeza idempotente.
16. Como operador, quero que falha da compensação seja registrada separadamente do
    erro original, para não esconder a causa do cadastro e ainda permitir GC.
17. Como operador, quero correlacionar upload, action e compensação sem registrar
    URL pública completa, conteúdo do arquivo ou credenciais.
18. Como revisor, quero um teste no seam formulário → upload → Server Action →
    persistência, para evitar falsa confiança em helpers isolados.
19. Como revisor, quero provar o comportamento com Storage e repositório
    substituíveis, para tornar sucesso, falha e retry determinísticos.
20. Como mantenedor, quero persistir a URL canônica no campo legado atual, para que
    rollback do código não faça capas novas desaparecerem.
21. Como mantenedor, quero adiar o modelo completo de assets, para corrigir o
    blocker sem introduzir uma migração difícil de reverter.
22. Como editor autenticado no modelo atual, quero manter as mesmas permissões de
    criação, para que AST-01 não antecipe a revisão de RBAC.
23. Como mantenedor, quero que o contrato novo de criação não altere preservar,
    substituir ou remover capa na edição existente, para não corrigir um fluxo
    introduzindo regressão no outro modo do formulário compartilhado.

## Implementation Decisions

- A Fase 0 preservará o fluxo upload-before-action. Criar o Tema antes do upload
  exigiria uma chave de idempotência distribuída e um estado de Tema parcial que
  não são necessários para corrigir o defeito atual.
- A validação local de assinatura, MIME permitido e limite de 5 MB continuará
  ocorrendo antes do upload. O bucket manterá os mesmos MIME e limite como segunda
  barreira.
- O upload criará um objeto imutável, sem overwrite, sob o prefixo do usuário
  autenticado, com identificador aleatório e extensão controlada.
- O cliente enviará uma Referência de capa gerenciada estruturada com bucket e
  object key. A URL pública calculada no cliente não será autoridade.
- A Referência de capa gerenciada e sua compensação serão um contrato exclusivo da
  criação nesta spec. O formulário/adaptador distinguirá explicitamente modo de
  criação e modo de edição; nenhum campo compartilhado mudará de significado de
  forma implícita.
- A edição continuará preservando, substituindo e removendo a capa pelo contrato
  vigente até o lifecycle da Fase 2. Helpers de upload poderão ter adapters
  distintos para criação e edição, em vez de mudar silenciosamente o retorno usado
  pelos dois fluxos.
- O componente manterá a Referência de capa em estado enquanto a submissão estiver
  pendente ou puder ser repetida na mesma montagem. Não iniciará novo upload por
  clique duplicado.
- A action exigirá o modelo de autorização atual: perfil administrativo ativo.
  Nesta fase, `admin` e `editor` continuam equivalentes para criação; permissões
  diferenciadas pertencem ao trabalho posterior de RBAC.
- O bucket será uma constante do servidor. A chave deverá pertencer exatamente ao
  prefixo do usuário autenticado, usar o formato emitido pelo uploader e terminar
  em uma extensão permitida.
- A existência e os metadados disponíveis do objeto serão consultados pela API
  oficial do Storage, nunca por acesso direto às tabelas internas do provedor.
- As policies de leitura de metadados e de exclusão necessárias a esse fluxo serão
  limitadas ao bucket, a administrador ativo e ao próprio prefixo. Uma policy não
  concederá acesso genérico aos objetos de outro administrador.
- O servidor derivará a URL pública canônica a partir de bucket e object key já
  validados e a passará ao serviço de criação do Tema.
- Campos do Tema e URL canônica serão persistidos juntos na transação existente de
  criação. Um Tema nunca será confirmado com uma referência de capa apenas parcial.
- A persistência continuará usando `cover_url`. Não será criada coluna, tabela ou
  dual-read de asset em AST-01; bucket/object key gerenciados ficam para a Fase 2.
- Se a action receber uma referência confiável e depois falhar em validação,
  regra de negócio ou banco, tentará excluir o objeto pela API oficial do Storage.
- Exclusão de objeto inexistente será sucesso idempotente. Falha de limpeza será
  reportada como evento próprio, preservando o erro original apresentado ao usuário.
- O retorno da action indicará se a referência foi consumida, compensada ou precisa
  ser descartada pelo cliente, para que um retry não reutilize objeto apagado.
- Se uma resposta de sucesso se perder e a mesma referência for reenviada, um
  conflito de slug só poderá ser tratado como conclusão idempotente quando o Tema
  existente possuir a mesma URL canônica e os mesmos campos normalizados. Qualquer
  divergência continuará sendo conflito.
- Uma interrupção anterior à chegada da action poderá deixar objeto sem referência.
  O caminho autenticado e imutável será evidência suficiente para o futuro GC; não
  será prometida atomicidade entre navegador, Storage e banco.
- Nenhuma URL externa será aceita como nova capa gerenciada. A compatibilidade de
  leitura das URLs legadas já persistidas continuará inalterada.

## Testing Decisions

- O seam principal será um workflow de aplicação com dependências injetáveis para
  autenticação, Storage e repositório. O adapter da Server Action passará o
  `FormData` real para esse workflow, em vez de concentrar a regra no componente.
- O teste de sucesso exercerá formulário → upload → action → criação e observará
  um único Tema com a URL canônica derivada do mesmo object key.
- O mesmo cenário reabrirá o Tema e consultará a projeção pública, provando que a
  capa persiste além do estado do navegador.
- Um teste sem arquivo provará que Tema sem capa continua válido e não acessa o
  Storage.
- Testes negativos cobrirão arquivo inválido, upload falho, bucket errado, prefixo
  de outro usuário, extensão inválida, objeto inexistente, administrador inativo e
  URL HTTP(S) arbitrária.
- Falhas de validação de Tema, conflito real de slug, regra de negócio e banco
  provarão que a compensação recebe exatamente o objeto enviado e que nenhum Tema
  parcial é persistido.
- Um teste de limpeza repetida provará que objeto ausente é sucesso; outro fará a
  limpeza falhar e verificará evento correlacionado sem URL, token ou conteúdo.
- Um teste de retry na mesma montagem provará que o upload não se repete.
- Um teste de resposta perdida reenviará a mesma referência e o mesmo payload,
  provando conclusão idempotente; uma divergência de payload continuará falhando.
- A fixture E2E administrativa será ampliada para autenticar um administrador e
  usar Storage/repositório determinísticos. Ela provará estados de envio, erro,
  retry e redirecionamento sem depender de credenciais reais.
- Uma matriz de não regressão do modo de edição provará: salvar sem novo arquivo
  preserva a URL atual; selecionar arquivo válido substitui a referência como hoje;
  marcar remoção persiste ausência de capa. Esses testes protegem comportamento
  existente, sem afirmar que o lifecycle antigo já limpa objetos substituídos.
- Um smoke controlado em Preview/QA usará Supabase real, objeto descartável e
  limpeza explícita. Esse smoke é evidência operacional, não substitui o CI
  determinístico.
- Testes existentes de validação do arquivo permanecem como complemento. O
  requisito de saída não poderá depender de uma integração “quando disponível”.

## Out of Scope

- Criar entidade ou colunas de asset gerenciado.
- Crop, ponto focal, reencodificação e múltiplas variantes.
- Migrar capas legadas.
- Redesenhar a substituição/remoção ou limpar a capa anterior; preservar o
  comportamento vigente da edição é requisito de não regressão.
- Limpar capa ao excluir Tema.
- Garbage collection periódico de todo o bucket.
- Garantir atomicidade em quedas antes de a Server Action ser recebida.
- Trocar o bucket público por entrega assinada.
- Migrar a renderização para `next/image`.
- Diferenciar permissões de `admin` e `editor`.
- Redesenhar o formulário além dos estados necessários de envio e recuperação.

## Further Notes

- O lifecycle completo permanece na Fase 2. AST-01 corrige a persistência na
  criação, compensa falhas observáveis e deixa resíduos externos identificáveis,
  sem antecipar o modelo definitivo de assets.
- Rollout: publicar primeiro as policies restritas e o workflow do servidor,
  ativar o novo payload estruturado no formulário e monitorar criação, conflito,
  compensação e falha de compensação.
- Rollback: a versão anterior continua lendo `cover_url`, inclusive para capas
  criadas pelo fluxo novo. As policies podem permanecer mais restritas; nenhum
  dado novo precisa ser revertido.
- Critério de saída: criar um Tema com capa persiste a URL canônica do objeto
  validado; falhas controladas não deixam Tema parcial e tentam compensação;
  interrupções fora da action não criam referência inválida no Tema e deixam um
  objeto rastreável para o lifecycle posterior.
