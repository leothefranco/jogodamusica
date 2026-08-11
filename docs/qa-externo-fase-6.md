# Roteiro de QA externo — Fase 6

Este roteiro valida o release candidate no Preview e registra evidências antes
da promoção manual. Ele consolida os bloqueadores das Fases 2, 2.1 e 5 sem
substituir os cenários detalhados já existentes em
[`qa-fase-2.md`](./qa-fase-2.md) e [`qa-fase-2.1.md`](./qa-fase-2.1.md).

Use apenas o Supabase de QA. Não informe credenciais, URLs secretas, UUIDs ou
dados pessoais nas evidências.

O endereço-base deste ciclo é
`https://jogodamusica-git-codex-phase6-quality-deploy-jogo-da-musica.vercel.app`.
Distribua o link completo com `_vercel_share` fora do Git e apenas aos
testadores. Nunca registre esse token neste documento, em issues ou screenshots.
No plano Hobby, gerar outro link compartilhável revoga o anterior.

## Registro da execução

- Commit candidato: `________________`
- Preview base:
  `https://jogodamusica-git-codex-phase6-quality-deploy-jogo-da-musica.vercel.app`
- Link externo recebido fora do Git: [ ]
- Executor(es): `________________`
- Período: `________________`
- Supabase de QA confirmado: [ ]
- Resultado final: [ ] Aprovado [ ] Reprovado

## Critérios de bloqueio

| Severidade | Definição                                                                                           | Efeito                           |
| ---------- | --------------------------------------------------------------------------------------------------- | -------------------------------- |
| Crítica    | Segredo exposto, perda/corrupção de dados, acesso administrativo indevido ou aplicação indisponível | Bloqueia promoção                |
| Alta       | Fluxo principal, login, importação ou partida completa não pode ser concluído sem alternativa       | Bloqueia promoção                |
| Média      | Função secundária degradada com alternativa segura                                                  | Exige issue antes da promoção    |
| Baixa      | Problema cosmético ou melhoria sem perda funcional                                                  | Pode seguir com issue registrada |

Qualquer cenário bloqueador reprovado impede a produção. Um cenário não
executado não conta como aprovado.

## Matriz mínima

| Plataforma       | Navegador    | Larguras/condição                  | Executor | Resultado | Evidência |
| ---------------- | ------------ | ---------------------------------- | -------- | --------- | --------- |
| Windows/macOS    | Chrome atual | 360, 768 e 1280 px                 |          |           |           |
| Windows          | Edge atual   | Desktop e teclado                  |          |           |           |
| Android real     | Chrome atual | Retrato, paisagem e instalação     |          |           |           |
| iPhone/iPad real | Safari atual | Retrato e adicionar à tela inicial |          |           |           |

Registre versão do sistema e do navegador. Em dispositivos móveis, não aceite
emulação de desktop como substituta do aparelho real.

## 1. Preparação

- [ ] O **Quality gate** do commit candidato está verde.
- [ ] O Preview aponta para o Supabase de QA.
- [ ] Existe um administrador ativo criado manualmente no Supabase Auth.
- [ ] Existe um tema inativo para CRUD e importação.
- [ ] Existe um tema publicado com pelo menos oito músicas reproduzíveis.
- [ ] As playlists de teste são públicas ou não listadas e não contêm material
      pessoal ou confidencial.
- [ ] Console do navegador, aba Network e forma de capturar tela estão
      disponíveis.

## 2. Administração e segurança — bloqueador

Execute a seção completa do [`qa-fase-2.md`](./qa-fase-2.md), incluindo login,
autorização, CRUD, publicação, validações de trecho, YouTube e falhas externas.
Além disso:

- [ ] Usuário anônimo e usuário Auth sem perfil ativo não acessam `/admin` nem
      rotas administrativas.
- [ ] Nenhuma resposta, bundle, log ou mensagem apresenta `DATABASE_URL` ou
      `YOUTUBE_API_KEY`.
- [ ] Mensagens de erro não exibem stack trace.
- [ ] Logout invalida o acesso administrativo esperado.

Resultado: [ ] Passou [ ] Falhou — Issue/evidência: `________________`

## 3. Playlist e catálogo flexível — bloqueador

Execute a seção completa do [`qa-fase-2.1.md`](./qa-fase-2.1.md), cobrindo URL e
ID, playlist não listada, paginação, duplicados, indisponíveis, itens não
incorporáveis, revisão, idempotência, expiração e falha parcial.

- [ ] Uma playlist com mais de uma página é percorrida integralmente até o teto.
- [ ] Repetir a importação não duplica músicas nem associações.
- [ ] Itens inválidos não impedem os válidos e permanecem explicados por item.
- [ ] Catálogo com excedentes mantém as modalidades corretas de 2–7 rodadas.

Resultado: [ ] Passou [ ] Falhou — Issue/evidência: `________________`

## 4. Partida completa — bloqueador

- [ ] Na página inicial, apenas temas publicáveis aparecem.
- [ ] O tema não pré-seleciona modalidade e oferece somente tamanhos suportados.
- [ ] Uma partida de quatro músicas começa com quatro músicas distintas.
- [ ] Os dois players permanecem visíveis e somente um reproduz por vez.
- [ ] O voto abre confirmação; cancelar não altera o confronto.
- [ ] Voto confirmado persiste e duplo clique não duplica o avanço.
- [ ] O desempate revela a decisão registrada pelo servidor.
- [ ] Atualizar a página retoma a mesma sessão e o mesmo confronto.
- [ ] Semifinais e final terminam na campeã e no chaveamento completo.
- [ ] “Jogar novamente” cria outra sessão sem alterar a anterior.
- [ ] Uma partida de oito músicas usa exatamente oito itens mesmo quando o
      catálogo possui excedentes.
- [ ] Erro de player permite tentar novamente ou abandonar e nunca escolhe uma
      vencedora automaticamente.

Resultado: [ ] Passou [ ] Falhou — Issue/evidência: `________________`

## 5. Responsividade e acessibilidade — bloqueador

- [ ] Não existe rolagem horizontal em 360, 768 ou 1280 px.
- [ ] Em tela baixa ou paisagem, a rolagem vertical mantém os controles
      acessíveis.
- [ ] Todo o fluxo principal funciona apenas com teclado e o foco é visível.
- [ ] Diálogos prendem o foco, têm nome acessível e devolvem o foco ao fechar.
- [ ] Estados dinâmicos são anunciados e não dependem somente de cor.
- [ ] Alvos principais têm aproximadamente 44 px ou mais.
- [ ] `prefers-reduced-motion` reduz animações sem esconder estado.
- [ ] Zoom de 200% mantém conteúdo e ações utilizáveis.

Resultado: [ ] Passou [ ] Falhou — Issue/evidência: `________________`

## 6. PWA e conectividade — bloqueador

- [ ] Manifesto, nome, ícones de 192/512 px e modo standalone são reconhecidos.
- [ ] Chrome/Edge desktop oferece instalação quando compatível.
- [ ] Chrome Android instala, abre standalone e retoma após fechar/reabrir.
- [ ] Safari iOS adiciona à tela inicial e abre de forma utilizável.
- [ ] Offline exibe o fallback explicativo; não promete reprodução ou partida
      offline.
- [ ] Service worker não guarda `/api`, `/admin`, respostas autenticadas ou
      recursos do YouTube.
- [ ] Retorno à conexão recupera a navegação normal.

Resultado: [ ] Passou [ ] Falhou — Issue/evidência: `________________`

## 7. Evidências e aprovação

Para cada falha, registre: título, severidade, ambiente, passos mínimos,
resultado esperado/observado, captura ou vídeo sem dados sensíveis e URL da
issue. Não cole tokens nem exporte logs inteiros sem revisão.

| Cenário          | Dispositivo | Resultado | Evidência/issue | Observações |
| ---------------- | ----------- | --------- | --------------- | ----------- |
| Administração    |             |           |                 |             |
| Playlist         |             |           |                 |             |
| Partida completa |             |           |                 |             |
| Acessibilidade   |             |           |                 |             |
| PWA/offline      |             |           |                 |             |

### Aprovação

- [ ] Todos os cenários bloqueadores passaram em todos os ambientes aplicáveis.
- [ ] Não existe defeito crítico ou alto aberto.
- [ ] Defeitos médios e baixos possuem issue e responsável.
- [ ] Executor e responsável pelo release concordam com a promoção.

Responsável pelo QA: `________________` — Data: `________________`

Responsável pelo release: `________________` — Data: `________________`

Depois da aprovação, siga o
[`checklist de produção`](./checklist-producao.md) sem trocar o commit candidato.
