# CAT-04 — publicação editorial e saúde

## Contrato e fronteiras

`classifyThemeState` é a única tabela de classificação. O admin usa as
Disponibilidades BR das associações ativas e o relógio da leitura. Jogáveis são
fresh + grace; potenciais incluem unknown. Nenhum campo novo entra no catálogo
público: seus filtros legados e whitelist permanecem intactos até CAT-05/CAT-12.

Publicar exige sessão administrativa e, na transação, lock do Tema, perfil
administrativo ativo sob `FOR SHARE NOWAIT` e leitura das Entradas/Disponibilidades.
O servidor recusa draft com menos de quatro jogáveis. Retirada/desativação pode
suspender published sem apagar sua intenção. Revalidação consulta o provedor
antes de abrir a transação de Tema e nunca escreve nos campos editoriais.

`deriveThemeStateEvents` fornece tipos fechados para editorial, visibilidade,
degradação, suspensão e modalidades principais, com causa, versão e contagens.
O sink opcional do serviço é o ponto de emissão; persistência/exporter e
propagação a outros Temas ficam fora desta entrega. Na revalidação, associações
atuais são mantidas fixas na comparação para não atribuir retirada concorrente
ao provedor. Leituras/expiração pelo relógio não emitem eventos persistidos.

## Migration expansiva e rollback de aplicativo

`0011_theme_editorial_state.sql` adiciona enum/coluna, faz backfill do booleano e
exige coerência. Não há default na coluna nova: o trigger reconhece INSERT legado
que a omite e deriva seu valor de `is_active`. Novas criações enviam false/draft.
UPDATE de um campo efetivamente modificado sincroniza o outro; INSERT de pares
conflitantes é recusado pela constraint. O trigger é `SECURITY INVOKER`, com search_path
fixo e sem EXECUTE para PUBLIC/anon/authenticated; RLS/grants das tabelas ficam
inalterados.

A versão anterior continua lendo/escrevendo `is_active` no schema expandido.
Rollback é de aplicativo, preservando coluna, intenção editorial e observações.
Correção de schema é forward-fix: não remover coluna, histórico ou dados legados.

## Evidência local

| Critério                                                           | Seam de prova                                                                                                                       |
| ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| AC1 backfill, dual-write, compatibilidade, constraints, RLS/grants | `tests/unit/theme-state-migration.test.ts`: executa SQL real em PGlite, compara campos legados e consulta catálogo PostgreSQL       |
| AC2 cinco estados e limites de modalidades                         | `tests/unit/theme-state.test.ts`: expectativas literais e eventos fechados                                                          |
| AC3 sessão, argumentos, contagem autoritativa e lock               | `tests/integration/theme-publication.test.ts`: action e serviços reais com DB PGlite; autenticação/framework somente nas fronteiras |
| AC4–6 suspensão, recuperação, causas e concorrência                | Mesma integração: relógio, transação/rollback reais, retirada durante I/O e 32/64 por saúde versus editorial                        |
| AC7 lista/editor e hierarquia                                      | Páginas reais renderizadas na integração, `theme-state-status.test.ts` e `tests/e2e/theme-state-admin.spec.ts`                      |
| AC8 whitelist pública preservada                                   | `tests/integration/public-theme-repository.test.ts` no schema expandido; serviço público e catálogo E2E de regressão                |

A fixture E2E usa os serviços/classificador de produção com banco e provider em
memória. Exige E2E_TEST_MODE e header de teste, e sua página `.e2e.tsx` é excluída
do build normal. O GET não chama provider. Ela não é prova de ambiente original.

Validação local em 2026-09-08: `npm test` passou 459 testes/58 arquivos e
16 testes de segurança; lint, typegen/typecheck, Prettier focado, diff-check e
`drizzle-kit check` passaram. Builds Turbopack normal e E2E passaram com o gate
Next16.3.3 intacto. Playwright passou 7/7 (jornada CAT-04, catálogo público e
Disponibilidade), tanto em dev quanto no build otimizado, porta exclusiva3122.

`format:check` global encontra 185 arquivos CRLF preexistentes: interseção zero
com o diff, todos equivalentes à base e8a3cf4 após normalização de EOL. A baseline
foi preservada; CI ainda precisa confirmar o SHA. O primeiro build/typecheck
encontrou truncamento no arquivo gerado `.next/dev/types/routes.d.ts`; o artefato
foi preservado em tmp, regenerado pelo próprio Next e os gates repetidos passaram.

## Janela de migration/QA original — pendente

Operador único: tarefa autora CAT-04. Alvo único autorizado: projeto original
Jogo da Música, ref `buncpcbjwtmgskgmqkyn`. Esta seção será complementada com
evidências após gates locais e revisões independentes no SHA candidato exato.

1. Congelar SHA e hash dos bytes de 0011; avisar PM/coordenador do início da janela.
2. Confirmar identidade/conexão e ledger 0000–0010 (11 registros), ausência de
   operador concorrente e compatibilidade do aplicativo publicado.
3. Executar somente 0011 pelo migrador Drizzle configurado. Verificar ledger,
   backfill, constraint, integridade dos campos legados e acesso Data API.
4. No Preview próprio, usar somente fixtures sintéticas e sessão temporária da
   execução: publicação3/4, suspensões, recuperação, 32/64 por causa, draft e
   payload público sem delta. Não chamar YouTube real.
5. Registrar resultado sem segredos/dados editoriais alheios, revogar sessões
   temporárias antes de excluir a identidade e limpar apenas as fixtures próprias.
6. Avisar encerramento da janela. Integração/deploy final pertencem ao coordenador.

Parar diante de divergência de alvo/ledger, concorrência, falta de credencial
protegida ou falha de migration. Nunca repetir migration cegamente nem executar
rollback destrutivo. A entrega não está ready-for-pm enquanto esta QA e as
revisões/checks do SHA final estiverem pendentes.
