import Link from "next/link";
import {
  CheckCircle2,
  CircleOff,
  Library,
  ListMusic,
  Plus,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { requireAdmin } from "@/server/auth/session";
import { getAdminThemes } from "@/server/services/theme-content-service";

export default async function AdminPage() {
  const [admin, themes] = await Promise.all([requireAdmin(), getAdminThemes()]);
  const publishedCount = themes.filter((theme) => theme.isActive).length;
  const songCount = themes.reduce(
    (total, theme) => total + theme.totalSongCount,
    0,
  );

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
        Painel administrativo
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-black tracking-[-0.04em] sm:text-5xl">
        Olá, {admin.displayName}.
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-7 text-white/48">
        Prepare temas, associe músicas do YouTube e publique coleções prontas
        para os futuros chaveamentos.
      </p>

      <div className="mt-7 flex flex-wrap gap-3">
        <Link
          href="/admin/temas"
          className={cn(
            buttonVariants({ size: "lg" }),
            "min-h-11 rounded-xl px-5",
          )}
        >
          <Library aria-hidden="true" />
          Gerenciar temas
        </Link>
        <Link
          href="/admin/temas/novo"
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            "min-h-11 rounded-xl border-white/10 bg-white/[0.025] px-5",
          )}
        >
          <Plus aria-hidden="true" />
          Novo tema
        </Link>
      </div>

      <section
        aria-label="Resumo do conteúdo"
        className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 md:grid-cols-3"
      >
        {[
          {
            icon: Library,
            value: themes.length,
            label: "temas cadastrados",
          },
          {
            icon: CheckCircle2,
            value: publishedCount,
            label: "temas publicados",
          },
          {
            icon: ListMusic,
            value: songCount,
            label: "associações de músicas",
          },
        ].map(({ icon: Icon, value, label }) => (
          <article key={label} className="bg-[#0d0d18] p-6 sm:p-7">
            <span className="grid size-10 place-items-center rounded-xl border border-white/8 bg-white/[0.04] text-violet-200">
              <Icon className="size-5" aria-hidden="true" />
            </span>
            <strong className="mt-8 block text-3xl font-black">{value}</strong>
            <p className="mt-1 text-sm leading-6 text-white/42">{label}</p>
          </article>
        ))}
      </section>

      {themes.length === 0 ? (
        <div className="mt-6 flex gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-5 text-sm text-white/45">
          <CircleOff className="size-5 shrink-0 text-violet-200" />
          Crie um tema para iniciar a preparação do conteúdo jogável.
        </div>
      ) : null}
    </main>
  );
}
