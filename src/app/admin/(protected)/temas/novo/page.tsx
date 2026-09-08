import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createThemeAction } from "@/app/admin/(protected)/temas/actions";
import { ThemeForm } from "@/components/admin/theme-form";

export default function NewThemePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/admin/temas"
        className="inline-flex min-h-11 items-center gap-2 rounded-md pr-3 text-sm font-semibold text-[var(--app-muted)] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-[var(--duel-a)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar aos temas
      </Link>

      <div className="mt-7">
        <p className="text-xs font-bold tracking-[0.2em] text-[var(--duel-a)] uppercase">
          Novo conteúdo
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
          Criar tema
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--app-muted)]">
          O tema começa como rascunho. Depois de salvar, você poderá adicionar
          as músicas e validar a publicação.
        </p>
      </div>

      <section className="mt-9 rounded-md border border-white/8 bg-[var(--app-surface)] p-5 sm:p-7">
        <ThemeForm
          action={createThemeAction}
          mode="create"
          submitLabel="Criar tema"
        />
      </section>
    </main>
  );
}
