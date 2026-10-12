# LTS-03 — Administração, compartilhamento e PWA

Escopo de [#58](https://github.com/leothefranco/jogodamusica/issues/58):
apresentação C/Encore das telas administrativas existentes, imagem de resultado
e atualização do shell PWA. Autenticação, regras editoriais, contratos HTTP,
DTO compartilhado, migrations e tokens globais permanecem na base atribuída.

## Provas de comportamento

| AC   | Prova local                                                                                                                                                                                                                                                                                                                                                                                                         | Limite                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03-1 | Jornada das páginas/actions reais: visitante, credenciais inválidas, perfil inativo, login ativo, criar/editar tema, pesquisar/resolver, trecho inválido/válido, playlist inválida/prévia/importação, confirmar saúde antes de publicar, cancelar/confirmar exclusão e logout. Capturas desktop/390; nome de tema com 120 caracteres sem espaços testado no editor e prévia de importação; dashboard também em 320. | PostgreSQL 17.11 descartável em loopback; Auth com JWT RSA/JWKS e YouTube usam fronteiras externas controladas. Não prova Auth/Data API/RLS de um projeto Supabase nem reprodução real do YouTube. A confirmação nativa de exclusão foi preservada. |
| 03-2 | Handler `GET` real sobre PGlite e requisição HTTP real sobre PostgreSQL. PNG 1080×1920, MIME/cabeçalhos, novo filename `last-track-standing-<uuid>.png`, campeã/artista/tema/URL canônica, títulos/artistas de 200 caracteres, inspeção visual e partida ativa recusada.                                                                                                                                            | As partidas são fixtures concluídas; a imagem é gerada pelo endpoint real. A URL histórica `/api/resultados/<uuid>/imagem` permanece válida.                                                                                                        |
| 03-3 | E2E HTTP dos manifests e links de metadata; ofertas pública/admin, adiamento e instruções iOS.                                                                                                                                                                                                                                                                                                                      | Público continua sem `id` explícito, start/scope `/`; admin id/start/scope `/admin`. Evento de instalação sintético e UA iOS em Chromium validam a oferta, não instalação nativa.                                                                   |
| 03-4 | SW v3 exato da base → v4 no Chromium. Cache antigo reconhecido removido; cache de outra aplicação preservado; ícones públicos/admin e fallback novos comparados com bytes HTTP atuais.                                                                                                                                                                                                                              | Proxy exclusivo de QA fornece assets/fallback antigos controlados; SW e Cache Storage são reais. Prefixo técnico `jogo-da-musica-` preservado.                                                                                                      |
| 03-5 | Cache Storage inspecionado após páginas/APIs administrativas autenticadas GET/POST 200; ausentes do cache. Negativas VM incluem API/admin/YouTube e POST. Navegação offline usa fallback atual; API/admin permanecem dependentes da rede; retorno online abre login real.                                                                                                                                           | Tentativa browser de YouTube é controlada por CSP/interceptação; não prova reprodução/rede externa do provedor.                                                                                                                                     |
| 03-6 | Ofertas, manifests e atualização do SW exercitados localmente.                                                                                                                                                                                                                                                                                                                                                      | Instalação nova e upgrade nativos em Chrome/Edge desktop, Android Chrome e iOS Safari continuam pendentes. Registrar versões, resultado público/admin, nome/ícone e limitações de atualização quando executados.                                    |

## Evidências e gates

Pacote local preservado fora da worktree:
`D:/Jogo da música/tmp/agent-dispatch/20261011/lts03/`.
O handoff do checkpoint e seu manifesto de hashes registram o SHA, comandos,
exit codes e estado dos gates; consultar esse objeto fixo antes da revisão.

`tests/integration/lts03-result-image.test.ts` exercita o handler real;
`tests/unit/lts03-service-worker.test.ts` executa o script real na VM;
`tests/e2e/lts03-pwa.spec.ts` testa manifests/ofertas e auth negativa no navegador.
As jornadas positivas e o upgrade de SW têm harnesses e capturas no pacote local.
Foco por teclado e viewports são provas delimitadas; zoom nativo, leitor de tela,
AA e Release A exigem sua QA própria.

As primeiras execuções completas perderam workers por OOM nativo. Logs e
capacidade do host foram retidos. Na janela coordenada, a suíte serial passou:
581 testes em 71 arquivos, além dos 16 testes de segurança. O E2E completo
executou 149 cenários: 144 passaram e cinco apontaram raios de controles de
18 px, introduzidos neste lote. As classes foram restauradas para o contrato
local de 12–14 px; as assertions foram preservadas. A conferência posterior de
51 cenários administrativos, PWA e visuais passou, incluindo os cinco corrigidos.
As falhas anteriores e suas capturas continuam disponíveis no pacote local.

## Integração e recuperação

PM coordena a composição após OPS-02: sincronização normal com a master
qualificada, revisão do objeto composto e provas proporcionais no runtime
atualizado. Provas desta base são históricas após essa mudança.
Integração de código não declara instalações nativas, AA, Release A ou deploy.

Em recuperação, reverter o commit LTS-03 por operação normal e coordenada.
Uma nova alteração de SW usa versão posterior para renovar o cache reconhecido;
evitar reutilizar uma versão já instalada. Não há migration ou mudança de
identidade de PWA neste lote.
