# Checklist de produção — Fase 6

Este runbook controla o primeiro beta pessoal e não comercial do Jogo da
Música. O alvo inicial é Vercel Hobby, no domínio provisório `vercel.app`, com
projetos Supabase independentes para Preview/QA e Production.

Não execute migrações durante `next build` nem em cada deploy. Nenhuma etapa
abaixo deve imprimir, copiar para issues ou versionar valores secretos.

## Registro da versão

- Commit candidato: `________________`
- Preview validado: `https://________________.vercel.app`
- Deployment de produção: `https://________________.vercel.app`
- Responsável pela migração: `________________`
- Responsável pela promoção: `________________`
- Data e janela: `________________`

## 1. Gates antes do release

- [ ] O pull request aponta para `master` e recebeu revisão.
- [ ] O check obrigatório **Quality gate** passou: formatação, lint, tipos,
      testes unitários/integração, build e Playwright.
- [ ] O Preview foi construído pela integração GitHub–Vercel usando o mesmo
      commit candidato.
- [ ] O [roteiro de QA externo](./qa-externo-fase-6.md) foi concluído.
- [ ] Não há defeito crítico ou alto aberto.
- [ ] Mudanças pendentes e arquivos não rastreados foram revisados; nenhum
      `.env*`, token, relatório ou resultado de teste será enviado.
- [ ] `npm audit --omit=dev` foi revisado; riscos aceitos estão documentados.

## 2. GitHub e Vercel

### GitHub

- [ ] `master` exige pull request e o check **Quality gate** antes do merge.
- [ ] Force push e exclusão da branch protegida estão bloqueados.
- [ ] GitHub Actions possui somente permissão de leitura do conteúdo.
- [ ] Nenhum token Vercel, Supabase ou Google foi adicionado ao Actions; o CI
      usa fixtures e mocks determinísticos.

### Vercel

- [ ] O repositório GitHub correto está conectado pela integração nativa.
- [ ] Framework Preset é Next.js e a raiz do projeto é a raiz do repositório.
- [ ] Production Branch é `master`.
- [ ] A atribuição automática do domínio de produção está desativada no
      primeiro release; o build de produção fica staged até a promoção manual.
- [ ] Preview recebe variáveis apenas do Supabase de QA.
- [ ] Production recebe variáveis apenas do Supabase de produção.
- [ ] O histórico mostra o commit candidato correto antes da promoção.

## 3. Variáveis por ambiente

Configure estes nomes no painel da Vercel. Valores de Preview e Production não
podem apontar para o mesmo Supabase.

| Variável                               | Preview                      | Production                   | Observação                       |
| -------------------------------------- | ---------------------------- | ---------------------------- | -------------------------------- |
| `NEXT_PUBLIC_APP_URL`                  | URL estável do Preview de QA | URL `vercel.app` de produção | Pública e canônica               |
| `NEXT_PUBLIC_SUPABASE_URL`             | Projeto QA                   | Projeto Production           | Pública por definição            |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave QA                     | Chave Production             | Preferida em projetos novos      |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`        | Somente se necessário        | Somente se necessário        | Compatibilidade legada           |
| `DATABASE_URL`                         | Pooler QA                    | Pooler Production            | Segredo exclusivo do servidor    |
| `YOUTUBE_API_KEY`                      | Chave de QA restrita         | Chave de produção restrita   | Segredo exclusivo do servidor    |
| `YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS`    | `200`                        | `200`                        | Ajustar apenas com justificativa |

`SEED_ADMIN_USER_ID` e `SEED_ADMIN_DISPLAY_NAME` são variáveis temporárias do
operador do seed. Não precisam permanecer no runtime da Vercel.

- [ ] Inscrição pública por e-mail está desativada nos dois Supabase.
- [ ] URLs e chaves públicas pertencem ao ambiente correto.
- [ ] `DATABASE_URL` usa o Transaction Pooler e TLS.
- [ ] A chave YouTube está restrita à YouTube Data API v3.
- [ ] Nenhum segredo usa o prefixo `NEXT_PUBLIC_`.
- [ ] Após qualquer alteração de variável, um novo deployment foi criado; mudar
      a configuração não altera builds que já existem.

## 4. Migração e seed controlados

Para o primeiro release, use um banco Production vazio. Revise todos os arquivos
SQL em `drizzle/` antes de executar. Em releases posteriores, compare as
migrações pendentes e confirme que continuam compatíveis com a versão que ainda
está servindo tráfego.

No PowerShell, em uma sessão local segura:

```powershell
$env:DATABASE_URL = "<transaction-pooler-de-production>"
npm run db:migrate
```

Depois, crie manualmente o primeiro usuário em **Supabase Auth > Users**, copie
o UUID e execute o seed idempotente:

```powershell
$env:SEED_ADMIN_USER_ID = "<uuid-do-usuario-auth>"
$env:SEED_ADMIN_DISPLAY_NAME = "Administrador"
npm run db:seed
```

- [ ] Foi confirmado que o alvo é Production, não Preview/QA.
- [ ] As migrações terminaram sem erro e a tabela de histórico foi conferida.
- [ ] O usuário Auth não foi criado por inscrição pública.
- [ ] `admin_profiles` contém o UUID correto e está ativo.
- [ ] O tema demonstrativo continua inativo.
- [ ] As variáveis temporárias foram removidas da sessão do terminal.

## 5. Staging, promoção e smoke test

1. Faça merge somente depois do CI e do QA no Preview.
2. Confirme que a Vercel criou um deployment de Production em estado staged.
3. Abra a URL específica do deployment e repita os itens essenciais do smoke
   test abaixo.
4. Promova manualmente o deployment staged.
5. Repita o smoke test no domínio público.

- [ ] `/` responde sem erro e lista o catálogo esperado.
- [ ] `/manifest.webmanifest`, `/sw.js` e `/offline` respondem corretamente.
- [ ] `/admin/login` autentica o administrador de produção.
- [ ] Uma busca/resolução administrativa do YouTube funciona sem expor a chave.
- [ ] Uma partida de quatro músicas pode ser iniciada, retomada após refresh e
      concluída até o resultado.
- [ ] Console do navegador e logs da Vercel não apresentam erro inesperado.
- [ ] Cabeçalhos CSP, HSTS, `nosniff`, frame denial e Permissions Policy estão
      presentes.

## 6. Rollback

Em releases posteriores, se o smoke test falhar, use **Instant Rollback** para o
deployment de produção imediatamente anterior e verifique novamente o serviço.
No plano Hobby, apenas o deployment anterior está disponível para rollback.

O primeiro release não possui versão anterior conhecida. Por isso ele só pode
ser promovido após passar no URL staged. Se surgir um defeito exclusivo do
domínio público, interrompa o QA público, preserve as evidências e publique uma
correção staged; não tente desfazer migrações destrutivamente.

- [ ] O deployment anterior conhecido como bom foi identificado antes da
      promoção (aplicável a partir do segundo release).
- [ ] A mudança de banco é retrocompatível com a versão anterior.
- [ ] Após rollback ou correção, o smoke test foi repetido e o incidente
      registrado.

## 7. Encerramento

- [ ] URL pública e commit foram registrados neste documento ou no relatório da
      execução.
- [ ] Defeitos não bloqueadores possuem issue, severidade e responsável.
- [ ] Consumo da Vercel, Supabase e cota do YouTube será acompanhado durante o
      beta.
- [ ] Qualquer cobrança, patrocínio ou uso comercial acionará uma revisão do
      plano Hobby antes de continuar.
