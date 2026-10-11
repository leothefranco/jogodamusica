# OPS-02 — patches das dependências de produção

Em 11/10/2026, o primeiro gate canônico real encontrou uma crítica e três altas
em Next 16.3.3, sharp 0.35.3, fast-uri 3.1.6 e source-map-js 1.2.1. O audit
bloqueou a execução. O resultado verde do CI anterior não incluía essa auditoria.

## Remediação mínima compatível

| Pacote                    | Versão corrigida           | Fonte e motivo                                                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next e eslint-config-next | 16.3.8, pins exatos iguais | [Release oficial](https://github.com/vercel/next.js/releases/tag/v16.3.8): cobre o [crítico next/og](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j) corrigido em 16.3.6 e o [alto SSRF](https://github.com/advisories/GHSA-cjq9-62q9-8jv4) corrigido em 16.3.8, além das correções moderadas da release.               |
| sharp                     | 0.35.5                     | Dentro de `^0.35.4` do Next corrigido. Cobre [libheif](https://github.com/lovell/sharp/security/advisories/GHSA-rgj7-g3m4-5g8c) e [librsvg](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), com binários 0.35.5 e libvips 1.3.4 correspondentes.                                                                         |
| fast-uri                  | 3.1.8                      | Dentro de `^3.0.1` do AJV, incluindo peers opcionais de produção. Cobre [qw65](https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3), [58mr](https://github.com/fastify/fast-uri/security/advisories/GHSA-58mr-gqgx-xq4g) e o [moderado hrr3](https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj). |
| source-map-js             | 1.2.2                      | Dentro de `^1.2.1` do PostCSS do Next e demais pais. Corrige [DoS](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), conforme a [release do mantenedor](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2).                                                                                                                           |

Next 16.3.8 e seu ESLint exigem os internos Next/SWC/plugin 16.3.8. Mantêm as
faixas compatíveis com Node 24.18.0, npm 11.16.0, React/React DOM 19.2.8, ESLint 9
e TypeScript 5 existentes. Não é necessário mudar para Next 16.4 nem atualizar
AJV, resolver, PostCSS, Tailwind ou APIs de produto. Metadados oficiais:
[Next](https://registry.npmjs.org/next/16.3.8),
[ESLint Next](https://registry.npmjs.org/eslint-config-next/16.3.8),
[sharp](https://registry.npmjs.org/sharp/0.35.5),
[fast-uri](https://registry.npmjs.org/fast-uri/3.1.8) e
[source-map-js](https://registry.npmjs.org/source-map-js/1.2.2).

O advisory mantenedor SSRF ainda contém o placeholder `16.3.?` na consulta;
GitHub Reviewed, release e registry corroboram 16.3.8. A versão sugerida
globalmente por `npm audit fix` não define o menor patch compatível.

## Proteção e verificação

O guard exige patch numérico >=8 na linha estável 16.3, pins Next/ESLint iguais,
manifesto, lock e instalação coerentes. Regressões executam sua CLI com versões
16.3.3–16.3.7 coerentes e exigem rejeição; 16.3.8 e patch numérico posterior são
aceitos. A resolução do lock usa somente os nomes necessários, sem lifecycle,
override incompatível, atualização ampla ou `audit fix --force`.

O aceite depende de `npm run gate` real no mesmo SHA em Windows e Linux, com
instalação imutável, dois builds, suítes descobertas automaticamente e auditoria
de produção atual. Evidência do schema registra versões instaladas, identidade,
severidades e resultados. A pesquisa e os testes de contrato não substituem essa
prova. Alta, crítica ou advisory indisponível bloqueiam; não existe waiver.

Os artefatos e resultados históricos REL-01 permanecem datados. Um rollback
precisa manter artefato comprovadamente corrigido, o piso atual e os dez checks;
não restaurar versões conhecidamente vulneráveis. Integração de código não
autoriza promoção manual, banco real ou cutover de produção.
