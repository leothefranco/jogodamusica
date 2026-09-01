import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createThemeAction } from "@/app/admin/(protected)/temas/actions";
import { ThemeForm } from "@/components/admin/theme-form";

export default function NewThemePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/admin/temas"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-white/55 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar aos temas
      </Link>

      <div className="mt-7">
        <p className="text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
          Novo conteúdo
        </p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
          Criar tema
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/48">
          O tema começa como rascunho. Depois de salvar, você poderá adicionar
          as músicas e validar a publicação.
        </p>
      </div>

      <section className="mt-9 rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-7">
        <ThemeForm
          action={createThemeAction}
          mode="create"
          submitLabel="Criar tema"
        />
      </section>
    </main>
  );
}
