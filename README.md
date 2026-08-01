# Jogo da Música

Aplicação web para grupos compararem músicas em confrontos eliminatórios, usando
um único aparelho, até eleger uma campeã.

Este repositório concluiu a **Fase 5 — PWA, acessibilidade e robustez**. A base
Next.js, o modelo PostgreSQL/Drizzle, o acesso administrativo, o catálogo
flexível, o fluxo público de partidas e a experiência instalável estão
implementados. A próxima etapa planejada é a **Fase 6 — Qualidade e deploy**,
com Playwright, integração contínua e publicação, conforme a
[especificação](./jogo-da-musica-especificacao-codex.md).

## Requisitos no Windows

- Git
- Node.js 24 LTS (o projeto fixa `24.18.0` em `.nvmrc`)
- npm 11
- Visual Studio Code, recomendado
- Chrome ou Edge

Não é necessário instalar PostgreSQL local, Docker, Supabase CLI, Android Studio
ou ferramentas nativas de aplicativos.

## Instalação

No PowerShell:

```powershell
git clone <url-do-repositorio>
cd "Jogo da música"
Copy-Item .env.example .env.local
npm install
npm run dev
```

Acesse `http://localhost:3000`. Sem credenciais, a página pública e a tela
`/admin/login` funcionam, mas o formulário administrativo permanece
desabilitado. Nunca versione `.env.local`.

## Configurar o Supabase

1. Crie um projeto no [Supabase](https://supabase.com/dashboard) com o nome
   `Jogo da Música` e escolha a região sul-americana mais próxima disponível.
2. Guarde a senha do banco em um gerenciador de senhas.
3. Em **Project Settings > API**, copie a URL do projeto e a chave
   `publishable`.
4. Em **Project Settings > Database**, copie a URI do **Transaction Pooler**.
   Substitua o marcador de senha e aplique URL encoding se ela contiver
   caracteres especiais.
5. Preencha `.env.local`:

```env
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
NEXT_PUBLIC_SUPABASE_ANON_KEY=
DATABASE_URL=postgresql://...
YOUTUBE_API_KEY=
SEED_ADMIN_USER_ID=
SEED_ADMIN_DISPLAY_NAME=Administrador
```

6. Em **Authentication > Providers > Email**, desabilite inscrições públicas.
7. Em **Authentication > Users**, crie manualmente o primeiro usuário e copie
   seu UUID para `SEED_ADMIN_USER_ID`.
8. Execute:

```powershell
npm run db:migrate
npm run db:seed
```

O seed é idempotente: mantém um tema demonstrativo inativo e atualiza o perfil
administrativo informado sem criar ou armazenar senhas.

## Configurar YouTube Data API

1. Crie ou selecione um projeto no
   [Google Cloud Console](https://console.cloud.google.com/).
2. Em **APIs e serviços > Biblioteca**, ative **YouTube Data API v3**.
3. Em **APIs e serviços > Credenciais**, crie uma chave de API.
4. Restrinja a chave à **YouTube Data API v3**. Para desenvolvimento local,
   mantenha a restrição de aplicativo compatível com chamadas do servidor;
   antes do deploy, restrinja-a aos ambientes de produção suportados.
5. Salve a chave somente em `.env.local`:

```env
YOUTUBE_API_KEY=sua-chave-local
YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS=200
```

6. Reinicie `npm run dev` depois de alterar a variável.

A pesquisa administrativa é limitada, usa região `BR`, consulta detalhes em
lote e mantém cache curto no servidor. A busca consome cota do Google; a entrada
por URL ou ID continua disponível para evitar pesquisas desnecessárias. A cota
e os limites devem ser acompanhados no Google Cloud. A resolução direta evita a
operação de pesquisa, mas ainda consulta a Data API para validar metadados,
duração e permissão de incorporação; portanto, não funciona depois que a cota
diária estiver completamente esgotada.

## Fluxo administrativo

1. Acesse `/admin/login` e autentique-se com um perfil ativo.
2. Em `/admin/temas`, crie um tema inicialmente inativo.
3. Pesquise no YouTube ou cole uma URL/ID e visualize o vídeo antes de salvar.
4. Para importar em lote, use **Importar playlist**, informe uma URL/ID e revise
   a prévia antes de confirmar.
5. Revise título, artista, início e duração do trecho.
6. Ative ou desative músicas individualmente.
7. Confira as modalidades de 2 a 7 rodadas suportadas pelo catálogo.
8. Publique o tema quando houver pelo menos quatro músicas ativas e
   reproduzíveis.

Temas com partidas relacionadas não podem ser excluídos. Em temas publicados,
o painel também impede remover ou desativar músicas quando isso deixaria menos
de quatro opções reproduzíveis. A modalidade padrão foi removida do tema e do
banco pela migração mais recente.

## Fluxo público

1. Acesse `/` para ver os temas publicados.
2. Abra um tema e escolha explicitamente uma das modalidades compatíveis; nada
   vem pré-selecionado e o início permanece desabilitado até a escolha. A
   interface mostra a equivalência entre 2–7 rodadas e 4–128 músicas.
3. Inicie a partida. O servidor sorteia as músicas e a URL `/jogo/<id>` permite
   retomar o estado após recarregar a página.
4. Em cada confronto, inicie as duas músicas no player visível do YouTube. O
   voto só é liberado depois dessas duas ações e sempre pede confirmação.
5. Ao final, `/resultado/<id>` mostra a campeã e todos os confrontos.

O player usa a YouTube IFrame Player API diretamente no navegador, começa
somente após gesto explícito e pausa ao fim do trecho configurado. Erros da API
são registrados no servidor apenas com IDs técnicos da partida/confronto e o
código do YouTube, sem dados pessoais.

## Comandos

| Comando                | Finalidade                                     |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Inicia o ambiente de desenvolvimento           |
| `npm run build`        | Gera o build de produção                       |
| `npm run start`        | Executa o build de produção                    |
| `npm run lint`         | Executa o ESLint                               |
| `npm run typecheck`    | Verifica os tipos sem gerar arquivos           |
| `npm run format`       | Formata o projeto                              |
| `npm run format:check` | Confere a formatação                           |
| `npm test`             | Executa os testes unitários                    |
| `npm run test:watch`   | Executa Vitest em modo interativo              |
| `npm run test:e2e`     | Executa os testes Playwright                   |
| `npm run db:generate`  | Gera migrações Drizzle (a partir da Fase 1)    |
| `npm run db:migrate`   | Executa migrações Drizzle (a partir da Fase 1) |
| `npm run db:seed`      | Executa o seed (a partir da Fase 1)            |

## Variáveis de ambiente

| Variável                               | Exposição | Uso                               |
| -------------------------------------- | --------- | --------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | Pública   | URL canônica da aplicação         |
| `NEXT_PUBLIC_SUPABASE_URL`             | Pública   | URL do projeto Supabase           |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Pública   | Chave preferida em projetos novos |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Pública   | Compatibilidade com chave legada  |
| `DATABASE_URL`                         | Servidor  | Transaction Pooler PostgreSQL     |
| `YOUTUBE_API_KEY`                      | Servidor  | YouTube Data API, na Fase 2       |
| `YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS`    | Servidor  | Teto de posições por importação   |
| `SEED_ADMIN_USER_ID`                   | Servidor  | UUID do primeiro usuário Auth     |
| `SEED_ADMIN_DISPLAY_NAME`              | Servidor  | Nome exibido do administrador     |

Somente variáveis prefixadas com `NEXT_PUBLIC_` podem chegar ao navegador.

## Organização

```text
src/
├── app/          # Rotas e layouts do App Router
├── components/   # Componentes de jogo, admin, YouTube e shadcn/ui
├── db/           # Esquema, conexão, migrações e seed
├── domain/       # Regras puras de música e publicação
├── lib/          # Configuração e utilitários compartilhados
├── server/       # Auth, repositórios, serviços e provedores
└── types/        # Tipos compartilhados
tests/
├── unit/
└── e2e/
```

Server Components são o padrão. Componentes cliente serão usados apenas quando
uma interação do navegador exigir. Acesso ao banco e segredos permanecerão em
módulos exclusivos do servidor.

## Decisões técnicas

- Next.js 16.2 com App Router e TypeScript estrito.
- Tailwind CSS 4 e shadcn/ui com o preset estável `base-nova`.
- Interface escura, mobile-first, em português brasileiro.
- Fontes do sistema para evitar downloads durante o build.
- Vitest para testes unitários e Playwright preparado para E2E.
- npm e `package-lock.json` como fonte de versões reproduzíveis.
- PostgreSQL acessado apenas no servidor com `prepare: false`, compatível com o
  Transaction Pooler do Supabase.
- Sessões Supabase armazenadas em cookies e renovadas pelo `src/proxy.ts`.
- O Proxy faz somente a verificação preliminar; a autorização definitiva usa
  `getClaims()` e exige um registro ativo em `admin_profiles`.
- O domínio aceita os papéis `admin` e `editor`; o seed inicial usa `admin`.
- A integração musical depende da interface `MusicProvider`; somente
  `YouTubeProvider` está implementado.
- Busca e resolução do YouTube executam somente no servidor, com cache curto,
  limite por administrador e erros estruturados sem stack trace.
- Metadados de vídeos são resolvidos novamente no servidor ao salvar; campos
  ocultos do navegador não são tratados como fonte confiável.
- Título e artista exibidos pertencem à associação com o tema, permitindo
  personalizações independentes quando o mesmo vídeo é reutilizado.
- Publicação exige no mínimo quatro músicas ativas e reproduzíveis.
- Prévia de playlist percorre páginas e valida vídeos em lotes, com teto padrão
  de 200 posições, cache de 15 minutos e limite por administrador.
- Confirmação de playlist revalida dados confiáveis e grava associações em uma
  única transação, preservando ajustes existentes.
- Modalidades suportadas são derivadas da quantidade de músicas ativas.
- A criação de partida bloqueia o tema, sorteia sem repetição apenas a quantidade
  escolhida e persiste sessão, snapshots e todos os confrontos em uma transação.
- A decisão de confronto bloqueia a sessão e aceita voto em uma participante ou
  desempate sem vencedora enviada pelo cliente. No desempate, o servidor sorteia
  a vencedora; em ambos os casos, conclui o confronto ou a partida atomicamente.
- Ao concluir uma rodada, o servidor embaralha suas vencedoras, persiste a nova
  ordem e só então monta os confrontos da rodada seguinte.
- O domínio puro do torneio cria chaves de 4, 8, 16, 32, 64 e 128 músicas e converte entre
  quantidades de rodadas e tamanhos de chave sem persistir `roundCount`.
- A área pública usa Server Components para catálogo, detalhes e resultado; a
  interação da partida fica isolada em Client Components.
- O catálogo público conta somente associações ativas com vídeos incorporáveis
  e deriva as modalidades compatíveis sem duplicar a regra nos componentes.
- A partida mantém um único player YouTube visível, persiste decisões pelo Route
  Handler `/api/games/:sessionId/matches/:matchId/decision` e registra abandono
  de sessão de forma transacional.
- A PWA usa o manifesto nativo do App Router, ícones de 192 e 512 pixels e
  oferece instalação quando o navegador expõe essa capacidade.
- O service worker armazena somente o fallback offline e assets estáticos da
  mesma origem. Navegações, `/api`, `/admin`, respostas autenticadas e recursos
  do YouTube não são persistidos no cache.
- A interface inclui estados globais de carregamento, erro, conteúdo ausente e
  falta de conexão, além de foco visível, atalho para o conteúdo, regiões
  dinâmicas anunciáveis e respeito a `prefers-reduced-motion`.
- A política de segurança restringe origens de scripts, frames, conexões,
  workers e manifesto, bloqueia incorporação por terceiros e habilita HSTS.

### Validação da Fase 5

- Build de produção e rotas `/manifest.webmanifest`, `/sw.js` e `/offline`
  verificados localmente em navegador Chromium.
- Página inicial, escolha de tema e fallback offline verificados em 360 px, sem
  rolagem horizontal e com alvos interativos de pelo menos 44 px.
- Registro, instalação e retomada devem ser repetidos em Chrome/Edge desktop e
  Android durante o teste externo. Safari iOS não estava disponível no ambiente
  Windows desta fase e permanece na matriz manual.

## Limitações atuais

Sem Supabase configurado, migração, seed, login e CRUD reais permanecem
indisponíveis. Sem `YOUTUBE_API_KEY`, temas ainda podem ser editados, mas busca,
resolução e cadastro de vídeos ficam bloqueados com mensagem de configuração.
O fallback offline explica a indisponibilidade, mas não permite jogar sem
conexão: catálogo, estado da partida e reprodução do YouTube exigem internet.
Playlists privadas continuam fora do MVP porque exigem OAuth do Google. As
prévias ficam em cache de memória; em outra instância ou após expiração, a
confirmação revalida os vídeos no YouTube.

### Problemas comuns

- **Login desabilitado:** confira URL e chave publishable em `.env.local` e
  reinicie `npm run dev`.
- **Usuário autenticado sem acesso:** confira se o UUID foi aplicado em
  `admin_profiles` por `npm run db:seed`.
- **Falha no pooler:** confirme a URI do Transaction Pooler, a senha codificada
  na URL e a opção IPv4 recomendada pelo painel.
- **Alterou o esquema:** execute `npm run db:generate`, revise o SQL gerado e
  depois rode `npm run db:migrate`.
- **YouTube não configurado:** confira `YOUTUBE_API_KEY`, a ativação da YouTube
  Data API v3, as restrições da credencial e reinicie o servidor.
- **Cota do YouTube excedida:** evite repetir pesquisas, acompanhe o consumo no
  Google Cloud e tente novamente após a renovação da cota.
- **Tema não publica:** confirme se existem pelo menos quatro músicas ativas e
  reproduzíveis.

Em 26 de julho de 2026, `npm audit --omit=dev` também sinaliza avisos upstream
em `postcss` e `sharp`, incluídos pelo Next.js 16.2.11. A correção automática
oferecida exige downgrade incompatível para Next.js 9 e, por isso, não foi
aplicada. Atualize para uma versão estável corrigida do Next.js assim que ela
estiver disponível e repita a bateria de qualidade.
