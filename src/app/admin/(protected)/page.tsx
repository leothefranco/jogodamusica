import { Database, ListMusic, ShieldCheck } from "lucide-react";

import { requireAdmin } from "@/server/auth/session";

const foundationItems = [
  {
    icon: Database,
    title: "Banco estruturado",
    description: "Tabelas, restrições e índices do MVP modelados com Drizzle.",
  },
  {
    icon: ShieldCheck,
    title: "Acesso protegido",
    description: "Sessão validada e perfil administrativo ativo obrigatório.",
  },
  {
    icon: ListMusic,
    title: "Conteúdo na próxima fase",
    description: "Temas e músicas serão gerenciados na Fase 2.",
  },
] as const;

export default async function AdminPage() {
  const admin = await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
        Painel administrativo
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
        Olá, {admin.displayName}.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-white/48">
        A fundação de dados e autenticação está pronta. O gerenciamento de temas
        e músicas entra na próxima fase.
      </p>

      <section
        aria-label="Estado da fundação"
        className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 md:grid-cols-3"
      >
        {foundationItems.map(({ icon: Icon, title, description }) => (
          <article key={title} className="bg-[#0d0d18] p-6 sm:p-7">
            <span className="grid size-10 place-items-center rounded-xl border border-white/8 bg-white/[0.04] text-violet-200">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <h2 className="mt-8 font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-white/42">
              {description}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
