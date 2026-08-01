# Guia de testes — Fase 2

Este guia valida a **Fase 2 — Administração de conteúdo** do Jogo da Música:
autenticação administrativa, CRUD de temas, integração com o YouTube, associação
de músicas, configuração de trechos e regras de publicação.

## Status

**QA manual pendente.** A bateria automatizada passou em 28 de julho de 2026,
mas os cenários que dependem de Supabase, YouTube e navegador ainda precisam ser
executados antes de considerar a Fase 2 aprovada ou realizar o deploy.

Execute os testes em um projeto Supabase de desenvolvimento. Não use dados ou
credenciais de produção.

## 1. Pré-requisitos

- Node.js 24 LTS e npm 11.
- Dependências instaladas com `npm install`.
- Projeto Supabase de desenvolvimento.
- Usuário criado manualmente no Supabase Auth.
- Perfil administrativo ativo correspondente ao usuário.
- YouTube Data API v3 habilitada.
- Chave da API restrita à YouTube Data API v3.

Crie `.env.local` a partir de `.env.example` e preencha:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=postgresql://...
YOUTUBE_API_KEY=sua-chave-de-desenvolvimento
SEED_ADMIN_USER_ID=uuid-do-usuario
SEED_ADMIN_DISPLAY_NAME=Administrador
```

Nunca versione `.env.local`.

Prepare o banco:

```powershell
npm run db:migrate
npm run db:seed
```

## 2. Bateria automatizada

Execute:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Resultado esperado:

- todos os comandos terminam com código de saída `0`;
- todos os testes atuais passam;
- o build lista as rotas administrativas e as duas rotas do YouTube;
- nenhum segredo aparece no terminal ou no bundle do cliente.

## 3. Iniciar o ambiente

```powershell
npm run dev
```

Abra:

- página pública: `http://localhost:3000`;
- login: `http://localhost:3000/admin/login`;
- painel: `http://localhost:3000/admin`.

Use as ferramentas de desenvolvedor do navegador para observar Console e
Network durante os testes.

## 4. Autenticação e autorização

### 4.1 Visitante

1. Abra uma janela anônima.
2. Acesse `/admin`.

Esperado:

- redirecionamento para `/admin/login`;
- nenhuma informação administrativa é exibida;
- nenhuma stack trace aparece.

### 4.2 Credenciais inválidas

1. Informe e-mail ou senha incorretos.
2. Envie o formulário.

Esperado:

- mensagem de erro em português;
- usuário permanece na tela de login;
- senha não aparece na URL, no console ou nos logs.

### 4.3 Administrador ativo

1. Entre com o usuário associado a um `admin_profiles` ativo.
2. Acesse `/admin/temas`.

Esperado:

- acesso autorizado;
- nome do administrador exibido;
- navegação para temas disponível.

### 4.4 Usuário sem perfil ou inativo

Use outro usuário de desenvolvimento sem perfil administrativo ou marque seu
perfil como inativo.

Esperado:

- acesso ao painel recusado;
- chamadas para `/api/admin/youtube/search` e
  `/api/admin/youtube/resolve` retornam `401`;
- resposta possui erro estruturado e não contém stack trace.

Restaure o perfil ativo antes de continuar.

## 5. CRUD de temas

### 5.1 Criar tema

1. Acesse `/admin/temas`.
2. Selecione **Novo tema**.
3. Preencha:
   - nome: `Teste Fase 2`;
   - slug: `teste-fase-2`;
   - descrição curta;
   - URL HTTPS de imagem;
   - tamanho padrão: `4`.
4. Salve.

Esperado:

- redirecionamento para o editor;
- tema criado como rascunho/inativo;
- dados persistem após recarregar a página.

### 5.2 Validações

Tente salvar, um caso por vez:

- nome vazio;
- slug com espaços ou letras maiúsculas;
- slug já existente;
- URL `javascript:alert(1)`;
- tamanho diferente de 4, 8, 16, 32, 64 ou 128, alterando a requisição no
  navegador.

Esperado:

- operação recusada;
- mensagem clara em português;
- erro associado ao campo quando aplicável;
- nenhum valor inválido é persistido.

### 5.3 Editar tema

Altere nome, descrição, imagem e tamanho padrão. Recarregue a página.

Esperado:

- valores atualizados;
- slug continua único;
- data de atualização do tema é alterada.

### 5.4 Excluir tema sem histórico

1. Crie um segundo tema descartável.
2. Use **Excluir** e confirme.

Esperado:

- tema removido;
- retorno à lista;
- cancelamento da confirmação não exclui nada.

O bloqueio de exclusão para temas com partidas relacionadas será exercitado de
forma completa quando a criação de partidas estiver disponível na Fase 3. Não
insira histórico falso em um banco compartilhado apenas para executar este caso.

## 6. Pesquisa e resolução do YouTube

### 6.1 Pesquisa

1. No editor do tema, pesquise por um artista ou música.
2. Observe a requisição
   `/api/admin/youtube/search?q=...`.

Esperado:

- somente vídeos são retornados;
- aparecem título, canal, duração e estado de incorporação;
- seleção do resultado mostra uma prévia visível;
- repetir rapidamente a consulta não gera erros;
- resposta não contém a chave da API.

### 6.2 URL ou ID

Teste:

- ID de 11 caracteres;
- URL `youtube.com/watch`;
- URL curta `youtu.be`;
- URL de Shorts;
- URL de incorporação.

Esperado:

- todas as formas válidas resolvem o mesmo vídeo;
- metadados são obtidos no servidor;
- URL de outro domínio ou ID inválido é recusado.

### 6.3 Falhas externas

Em um ambiente de desenvolvimento, teste temporariamente:

- `YOUTUBE_API_KEY` ausente;
- chave inválida;
- vídeo inexistente, privado ou sem permissão de incorporação;
- consulta com menos de dois caracteres.

Esperado:

- mensagem segura e compreensível;
- status HTTP apropriado;
- nenhuma stack trace ou chave é retornada.

Depois, restaure a chave correta e reinicie o servidor.

A entrada por URL/ID evita a operação de pesquisa, mas ainda depende da Data API
para validar metadados, duração e incorporação. Ela não funciona depois do
esgotamento completo da cota diária.

## 7. Associação e edição de músicas

Adicione ao tema ao menos cinco vídeos incorporáveis.

Para cada música, verifique:

- título e artista exibidos podem ser editados;
- metadados originais continuam identificados como fonte;
- início do trecho aceita zero ou valor positivo;
- duração começa preenchida com o tempo total da música;
- duração aceita qualquer inteiro positivo até o fim do vídeo;
- trecho não pode ultrapassar a duração total do vídeo;
- música pode ser ativada ou desativada;
- ordem aceita vazio ou inteiro não negativo;
- dados persistem após recarregar.

### Casos negativos

Tente:

- duração zero ou negativa;
- duração maior que o tempo total do vídeo;
- início negativo;
- trecho que termina depois do vídeo;
- título ou artista vazio;
- ordem negativa.

Esperado:

- operação recusada;
- associação anterior permanece intacta.

### Reutilização

1. Crie outro tema.
2. Adicione nele um vídeo já usado no primeiro tema.

Esperado:

- vídeo pode pertencer aos dois temas;
- título, artista, trecho e ativação são independentes por tema;
- atualizar metadados confiáveis não cria músicas duplicadas.

## 8. Regras de publicação

Use um tema de chave padrão 4.

### 8.1 Quantidade insuficiente

1. Deixe apenas três músicas ativas.
2. Tente publicar.

Esperado:

- botão desabilitado quando aplicável;
- servidor também recusa uma requisição manipulada;
- mensagem informa quantas músicas faltam.

### 8.2 Publicação válida

1. Ative quatro músicas.
2. Publique o tema.
3. Recarregue a página e volte à lista.

Esperado:

- tema aparece como publicado;
- estado persiste;
- painel indica que o tema possui músicas suficientes.

### 8.3 Preservar tema publicado

Com exatamente quatro músicas ativas, tente:

- desativar uma música;
- remover uma música ativa;
- reassociar uma música ativa marcando-a como inativa;
- aumentar o tamanho padrão para 8.

Esperado:

- todas as operações são recusadas;
- tema continua publicado com quatro músicas ativas.

Adicione uma quinta música ativa e repita uma única desativação.

Esperado:

- operação permitida;
- tema permanece publicado com quatro músicas ativas;
- uma segunda redução é recusada.

### 8.4 Concorrência

Este comportamento possui teste automatizado. Duas reduções simultâneas em um
tema publicado são serializadas por lock transacional: apenas uma pode ser
aceita se a segunda deixaria o tema abaixo do tamanho da chave.

## 9. Segurança no navegador

Abra DevTools, guia **Network**, selecione a resposta HTML e confira:

- `Content-Security-Policy`;
- `Permissions-Policy`;
- `Referrer-Policy`;
- `X-Content-Type-Options: nosniff`.

A CSP deve:

- permitir frames de `youtube-nocookie.com` e `youtube.com`;
- permitir conexão do servidor/cliente com os domínios necessários;
- bloquear objetos e enquadramento da aplicação por terceiros;
- não expor credenciais.

No Console, não devem existir violações de CSP causadas pelo fluxo normal.

## 10. Responsividade e acessibilidade

Teste pelo menos estas larguras:

- 360 px;
- 768 px;
- 1280 px.

Verifique:

- nenhuma rolagem horizontal indevida;
- botões principais com área de toque confortável;
- foco visível ao navegar com `Tab`;
- formulários utilizáveis somente com teclado;
- labels associados aos campos;
- mensagens de sucesso e erro anunciadas;
- estados não dependem apenas de cor;
- iframe possui título descritivo;
- contraste permanece legível.

## 11. Registro do resultado

Para cada caso, registre:

| Campo       | Conteúdo                           |
| ----------- | ---------------------------------- |
| Data e hora | Momento do teste                   |
| Ambiente    | Navegador, sistema e URL           |
| Caso        | Seção e cenário deste guia         |
| Resultado   | Passou ou falhou                   |
| Evidência   | Captura, resposta HTTP ou mensagem |
| Observações | Passos adicionais para reproduzir  |

Considere a Fase 2 aprovada quando:

- toda a bateria automatizada passar;
- os fluxos manuais principais passarem;
- não houver erro no Console durante o uso normal;
- nenhuma credencial for exposta;
- todos os defeitos encontrados estiverem corrigidos ou registrados como issue
  com impacto e passos de reprodução.

## 12. Limpeza

Ao terminar:

1. exclua apenas os temas descartáveis sem histórico;
2. preserve um tema de demonstração útil;
3. restaure perfis administrativos alterados durante o teste;
4. restaure `YOUTUBE_API_KEY` e demais variáveis;
5. encerre `npm run dev` com `Ctrl+C`.
