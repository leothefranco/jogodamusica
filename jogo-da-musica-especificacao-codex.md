# Jogo da Música — Especificação funcional e técnica para implementação

**Documento de execução para Codex**  
**Versão:** 1.1
**Data:** 28 de julho de 2026
**Status:** Fases 0, 1, 2, 2.1 e 3 concluídas

---

## 1. Instrução principal para o Codex

Implemente uma aplicação web responsiva e instalável chamada **Jogo da Música**. O aplicativo deve permitir que um grupo, usando **um único aparelho**, escolha um tema e dispute eliminatórias entre duas músicas por rodada até descobrir a música campeã.

O projeto deve ser criado de forma incremental, seguindo as fases deste documento. Antes de encerrar cada fase, execute lint, verificação de tipos, testes aplicáveis e build. Não exponha segredos no cliente, não adicione funcionalidades fora do escopo e registre decisões técnicas relevantes no `README.md`.

## 2. Resumo das decisões aprovadas

- Produto inicial: PWA acessada pelo navegador e instalável na tela inicial.
- Participação: todos votam em um único aparelho compartilhado.
- Temas: lista fixa, criada e gerenciada por administradores.
- Catálogo do tema: pode conter mais músicas ativas do que uma partida utilizará.
- Formato da partida: o jogador escolhe entre 2 e 7 rodadas, equivalentes a chaves de 4, 8, 16, 32, 64 ou 128 músicas.
- Seleção da partida: sorteio sem repetição entre as músicas ativas; excedentes ficam fora daquela sessão.
- Provedor de mídia inicial: YouTube.
- Reprodução: YouTube IFrame Player API; sem download, extração ou hospedagem de áudio.
- Busca administrativa: YouTube Data API.
- Importação administrativa: playlist pública ou não listada do YouTube, com revisão antes de associar os vídeos ao tema.
- Front-end e backend: Next.js 16 com App Router e TypeScript.
- Interface: React, Tailwind CSS 4 e shadcn/ui.
- Banco: PostgreSQL hospedado no Supabase.
- ORM: Drizzle ORM.
- Autenticação: Supabase Auth, somente para administradores.
- Hospedagem: Vercel.
- Repositório: GitHub.
- Gerenciador de pacotes: npm.
- Ambiente recomendado: Node.js 24 LTS.

## 3. Objetivo do produto

Criar uma experiência social rápida, clara e divertida para grupos compararem músicas dentro de um tema. Em cada confronto, o grupo escuta um trecho de cada música e escolhe uma vencedora. O sistema conduz automaticamente o chaveamento até a final e apresenta a campeã e o histórico completo da disputa.

### 3.1 Público inicial

- Grupos de amigos e familiares.
- Festas, encontros e atividades informais.
- Usuários de celular, tablet ou computador.
- Público brasileiro; idioma inicial `pt-BR`.

### 3.2 Princípios do MVP

1. Um único fluxo principal, sem cadastro para jogadores.
2. Grandes áreas de toque e boa leitura à distância.
3. Nenhuma pesquisa no YouTube durante a partida.
4. Partida recuperável após atualização da página.
5. Administração simples e protegida.
6. Código preparado para outros provedores no futuro, sem implementá-los agora.

## 4. Escopo funcional do MVP

### 4.1 Área pública

- Página inicial com identidade do produto e lista de temas ativos.
- Página de detalhes do tema com descrição, quantidade de músicas e quantidades de rodadas disponíveis.
- Início de nova partida.
- Quantidades suportadas: 2, 3, 4, 5, 6 ou 7 rodadas, equivalentes respectivamente a 4, 8, 16, 32, 64 ou 128 músicas.
- Seleção aleatória de músicas ativas quando o tema tiver mais músicas que o tamanho escolhido.
- Músicas excedentes permanecem no tema e podem ser sorteadas em partidas futuras.
- Embaralhamento aleatório das posições iniciais.
- Tela de confronto com duas opções.
- Reprodução controlada de um trecho de cada música.
- Votação após ambas as músicas terem sido iniciadas ao menos uma vez.
- Confirmação antes de registrar o voto.
- Avanço automático da vencedora.
- Indicador de rodada e progresso.
- Retomada da partida por URL após recarregar a página.
- Resultado final com música campeã e chaveamento completo.
- Ações para jogar novamente com o mesmo tema ou voltar à página inicial.

### 4.2 Painel administrativo

- Login por e-mail e senha.
- Acesso apenas para usuários presentes na tabela de administradores.
- Criar, editar, ativar, desativar e excluir temas sem partidas relacionadas.
- Definir nome, slug, descrição e imagem.
- Pesquisar vídeos no YouTube.
- Cadastrar vídeo colando URL ou ID como alternativa à pesquisa.
- Importar em lote os vídeos de uma playlist pública ou não listada do YouTube.
- Exibir uma prévia da importação, permitindo desmarcar itens e informando duplicados, indisponíveis ou não incorporáveis.
- Visualizar o vídeo antes de salvar.
- Importar metadados básicos: título, canal, miniatura e duração.
- Editar título e artista exibidos no jogo.
- Definir o segundo inicial do trecho.
- Usar por padrão a música inteira, permitindo reduzir a duração do trecho.
- Ativar ou desativar uma música dentro de um tema.
- Reutilizar a mesma música em vários temas.
- Exigir pelo menos quatro músicas ativas e reproduzíveis antes de publicar um tema, sem impor limite máximo ao catálogo.

## 5. Regras da partida

### 5.1 Preparação

1. O jogador escolhe um tema ativo.
2. O sistema apresenta somente quantidades de rodadas compatíveis com a quantidade de músicas ativas.
3. A interface deve mostrar a equivalência de forma explícita: `2 rodadas · 4 músicas`, `3 rodadas · 8 músicas`, `4 rodadas · 16 músicas`, `5 rodadas · 32 músicas`, `6 rodadas · 64 músicas` ou `7 rodadas · 128 músicas`.
4. Nenhuma modalidade aparece pré-selecionada; o jogador precisa escolher uma opção explicitamente antes de iniciar.
5. Ao iniciar, o servidor cria uma sessão e sorteia, sem repetição, exatamente a quantidade de músicas exigida pela escolha.
6. Se o tema tiver músicas ativas excedentes, elas ficam fora somente daquela sessão e continuam elegíveis para partidas futuras.
7. As músicas selecionadas são embaralhadas e recebem sementes de 1 a N.
8. A sessão guarda uma cópia dos dados exibidos, para que edições administrativas futuras não alterem uma partida em andamento.

`roundCount` é um valor derivado de `bracketSize` por `log2(bracketSize)`. O contrato persistido e a API usam apenas `bracketSize`, evitando estados contraditórios.

### 5.2 Confronto

- A tela exibe dois cards: Música A e Música B.
- Deve existir apenas um player ativo por vez.
- O player do YouTube deve permanecer visível e respeitar o tamanho mínimo exigido pela plataforma.
- O botão `Ouvir música A` carrega o vídeo A no tempo configurado.
- O botão `Ouvir música B` carrega o vídeo B no tempo configurado.
- Ao atingir a duração configurada, o aplicativo pausa o player.
- Ao iniciar uma música, qualquer reprodução anterior deve parar.
- O voto fica desabilitado até que A e B tenham sido iniciadas.
- A escolha abre uma confirmação com título e artista.
- Depois da confirmação, o resultado é persistido e não pode ser desfeito no MVP.
- O servidor deve rejeitar votos duplicados ou em partidas concluídas.

### 5.3 Avanço no chaveamento

- O chaveamento é de eliminação simples.
- Cada partida com N músicas possui N - 1 confrontos.
- Quando uma rodada termina, suas vencedoras são embaralhadas e a ordem sorteada é persistida antes da criação dos confrontos seguintes.
- A final define `champion_song_id` e encerra a sessão.
- Todas as alterações críticas devem ocorrer em transação no banco.

### 5.4 Falhas de reprodução

Quando o player retornar erro, o aplicativo deve:

1. informar que o vídeo não pôde ser reproduzido;
2. permitir tentar novamente;
3. permitir ao usuário abandonar a sessão e retornar ao tema;
4. registrar o código de erro no servidor sem dados pessoais;
5. nunca escolher automaticamente uma vencedora.

## 6. Experiência e interface

### 6.1 Direção visual

- Tema visual escuro por padrão, com contraste alto.
- Aparência ligada a música e competição, sem copiar a identidade do UwUFUFU.
- Layout mobile-first.
- Botões principais grandes, com área mínima de toque de aproximadamente 44 px.
- Cards empilhados em celulares e lado a lado quando houver espaço.
- Animações discretas e compatíveis com `prefers-reduced-motion`.
- Textos em português brasileiro.

### 6.2 Tela de confronto sugerida

```text
[ Tema ]               [ Oitavas — confronto 2 de 8 ]

[ Música A ]           [ Música B ]
[ capa     ]           [ capa     ]
[ título   ]           [ título   ]
[ artista  ]           [ artista  ]
[ Ouvir A  ]           [ Ouvir B  ]

[ Player visível do YouTube — um vídeo por vez ]

[ Votar na Música A ]  [ Votar na Música B ]

[ progresso do chaveamento ]
```

### 6.3 Acessibilidade

- Navegação completa por teclado.
- Foco visível.
- Labels associados aos controles.
- Mensagens dinâmicas em regiões `aria-live` quando necessário.
- Não usar apenas cor para indicar estado.
- `alt` descritivo em imagens próprias; miniaturas decorativas podem ter `alt` vazio quando o texto adjacente já identifica a música.
- Títulos e hierarquia semântica corretos.
- Player com atributo `title` descritivo.

## 7. Arquitetura técnica

### 7.1 Visão geral

```text
Navegador / PWA
       |
       v
Next.js 16 — App Router
  |-- páginas e componentes React
  |-- Route Handlers
  |-- autenticação administrativa
  |-- serviços de domínio
  |-- integração com YouTube
       |
       +--> Supabase Auth
       +--> Supabase PostgreSQL via Drizzle
       +--> YouTube Data API
       +--> YouTube IFrame Player API
```

### 7.2 Decisões de arquitetura

- Um único repositório e um único projeto Next.js.
- TypeScript em modo estrito.
- Server Components como padrão; Client Components apenas onde houver interação de navegador.
- Route Handlers finos, chamando serviços de domínio.
- Acesso ao banco somente no servidor.
- Nenhuma credencial de banco ou chave do YouTube no bundle do navegador.
- Sem Redux, WebSocket, Redis, microsserviços ou backend Express separado.
- Sem acesso direto às tabelas pelo cliente.
- Separar a integração musical por interface `MusicProvider`.

### 7.3 Interface do provedor

```ts
export interface MusicProvider {
  search(query: string): Promise<ProviderSearchResult[]>;
  resolve(input: string): Promise<ResolvedProviderTrack>;
  getEmbedData(providerContentId: string): Promise<EmbedData>;
}
```

Implementar somente:

```text
MusicProvider
└── YouTubeProvider
```

O domínio não deve depender de tipos específicos do SDK do YouTube.

## 8. Stack e dependências

### 8.1 Base

- Node.js 24 LTS.
- npm.
- Next.js 16 com App Router.
- React fornecido pela versão compatível do Next.js.
- TypeScript.
- Tailwind CSS 4.
- shadcn/ui.

### 8.2 Dados e autenticação

- Supabase PostgreSQL.
- Supabase Auth.
- `@supabase/supabase-js`.
- `@supabase/ssr` para autenticação com cookies no Next.js.
- Drizzle ORM.
- `postgres` como driver.
- Drizzle Kit para migrações.
- Zod para validação.

### 8.3 Formulários e utilidades

- React Hook Form.
- `@hookform/resolvers`.
- `date-fns`, somente se datas formatadas forem necessárias.
- `clsx` e `tailwind-merge`, normalmente instalados pelo shadcn/ui.
- `lucide-react` para ícones.

### 8.4 Qualidade

- ESLint.
- Prettier.
- `prettier-plugin-tailwindcss`.
- Vitest para testes unitários.
- Playwright para testes de ponta a ponta.

### 8.5 Política de versões

- Fixar Node no arquivo `.nvmrc` e em `package.json`.
- Usar Next.js 16.
- Instalar versões estáveis compatíveis no momento da implementação.
- Manter `package-lock.json` versionado.
- Não usar versões `alpha`, `beta`, `canary` ou `rc`, salvo dependência transitiva exigida pelo próprio Next.js.

## 9. Estrutura de diretórios

```text
jogo-da-musica/
├── drizzle/
├── public/
│   ├── icons/
│   ├── sw.js
│   └── placeholders/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── tema/[slug]/page.tsx
│   │   │   ├── jogo/[sessionId]/page.tsx
│   │   │   └── resultado/[sessionId]/page.tsx
│   │   ├── admin/
│   │   │   ├── login/page.tsx
│   │   │   ├── page.tsx
│   │   │   ├── temas/page.tsx
│   │   │   ├── temas/novo/page.tsx
│   │   │   └── temas/[id]/page.tsx
│   │   ├── api/
│   │   │   ├── games/route.ts
│   │   │   ├── games/[sessionId]/route.ts
│   │   │   ├── games/[sessionId]/matches/[matchId]/decision/route.ts
│   │   │   └── admin/youtube/
│   │   │       ├── search/route.ts
│   │   │       ├── resolve/route.ts
│   │   │       └── playlists/preview/route.ts
│   │   ├── layout.tsx
│   │   ├── manifest.ts
│   │   └── globals.css
│   ├── components/
│   │   ├── game/
│   │   ├── admin/
│   │   ├── youtube/
│   │   └── ui/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── seed.ts
│   ├── lib/
│   │   ├── env.ts
│   │   ├── errors.ts
│   │   ├── utils.ts
│   │   └── supabase/
│   │       ├── client.ts
│   │       ├── server.ts
│   │       └── proxy.ts
│   ├── server/
│   │   ├── auth/
│   │   ├── repositories/
│   │   ├── services/
│   │   └── providers/
│   │       └── youtube/
│   ├── domain/
│   │   ├── bracket/
│   │   ├── game/
│   │   └── music/
│   └── types/
├── tests/
│   ├── unit/
│   └── e2e/
├── .env.example
├── .nvmrc
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── playwright.config.ts
├── README.md
└── vitest.config.ts
```

## 10. Modelo de dados

Usar UUIDs gerados no banco e datas com fuso em `timestamptz`.

### 10.1 `admin_profiles`

| Campo | Tipo | Regra |
|---|---|---|
| `user_id` | uuid | PK; corresponde ao usuário do Supabase Auth |
| `display_name` | varchar(120) | obrigatório |
| `role` | enum | `admin` ou `editor`; MVP pode usar apenas `admin` |
| `is_active` | boolean | padrão `true` |
| `created_at` | timestamptz | obrigatório |
| `updated_at` | timestamptz | obrigatório |

### 10.2 `themes`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar(120) | obrigatório |
| `slug` | varchar(140) | único |
| `description` | text | opcional |
| `cover_url` | text | opcional |
| `is_active` | boolean | padrão `false` |
| `created_at` | timestamptz | obrigatório |
| `updated_at` | timestamptz | obrigatório |

### 10.3 `songs`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `provider` | enum | inicialmente `youtube` |
| `provider_content_id` | varchar(64) | ID do vídeo |
| `source_title` | text | título original do YouTube |
| `source_channel` | text | canal original |
| `thumbnail_url` | text | miniatura |
| `duration_seconds` | integer | duração total |
| `is_embeddable` | boolean | precisa ser `true` |
| `created_at` | timestamptz | obrigatório |
| `updated_at` | timestamptz | obrigatório |

Restrição única em `(provider, provider_content_id)`.

### 10.4 `theme_songs`

| Campo | Tipo | Regra |
|---|---|---|
| `theme_id` | uuid | FK |
| `song_id` | uuid | FK |
| `title` | varchar(200) | nome exibido neste tema |
| `artist` | varchar(200) | artista exibido neste tema |
| `start_time_seconds` | integer | mínimo 0 |
| `preview_duration_seconds` | integer | positivo; padrão igual à duração total da música |
| `is_active` | boolean | padrão `true` |
| `display_order` | integer | opcional |
| `created_at` | timestamptz | obrigatório |
| `updated_at` | timestamptz | obrigatório |

PK composta em `(theme_id, song_id)`.

### 10.5 `game_sessions`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `theme_id` | uuid | FK |
| `bracket_size` | integer | 4, 8, 16, 32, 64 ou 128 |
| `status` | enum | `active`, `completed`, `abandoned` |
| `current_round` | integer | padrão 1 |
| `champion_song_id` | uuid | nullable |
| `started_at` | timestamptz | obrigatório |
| `completed_at` | timestamptz | nullable |
| `created_at` | timestamptz | obrigatório |
| `updated_at` | timestamptz | obrigatório |

### 10.6 `session_songs`

Guarda o snapshot da música na sessão.

| Campo | Tipo | Regra |
|---|---|---|
| `session_id` | uuid | FK |
| `song_id` | uuid | referência original |
| `seed` | integer | único por sessão |
| `title` | varchar(200) | snapshot |
| `artist` | varchar(200) | snapshot |
| `thumbnail_url` | text | snapshot |
| `provider` | enum | snapshot |
| `provider_content_id` | varchar(64) | snapshot |
| `start_time_seconds` | integer | snapshot |
| `preview_duration_seconds` | integer | snapshot |

PK composta em `(session_id, song_id)` e restrição única em `(session_id, seed)`.

### 10.7 `game_matches`

| Campo | Tipo | Regra |
|---|---|---|
| `id` | uuid | PK |
| `session_id` | uuid | FK |
| `round_number` | integer | começa em 1 |
| `position` | integer | posição na rodada |
| `song_a_id` | uuid | nullable em rodadas futuras |
| `song_b_id` | uuid | nullable em rodadas futuras |
| `winner_song_id` | uuid | nullable até votação |
| `status` | enum | `pending`, `ready`, `completed` |
| `completed_at` | timestamptz | nullable |
| `created_at` | timestamptz | obrigatório |
| `updated_at` | timestamptz | obrigatório |

Restrição única em `(session_id, round_number, position)`.

## 11. Algoritmo de chaveamento

Criar funções puras e testáveis em `src/domain/bracket`.

### 11.1 Criação

```ts
createBracket(songIds: string[], bracketSize: 4 | 8 | 16 | 32 | 64 | 128): Bracket
```

Regras:

- rejeitar quantidade diferente de `bracketSize`;
- embaralhar antes de chamar a função ou aceitar um gerador aleatório injetável;
- criar todas as rodadas e todos os N - 1 confrontos;
- preencher apenas a primeira rodada;
- marcar confrontos da primeira rodada como `ready`;
- marcar confrontos futuros como `pending`.

### 11.2 Registro do voto

```ts
advanceWinner(bracket: Bracket, matchId: string, winnerSongId: string): Bracket
```

Regras:

- o confronto precisa estar `ready`;
- uma decisão de voto precisa indicar A ou B;
- uma decisão de desempate não recebe vencedora do cliente e a sorteia no servidor;
- o confronto passa a `completed`;
- ao concluir a rodada, suas vencedoras são embaralhadas, persistidas e pareadas para a rodada seguinte;
- se for a final, concluir a sessão.

### 11.3 Transação e idempotência

O endpoint de decisão deve:

1. bloquear ou atualizar condicionalmente o confronto ainda não concluído;
2. validar a variante da decisão e, em desempates, sortear a vencedora no servidor;
3. concluir o confronto;
4. ao fechar uma rodada, embaralhar e persistir suas vencedoras antes de criar os próximos confrontos, ou encerrar a sessão;
5. confirmar tudo em uma transação;
6. retornar estado atualizado;
7. em repetição da mesma requisição, retornar conflito sem duplicar avanço.

## 12. Rotas e contratos

Todos os payloads devem ser validados com Zod e retornar erros estruturados.

### 12.1 Público

#### `GET /api/themes`

Retorna temas ativos e quantidade de músicas ativas.

#### `POST /api/games`

```json
{
  "themeId": "uuid",
  "bracketSize": 16
}
```

Retorna `sessionId` e URL da partida.

#### `GET /api/games/:sessionId`

Retorna sessão, confronto atual, progresso e chaveamento.

#### `POST /api/games/:sessionId/matches/:matchId/decision`

```json
{
  "type": "vote",
  "winnerSongId": "uuid"
}
```

ou, para o servidor sortear entre as duas participantes:

```json
{
  "type": "tiebreak"
}
```

As variantes são exclusivas, retornam o estado atualizado e decisões repetidas
para o mesmo confronto são rejeitadas.

### 12.2 Administração

- CRUD de temas.
- Associação e configuração de músicas.
- Pesquisa do YouTube.
- Resolução de URL ou ID.
- `POST /api/admin/youtube/playlists/preview`: recebe URL ou ID de playlist, percorre todas as páginas e retorna itens normalizados com seu estado de elegibilidade.
- A confirmação da prévia reutiliza o serviço de associação de músicas do tema em uma operação em lote idempotente.
- Todas as rotas devem validar sessão e perfil administrativo ativo.

### 12.3 Formato de erro

```json
{
  "error": {
    "code": "MATCH_ALREADY_COMPLETED",
    "message": "Este confronto já foi concluído.",
    "fieldErrors": null
  }
}
```

Nunca retornar stack trace ao cliente.

## 13. Integração com YouTube

### 13.1 Busca administrativa

- Executada somente no servidor.
- Usar `YOUTUBE_API_KEY`.
- Buscar somente vídeos.
- Usar região `BR` e relevância quando aplicável.
- Limitar resultados por consulta.
- Após a busca, consultar detalhes dos IDs para obter duração e status de incorporação.
- Não buscar vídeos durante uma partida.
- Adicionar cache curto no servidor para consultas repetidas.
- Disponibilizar entrada manual de URL/ID quando a cota estiver indisponível.

### 13.2 Player

- Carregar a IFrame Player API uma vez.
- Criar um componente cliente reutilizável.
- Manter um player por tela.
- Iniciar reprodução somente após gesto do usuário.
- Usar `loadVideoById` ou `cueVideoById` com `startSeconds`.
- Pausar no fim do trecho usando evento e temporizador sincronizado.
- Limpar temporizadores ao trocar de música ou desmontar o componente.
- Tratar códigos de erro da API.
- Não ocultar o player, extrair áudio, bloquear anúncios ou modificar a experiência exigida pelo YouTube.

### 13.3 Importação de playlist

- Aceitar URL ou ID de playlist pública ou não listada.
- Usar `playlistItems.list` no servidor, seguindo `nextPageToken` até o final da playlist.
- Consultar `videos.list` em lotes para validar duração, metadados atuais e `status.embeddable`.
- A prévia deve classificar cada item como `pronto`, `já associado`, `duplicado na playlist`, `indisponível`, `não incorporável`, `bloqueado na região` ou `inválido`.
- O administrador pode desmarcar itens antes de confirmar.
- A confirmação associa somente os itens elegíveis selecionados e retorna contagens de adicionados, já existentes e ignorados.
- Repetir a mesma importação não pode criar músicas ou associações duplicadas.
- Falhas de um vídeo não devem cancelar os demais itens válidos; o resultado precisa informar cada item ignorado.
- O título e o artista continuam editáveis individualmente depois da importação.
- Playlists privadas exigem autorização OAuth do proprietário e ficam fora do MVP; a chave de API atual cobre apenas dados acessíveis publicamente.
- Não baixar, extrair nem armazenar áudio durante a importação.

### 13.4 Quota

O projeto deve evitar dependência de pesquisa em tempo de jogo. Registrar no README que a cota da API pode mudar e deve ser acompanhada no Google Cloud. A pesquisa administrativa deve ser econômica e possuir fallback por URL.

A importação deve usar paginação e consultas em lote, sem executar uma pesquisa por vídeo. Aplicar limite por administrador, cache curto da prévia e um teto configurável de itens por importação para proteger cota, tempo de execução e memória. Se o teto for atingido, interromper com resultado parcial explícito, nunca silenciosamente.

## 14. Autenticação e segurança

### 14.1 Autenticação

- Supabase Auth com e-mail e senha.
- Clientes SSR baseados em `@supabase/ssr` e cookies.
- Proteger `/admin` e rotas administrativas.
- Após autenticar, verificar `admin_profiles.is_active`.
- Não permitir autoinscrição pública no MVP.

### 14.2 Segredos

Somente variáveis prefixadas com `NEXT_PUBLIC_` podem chegar ao navegador. Estas são públicas por definição:

```env
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Variáveis exclusivamente do servidor:

```env
DATABASE_URL=
YOUTUBE_API_KEY=
```

Criar `src/lib/env.ts` com validação Zod na inicialização.

### 14.3 Banco

- Drizzle acessível apenas em módulos server-only.
- Utilizar conexão do pooler compatível com ambiente serverless.
- Se o Supabase estiver em modo Transaction Pooler, configurar o driver sem prepared statements quando exigido.
- Criar índices para slugs, status, relações e busca dos confrontos de uma sessão.
- Restringir exclusões que destruam histórico; preferir desativação.

### 14.4 Segurança web

- Validar todos os dados no servidor.
- Aplicar limite simples de requisições nas rotas de pesquisa e criação de partidas.
- Configurar cabeçalhos de segurança compatíveis com o player do YouTube.
- Definir Content Security Policy permitindo somente domínios necessários do YouTube, Supabase e recursos próprios.
- Não renderizar HTML fornecido pelo usuário.
- Sanitizar e validar URLs de imagens e vídeos.

## 15. PWA

- Criar `src/app/manifest.ts`.
- Incluir ícones 192 × 192 e 512 × 512.
- `display: "standalone"`.
- Nome completo `Jogo da Música` e nome curto `Jogo Música`.
- Criar service worker simples para assets estáticos e fallback de navegação.
- Não prometer partida offline; vídeos e estado do servidor exigem internet.
- Não armazenar respostas autenticadas ou dados sensíveis no cache.
- Exibir instrução discreta para instalação quando o navegador permitir.
- Testar em Chrome/Edge para desktop e Android; testar comportamento no Safari iOS quando disponível.

## 16. Instalação no computador Windows

### 16.1 Obrigatório

1. Git para Windows.
2. Node.js 24 LTS, que inclui npm.
3. Visual Studio Code.
4. Google Chrome ou Microsoft Edge.
5. Acesso ao Codex.

### 16.2 Contas necessárias

1. GitHub.
2. Supabase.
3. Google Cloud, com YouTube Data API ativada.
4. Vercel.

### 16.3 Não instalar inicialmente

- PostgreSQL local.
- Docker Desktop.
- Supabase CLI.
- Android Studio.
- Xcode.
- Java ou .NET.

Esses itens só devem ser adicionados quando houver uma necessidade concreta.

## 17. Bootstrap do projeto

No PowerShell:

```powershell
npx create-next-app@latest jogo-da-musica --typescript --eslint --tailwind --app --src-dir --import-alias "@/*"
cd jogo-da-musica
npm install @supabase/supabase-js @supabase/ssr drizzle-orm postgres zod react-hook-form @hookform/resolvers
npm install -D drizzle-kit vitest @vitest/coverage-v8 playwright prettier prettier-plugin-tailwindcss
npx shadcn@latest init
npx playwright install
```

Depois, adicionar componentes shadcn conforme o uso real. Não instalar grandes conjuntos de componentes preventivamente.

### 17.1 Scripts esperados

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:seed": "tsx src/db/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  }
}
```

Adicionar `tsx` como dependência de desenvolvimento caso seja usado pelo seed.

## 18. Configuração externa

### 18.1 Supabase

1. Criar projeto.
2. Copiar URL e chave pública anon.
3. Obter URL do pooler PostgreSQL para `DATABASE_URL`.
4. Configurar autenticação por e-mail e senha.
5. Desativar inscrição pública ou bloquear usuários não autorizados pela aplicação.
6. Executar migrações.
7. Criar o primeiro usuário no painel do Supabase.
8. Inserir o UUID desse usuário em `admin_profiles`.

### 18.2 Google Cloud e YouTube

1. Criar projeto no Google Cloud.
2. Ativar YouTube Data API v3.
3. Criar chave de API.
4. Restringir a chave à API do YouTube.
5. Manter a chave somente no servidor.
6. Acompanhar a cota no console.

### 18.3 Vercel

1. Subir o repositório no GitHub.
2. Importar o repositório na Vercel.
3. Configurar variáveis de ambiente para Preview e Production.
4. Conectar o domínio futuramente; usar o domínio provisório no MVP.
5. Garantir que migrações sejam executadas de forma controlada, não automaticamente em todas as builds.

## 19. Testes obrigatórios

### 19.1 Unitários

- criação de chave para 4, 8, 16, 32, 64 e 128 músicas;
- quantidade total de confrontos igual a N - 1;
- embaralhamento persistido das vencedoras entre rodadas;
- conclusão da final;
- rejeição de vencedora inválida;
- rejeição de voto repetido;
- validação dos tempos de trecho;
- validação de URL e ID do YouTube;
- cálculo dos tamanhos disponíveis por tema.
- conversão entre 2–7 rodadas e chaves de 4–128 músicas;
- sorteio sem repetição quando o tema possui músicas excedentes;
- normalização de URL/ID e paginação de playlist;
- classificação de vídeos duplicados, indisponíveis e não incorporáveis.

### 19.2 Integração

- criação de sessão gera snapshots e confrontos;
- voto atualiza confronto seguinte na mesma transação;
- usuário não administrador não acessa rotas administrativas;
- tema inativo não inicia partida;
- tema sem músicas suficientes é rejeitado;
- tema com músicas excedentes cria sessão somente com a quantidade escolhida;
- importação percorre mais de uma página, consulta detalhes em lote e é idempotente;
- falha em um vídeo da playlist não impede a associação dos demais itens válidos.

### 19.3 E2E

Cenário mínimo:

1. acessar a página inicial;
2. selecionar um tema seed com quatro músicas;
3. selecionar `2 rodadas · 4 músicas` e iniciar a partida;
4. iniciar os dois trechos em cada confronto;
5. votar;
6. concluir semifinal e final;
7. verificar campeã e chaveamento;
8. reiniciar com o mesmo tema.

Cenário adicional:

1. preparar um tema com mais de oito músicas ativas;
2. selecionar `3 rodadas · 8 músicas`;
3. verificar que a sessão contém exatamente oito músicas distintas;
4. concluir a partida e iniciar outra;
5. verificar que todas as músicas do tema continuam disponíveis para sorteios futuros.

Nos testes automatizados, simular o player por adaptador ou flag de teste; não depender da reprodução real do YouTube em CI.

## 20. Critérios de aceite

O MVP será considerado pronto quando:

- o projeto instalar e executar seguindo somente o README;
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run build` passarem;
- um administrador conseguir criar um tema e adicionar músicas do YouTube;
- um administrador conseguir pré-visualizar e importar em lote uma playlist pública ou não listada;
- vídeos inválidos da playlist serem informados sem impedir a importação dos válidos;
- um tema não puder ser publicado sem músicas suficientes;
- um tema poder manter mais músicas ativas do que a quantidade usada em uma partida;
- o jogador escolher entre as quantidades de rodadas compatíveis com o tema;
- cada sessão sortear exatamente 4, 8, 16, 32, 64 ou 128 músicas distintas conforme a escolha;
- um jogador iniciar e concluir chaveamentos de 4, 8, 16, 32, 64 e 128 músicas;
- a partida sobreviver a uma atualização de página;
- cada confronto exigir que os dois trechos sejam iniciados antes do voto;
- votos duplicados não corromperem o chaveamento;
- a campeã e o chaveamento completo forem exibidos;
- as páginas públicas funcionarem bem em 360 px de largura;
- as rotas administrativas estiverem protegidas;
- nenhuma chave secreta aparecer no código cliente, logs ou repositório;
- o app puder ser instalado como PWA em navegador compatível;
- o deploy de produção funcionar na Vercel.

## 21. Fases de implementação para o Codex

Progresso verificado no repositório em 28 de julho de 2026:

| Fase | Estado | Evidência principal |
|---|---|---|
| 0 — Fundação | Concluída | Next.js, TypeScript, Tailwind, scripts, layout público, lint, testes e build configurados |
| 1 — Banco e autenticação | Concluída | Esquema Drizzle, migrações, seed, Supabase SSR e proteção administrativa |
| 2 — Administração de conteúdo | Concluída | CRUD de temas, busca/resolução do YouTube, músicas, trechos e regras de publicação |
| 2.1 — Playlist e catálogo flexível | Próxima | Nova demanda; ainda sem implementação |
| 3 — Domínio do torneio | Pendente | Estruturas no banco existem; serviços e regras do chaveamento ainda não |
| 4 — Experiência de jogo | Pendente | A página atual é institucional e não inicia partidas |
| 5 — PWA, acessibilidade e robustez | Concluída; validação externa pendente | Manifest, ícones, service worker seguro, estados globais, acessibilidade e cabeçalhos concluídos |
| 6 — Qualidade e deploy | Pendente | Testes unitários/integração existem; E2E, CI e deploy ainda pendentes |

### Fase 0 — Fundação

**Estado:** concluída.

- Criar projeto.
- Configurar dependências, formatação, lint e testes.
- Criar estrutura de diretórios.
- Criar `.env.example`, `.nvmrc` e README inicial.
- Criar tema visual base e layout responsivo.

**Saída:** projeto executa, testa e compila.

### Fase 1 — Banco e autenticação

**Estado:** concluída.

- Modelar esquema Drizzle.
- Gerar migração inicial.
- Configurar conexão Supabase.
- Configurar Supabase Auth SSR.
- Proteger painel administrativo.
- Criar seed básico.

**Saída:** login administrativo e banco funcionando.

### Fase 2 — Administração de conteúdo

**Estado:** concluída para cadastro individual.

- CRUD de temas.
- Busca e resolução de vídeos do YouTube.
- Cadastro e associação de músicas.
- Configuração de trecho.
- Validações de publicação.

**Saída:** administrador prepara um tema jogável.

### Fase 2.1 — Importação de playlist e catálogo flexível

**Estado:** concluída; QA manual pendente.

- Importar playlist pública ou não listada por URL/ID, com paginação completa.
- Buscar detalhes dos vídeos em lote e filtrar conteúdo indisponível ou não incorporável.
- Exibir prévia revisável antes da confirmação.
- Associar itens elegíveis em lote com resultado parcial e idempotência.
- Manter catálogo do tema sem limite vinculado às modalidades da chave.
- Exibir no painel quantas modalidades o catálogo suporta: de 2 a 7 rodadas.
- Cobrir normalização, paginação, classificação, autorização, cota e importação parcial com testes.

**Saída:** administrador popula um tema grande com uma playlist e entende quais quantidades de rodadas ele suporta.

Decisões confirmadas: teto configurável padrão de 200 posições, prévia válida
por 15 minutos, cinco prévias não cacheadas por administrador a cada dez
minutos, página dedicada no tema, itens prontos pré-selecionados, revalidação
confiável na confirmação, preservação de associações existentes e gravação
atômica do lote.

### Fase 3 — Domínio do torneio

**Estado:** concluída.

- Funções puras de chaveamento.
- Função pura para calcular opções de rodada a partir da quantidade de músicas ativas.
- Sorteio sem repetição de exatamente 4, 8, 16, 32, 64 ou 128 músicas, preservando as excedentes fora da sessão.
- Criação transacional de sessão.
- Registro transacional de decisão por voto ou desempate e sorteio entre rodadas.
- Testes unitários e de integração.

**Saída:** torneio funciona sem depender da interface final.

### Fase 4 — Experiência de jogo

**Estado:** concluída.

- Lista pública de temas.
- Seletor de quantidade de rodadas com a equivalência em músicas e somente opções compatíveis.
- Início da partida com a opção escolhida.
- Componente do YouTube.
- Tela de confronto.
- Votação, progresso, retomada e resultado.

**Saída:** fluxo completo utilizável.

### Fase 5 — PWA, acessibilidade e robustez

**Estado:** concluída; validação externa pendente.

- Manifest e ícones.
- Service worker seguro.
- Estados de carregamento e erro.
- Acessibilidade.
- Responsividade.
- Cabeçalhos de segurança.

**Saída:** experiência pronta para teste externo.

### Fase 6 — Qualidade e deploy

**Estado:** pendente.

- Playwright.
- GitHub Actions.
- README completo.
- Deploy na Vercel.
- Checklist de segurança e variáveis.

**Saída:** MVP publicado.

## 22. Regras de execução para o Codex

1. Ler este documento inteiro antes de alterar arquivos.
2. Mostrar um plano curto da fase atual.
3. Trabalhar em pequenas alterações coerentes.
4. Usar TypeScript estrito; evitar `any`.
5. Não duplicar regra de negócio em componentes.
6. Manter Route Handlers, serviços e repositórios separados.
7. Criar testes junto com a lógica crítica.
8. Não colocar segredos ou valores reais em exemplos.
9. Não usar dados falsos na produção sem marcação clara.
10. Não adicionar bibliotecas sem necessidade e justificativa.
11. Não implementar recursos listados como fora do escopo.
12. Ao terminar uma fase, executar e informar os resultados de:
    - `npm run lint`
    - `npm run typecheck`
    - `npm test`
    - `npm run build`
13. Atualizar o README com instalação, variáveis, migrações, seed e deploy.
14. Criar commits sugeridos por fase, sem assumir que pode enviar ao GitHub sem autorização.

## 23. Fora do escopo do MVP

- Votação simultânea em vários celulares.
- Salas, convites e códigos de participação.
- WebSockets ou sincronização em tempo real.
- Contas e perfis de jogadores.
- Temas criados pelo público.
- Comentários, curtidas e rede social.
- Ranking global.
- Monetização, anúncios próprios ou pagamentos.
- Aplicativos Android e iOS nativos.
- Integração com Spotify ou Deezer.
- Download, extração ou armazenamento de áudio.
- Reprodução totalmente offline.
- Inteligência artificial para recomendar músicas.
- Internacionalização além da preparação estrutural.

## 24. Melhorias futuras

- Modo multiaparelho com sala e QR code.
- Votos secretos e contagem por participante.
- Temas criados por usuários.
- Login social.
- Mais provedores implementando `MusicProvider`.
- Estatísticas agregadas e rankings.
- Compartilhamento do resultado.
- Modos de jogo alternativos.
- Aplicativos nativos via Capacitor, somente se a PWA não atender.

## 25. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Vídeo removido ou bloqueado | Validar no cadastro, permitir desativação e tratar erro no player |
| Restrições de autoplay | Exigir gesto explícito nos botões `Ouvir` |
| Cota de pesquisa do YouTube | Buscar só no admin, usar cache e fallback por URL |
| Playlist muito grande ou com itens inválidos | Paginar, consultar em lotes, limitar a importação e apresentar resultado parcial por item |
| Playlist privada | Não prometer suporte no MVP; informar que exige OAuth do proprietário |
| Alteração de metadados | Guardar snapshot em cada sessão |
| Duplo clique ou repetição de requisição | Transação, validação de status e restrições únicas |
| Segredo exposto | Validação de ambiente e módulos server-only |
| Tema sem músicas suficientes | Bloquear ativação e início da partida |
| Dependência da Vercel | Manter Next.js portável e banco PostgreSQL padrão |
| Uso comercial futuro | Reavaliar planos de hospedagem, termos e custos antes da monetização |

## 26. Definições assumidas e ajustáveis

Estas decisões foram adotadas para evitar bloqueio do MVP e podem ser alteradas depois:

- trecho padrão com a duração total da música;
- duração configurável até o fim do vídeo;
- voto liberado após iniciar ambas as músicas;
- ausência de desfazer após confirmação;
- escolha de 2, 3, 4, 5, 6 ou 7 rodadas, equivalentes a chaves de 4, 8, 16, 32, 64 e 128;
- catálogo do tema precisa de no mínimo quatro músicas publicáveis, pode superar qualquer modalidade disponível e não possui máximo definido pelo chaveamento;
- seleção aleatória sem repetição quando houver músicas excedentes;
- importação de playlist pública ou não listada com revisão e resultado parcial;
- playlist privada fora do MVP por exigir OAuth;
- login administrativo por e-mail e senha;
- tema visual escuro;
- histórico de partidas armazenado sem dados pessoais.

## 27. Entregáveis esperados no repositório

- Código-fonte completo.
- Migrações Drizzle.
- Seed com ao menos um tema de demonstração sem depender de chaves secretas.
- `.env.example` documentado.
- README com instalação no Windows.
- Testes unitários, integração e E2E.
- Pipeline de CI.
- Ícones e manifest da PWA.
- Configuração de deploy.
- Documento ou seção de limitações conhecidas.

## 28. Referências técnicas verificadas

Verificadas em 28 de julho de 2026:

- Next.js — instalação e requisitos: https://nextjs.org/docs/app/getting-started/installation
- Next.js — PWA: https://nextjs.org/docs/app/guides/progressive-web-apps
- Node.js — ciclo de versões: https://nodejs.org/en/about/previous-releases
- Supabase — cliente SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client?framework=nextjs
- Supabase — Next.js quickstart: https://supabase.com/docs/guides/auth/quickstarts/nextjs
- Drizzle — Supabase/PostgreSQL: https://orm.drizzle.team/docs/get-started/supabase-new
- shadcn/ui — Next.js: https://ui.shadcn.com/docs/installation/next
- YouTube — IFrame Player API: https://developers.google.com/youtube/iframe_api_reference
- YouTube — Data API e quota: https://developers.google.com/youtube/v3/getting-started
- YouTube — `playlistItems.list`: https://developers.google.com/youtube/v3/docs/playlistItems/list
- YouTube — `videos.list`: https://developers.google.com/youtube/v3/docs/videos/list
- YouTube — autenticação OAuth: https://developers.google.com/youtube/v3/guides/authentication
- Vercel — Next.js: https://vercel.com/docs/frameworks/full-stack/nextjs

Análise específica da nova demanda: [`docs/pesquisa-importacao-playlist-youtube.md`](./docs/pesquisa-importacao-playlist-youtube.md).

---

## Comando inicial para a próxima sessão do Codex

> Leia integralmente `jogo-da-musica-especificacao-codex.md` e `docs/pesquisa-importacao-playlist-youtube.md`. Implemente apenas a Fase 2.1, começando por testes das regras de normalização, paginação, classificação e idempotência. Antes de editar código Next.js, leia os guias relevantes em `node_modules/next/dist/docs/`. Preserve o cadastro individual existente e não implemente OAuth para playlists privadas. Ao terminar, execute formatação, lint, typecheck, testes e build, atualize o README e apresente um resumo. Não avance para a Fase 3 sem nova instrução.
