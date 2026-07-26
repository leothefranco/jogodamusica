# Jogo da Música

Aplicação web para grupos compararem músicas em confrontos eliminatórios, usando
um único aparelho, até eleger uma campeã.

Este repositório está na **Fase 1 — Banco e autenticação**. A base Next.js, o
modelo PostgreSQL/Drizzle e o acesso administrativo com Supabase SSR estão
implementados. A conexão real depende da configuração de um projeto Supabase.
YouTube, regras do torneio e PWA serão implementados nas fases seguintes da
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
| `SEED_ADMIN_USER_ID`                   | Servidor  | UUID do primeiro usuário Auth     |
| `SEED_ADMIN_DISPLAY_NAME`              | Servidor  | Nome exibido do administrador     |

Somente variáveis prefixadas com `NEXT_PUBLIC_` podem chegar ao navegador.

## Organização

```text
src/
├── app/          # Rotas e layouts do App Router
├── components/   # Componentes de jogo, admin, YouTube e shadcn/ui
├── db/           # Esquema, conexão e seed (Fase 1)
├── domain/       # Regras puras de negócio
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

## Limitações atuais

Sem um projeto Supabase configurado, migração, seed e login reais permanecem
pendentes. O painel ainda não possui CRUD de temas ou músicas. Também não há
partidas, reprodução do YouTube, manifest ou service worker.

### Problemas comuns

- **Login desabilitado:** confira URL e chave publishable em `.env.local` e
  reinicie `npm run dev`.
- **Usuário autenticado sem acesso:** confira se o UUID foi aplicado em
  `admin_profiles` por `npm run db:seed`.
- **Falha no pooler:** confirme a URI do Transaction Pooler, a senha codificada
  na URL e a opção IPv4 recomendada pelo painel.
- **Alterou o esquema:** execute `npm run db:generate`, revise o SQL gerado e
  depois rode `npm run db:migrate`.

Em 26 de julho de 2026, `npm audit --omit=dev` também sinaliza avisos upstream
em `postcss` e `sharp`, incluídos pelo Next.js 16.2.11. A correção automática
oferecida exige downgrade incompatível para Next.js 9 e, por isso, não foi
aplicada. Atualize para uma versão estável corrigida do Next.js assim que ela
estiver disponível e repita a bateria de qualidade.
