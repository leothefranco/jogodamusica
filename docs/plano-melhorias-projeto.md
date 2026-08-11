# Plano de melhorias do projeto

Data da auditoria: 11 de agosto de 2026.

## Objetivo

Evoluir o Jogo da Música sem perder as garantias atuais de domínio, acessibilidade e atomicidade. O plano cobre UI, UX, design, performance, segurança, correção de bugs, arquitetura, testes e operação.

## Evidências coletadas

- `npm run lint`: aprovado em 58,2 s.
- `npm run typecheck`: aprovado em 50,3 s.
- `npm test`: 143 testes aprovados em 24 arquivos.
- `npm run build`: aprovado; 12 páginas estáticas geradas e rotas dinâmicas compiladas.
- Playwright: 12 testes E2E aprovados no Chromium.
- Verificação visual: home, login, offline, 404 e fluxo do jogo em 390×844 e 1280×800, sem overflow horizontal ou erro de console da aplicação.
- `npm run format:check`: bloqueado somente pelo arquivo não rastreado `docs/pesquisa-breakeven-publicacao.md`.
- `npm audit --omit=dev`: 5 vulnerabilidades de severidade alta (`fast-uri`, `nanoid`, `postcss` e `sharp`).

## Priorização

Escala usada:

- **P0**: bloqueia release ou expõe custo/segurança relevante.
- **P1**: alto impacto em correção, UX ou desempenho.
- **P2**: melhoria importante, mas pode entrar após os riscos principais.
- **P3**: evolução opcional ou dependente de dados de uso.

| Prioridade | Oportunidade                               | Evidência                                                                                                   | Resultado esperado                                                           |
| ---------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| P0         | Corrigir vulnerabilidades de produção      | `npm audit` encontrou 5 altas; parte exige atualizar o Next.js além de 16.2.11                              | `npm audit --omit=dev --audit-level=high` sem achados altos                  |
| P0         | Proteger mutações públicas contra abuso    | criação de partidas, decisões, abandono e telemetria não têm limitação compartilhada                        | limites por IP/capability, cotas e respostas 429 consistentes entre réplicas |
| P0         | Tornar erros de servidor observáveis       | `errorResponse` converte erro desconhecido em 500 sem registrar causa/correlação                            | logs estruturados, request ID, redaction e alerta para taxa de 5xx           |
| P1         | Evitar abandono acidental                  | “Abandonar partida” encerra a sessão permanentemente com um clique                                          | diálogo acessível, confirmação explícita e teste E2E                         |
| P1         | Substituir rate limit em memória           | `src/server/services/rate-limit.ts` usa `Map`, que reinicia e não é compartilhado na Vercel                 | adapter compartilhado e teste de concorrência/múltiplas instâncias           |
| P1         | Reduzir custo do estado da partida         | cada decisão devolve músicas e confrontos completos; o modo 128 cresce até 127 confrontos                   | medir payload/latência e aprofundar o read model da partida                  |
| P1         | Escalar a edição administrativa            | um tema com 183 músicas renderiza um formulário completo por música                                         | busca, filtros, paginação/virtualização e ações em lote                      |
| P1         | Cachear o catálogo público                 | home e tema chamam o banco a cada request via `connection()`                                                | Cache Components com tags e invalidação nas ações administrativas            |
| P1         | Controlar e otimizar imagens               | capas aceitam qualquer HTTP(S) e usam `<img>` sem otimização                                                | origem controlada, dimensões estáveis, `next/image`, `sizes` e fallback útil |
| P1         | Reforçar invariantes no banco              | `game_matches` não garante no banco que vencedora pertence ao confronto/sessão nem coerência status/data    | constraints/validações transacionais e testes de migração                    |
| P2         | Refinar linguagem pública e administrativa | “modalidade(s)”, “música(s)”, `admin_profiles` e “MVP” aparecem para usuários                               | pluralização natural e textos orientados à tarefa                            |
| P2         | Melhorar o convite de instalação PWA       | descarte vive só em memória e o convite pode reaparecer ou cobrir o jogo                                    | cooldown persistido e exibição apenas em momentos adequados                  |
| P2         | Melhorar cartões sem capa                  | cards reservam uma área grande apenas com gradiente                                                         | fallback editorial identificável e opção de capa no fluxo administrativo     |
| P2         | Validar contraste e descrições de erro     | há vários textos `white/35`–`white/50`; alguns erros de formulário não estão ligados por `aria-describedby` | WCAG 2.2 AA e zero achados axe sérios/críticos                               |
| P2         | Definir autorização por papel              | `admin` e `editor` existem, mas o papel não restringe ações                                                 | matriz de permissões e testes negativos por ação                             |
| P2         | Endurecer CSP                              | produção permite `'unsafe-inline'` em scripts                                                               | avaliar nonce/hashes e CSP em modo report-only antes de bloquear             |
| P2         | Privacidade do player                      | jogo carrega a IFrame API do domínio padrão do YouTube                                                      | avaliar `youtube-nocookie`, consentimento e política de privacidade          |
| P2         | Endurecer CI e cobertura                   | actions usam tags móveis; não há gate de audit, axe ou cobertura mínima                                     | actions fixadas por SHA, audit após correção e gates proporcionais ao risco  |
| P2         | Ampliar E2E para jornadas                  | E2E atual cobre profundamente o confronto, não home→tema→partida→resultado nem administração                | tracer tests dos fluxos público e administrativo                             |
| P3         | SEO e compartilhamento                     | não há sitemap/robots/OG específico para catálogo e temas                                                   | metadados sociais e indexação alinhada ao objetivo do produto                |
| P3         | Instrumentar funil e confiabilidade        | não há métricas de início, conclusão, erro de player ou abandono agregadas                                  | eventos sem dados pessoais, dashboards e alertas de SLO                      |

## Oportunidades arquiteturais

A varredura `Ask Matt` → `improve-codebase-architecture` encontrou quatro candidatos. O relatório visual está no diretório temporário do sistema, em `architecture-review-20260811-133442.html`.

1. **Strong — Transição do chaveamento transacional.** Concentrar as invariantes de decisão, Sorteio de rodada e aplicação atômica em um módulo mais profundo. É a principal recomendação por risco de concorrência e duplicação entre os adapters Drizzle e em memória.
2. **Strong — Jornada de decisão no cliente.** Aumentar a locality entre confirmação, submissão, timers, foco, Desempate e aplicação do novo estado.
3. **Worth exploring — Reprodução do confronto.** Fazer o módulo de reprodução possuir a coordenação A/B, falhas e regra de exclusão mútua, sem criar um seam hipotético de provedor.
4. **Worth exploring — Estado da partida.** Concentrar montagem, invariantes, transporte e projeções em um read model coerente para jogo e resultado.

As interfaces concretas devem ser desenhadas somente depois da escolha do candidato, conforme o fluxo da skill.

## Plano de implementação

### Fase 0 — Baseline e release blockers

Estimativa: 1–3 dias.

1. Corrigir a formatação pendente sem alterar o conteúdo da pesquisa.
2. Atualizar dependências em branch própria:
   - aplicar as correções compatíveis de `fast-uri` e `nanoid`;
   - atualizar Next.js para uma versão estável que traga `postcss` e `sharp` corrigidos;
   - ler a documentação local da nova versão antes de adaptar código;
   - executar format, lint, tipos, testes, build, E2E e smoke visual.
3. Adicionar proteção de abuso às mutações públicas e à telemetria:
   - escolher armazenamento compartilhado;
   - definir limites por rota e política de confiança em IP de proxy;
   - impedir crescimento ilimitado de sessões e logs;
   - responder com `Retry-After`.
4. Adicionar logging estruturado de falhas desconhecidas com redaction e ID de correlação.

Critério de saída: audit sem vulnerabilidade alta, todos os gates verdes e teste de rate limit entre duas instâncias/adapters.

### Fase 1 — Correção e UX de alto impacto

Estimativa: 2–4 dias.

1. Confirmar abandono em diálogo acessível e testar teclado/foco.
2. Trocar pluralizações mecânicas por helpers de linguagem.
3. Reescrever o login sem termos internos (`admin_profiles`, “MVP”).
4. Persistir o descarte do convite PWA e não mostrá-lo durante uma partida.
5. Melhorar fallback de capas e a seleção/preview de imagem no painel.
6. Ligar mensagens de erro aos campos e rodar axe nas páginas principais.

Critério de saída: fluxo completo por teclado, zero axe sério/crítico e aprovação visual em 320, 390, 768 e 1280 px.

### Fase 2 — Performance e privacidade

Estimativa: 3–6 dias.

1. Medir antes de alterar: payload de decisão nos modos 4/32/128, consultas por página, LCP/INP/CLS e bundle por rota.
2. Pilotar `cacheComponents: true` no catálogo público, com `use cache`, `cacheLife`, `cacheTag` e invalidação administrativa.
3. Restringir capas a origem controlada e migrar imagens elegíveis para `next/image` com `sizes`.
4. Tornar a lista administrativa escalável para centenas de músicas.
5. Avaliar o modo de privacidade aprimorada do YouTube e documentar cookies/terceiros.

Metas iniciais: LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1 no percentil 75; redução comprovada de consultas e payload sem regressão funcional.

### Fase 3 — Aprofundamento arquitetural

Estimativa: 1–2 semanas, dividida em tickets tracer-bullet.

1. Escolher um candidato do relatório visual; recomendação: Transição do chaveamento.
2. Executar `grill-with-docs` para fechar invariantes, compatibilidade e migração.
3. Desenhar alternativas com `codebase-design` antes de escolher a interface.
4. Implementar por TDD em fatias pequenas, preservando adapters e comportamento.
5. Adicionar constraints de banco somente com migração compatível e rollback definido.
6. Fazer `code-review` contra o commit fixo da fase.

Critério de saída: interface menor, invariantes com maior locality, menos duplicação nos testes e nenhuma alteração de comportamento não especificada.

### Fase 4 — Qualidade contínua e operação

Estimativa: 2–4 dias para o primeiro ciclo; depois recorrente.

1. Adicionar tracer E2E home→tema→partida→resultado e um fluxo administrativo crítico.
2. Definir cobertura mínima por módulos de domínio/servidor, sem usar porcentagem global como único sinal.
3. Fixar GitHub Actions por SHA e adicionar audit/axe aos gates após estabilizar os achados atuais.
4. Criar métricas de 5xx, latência, criação/conclusão/abandono e erros de player, sem dados pessoais.
5. Rodar revisão mensal de dependências e trimestral de arquitetura/UI.

Critério de saída: dashboards e alertas acionáveis, runbook atualizado e gates reproduzíveis localmente.

## Ordem sugerida dos tickets

1. Dependências vulneráveis.
2. Rate limit distribuído e proteção da criação de partidas.
3. Observabilidade de 5xx.
4. Confirmação de abandono.
5. Linguagem, acessibilidade e PWA.
6. Medição de payload/consultas/Core Web Vitals.
7. Cache do catálogo e pipeline de imagens.
8. Escalabilidade do painel de músicas.
9. Transição do chaveamento transacional.
10. Demais aprofundamentos arquiteturais, somente se as medições confirmarem retorno.

## Regra de execução

Cada ticket deve começar com um teste ou métrica que falha, terminar com os gates proporcionais ao risco e registrar antes/depois. Mudanças de segurança, banco, cache e arquitetura não devem ser misturadas no mesmo pull request.
