<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Modelo dos agentes

Use `gpt-6-astra` para PM, supervisor, desenvolvedores e revisores deste projeto,
conforme escolha do usuário em 2026-09-07. Ao reativar tarefas ou delegar trabalho,
informe o modelo explicitamente e preserve o esforço de raciocínio compatível.
Em subagentes que herdam um contexto completo, deixe o modelo ser herdado de uma
sessão Astra. A troca de modelo preserva ownership, WIP e autoridades de cada tarefa.
