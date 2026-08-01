import Link from "next/link";
import { CheckCircle2, CircleOff, Disc3, Pencil, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SupportedRounds } from "@/components/admin/supported-rounds";
import { getThemePublishability } from "@/domain/music/content-validation";
import { cn } from "@/lib/utils";
import { getAdminThemes } from "@/server/services/theme-content-service";

export default async function AdminThemesPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const [themeItems, query] = await Promise.all([
    getAdminThemes(),
    searchParams,
  ]);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
            Conteúdo
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            Temas
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/48">
            Prepare coleções, associe músicas do YouTube e publique somente
            quando o chaveamento estiver completo.
          </p>
        </div>

        <Link
          href="/admin/temas/novo"
          className={cn(
            buttonVariants({ size: "lg" }),
            "min-h-11 rounded-xl px-5",
          )}
        >
          <Plus aria-hidden="true" />
          Novo tema
        </Link>
      </div>

      {query.message ? (
        <div
          role="status"
          className="mt-7 rounded-xl border border-emerald-300/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100"
        >
          {query.message}
        </div>
      ) : null}

      {themeItems.length === 0 ? (
        <section className="mt-10 rounded-3xl border border-dashed border-white/10 px-6 py-16 text-center">
          <Disc3
            className="mx-auto size-9 text-violet-300"
            aria-hidden="true"
          />
          <h2 className="mt-5 text-xl font-bold">Nenhum tema criado</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
            Crie o primeiro tema e depois adicione vídeos para torná-lo jogável.
          </p>
        </section>
      ) : (
        <section
          aria-label="Temas cadastrados"
          className="mt-10 grid gap-4 lg:grid-cols-2"
        >
          {themeItems.map((theme) => {
            const { canPublish } = getThemePublishability(
              theme.activeSongCount,
            );

            return (
              <article
                key={theme.id}
                className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${
                          theme.isActive
                            ? "border-emerald-300/20 bg-emerald-400/8 text-emerald-200"
                            : "border-white/8 bg-white/[0.035] text-white/45"
                        }`}
                      >
                        {theme.isActive ? (
                          <CheckCircle2 className="size-3.5" />
                        ) : (
                          <CircleOff className="size-3.5" />
                        )}
                        {theme.isActive ? "Publicado" : "Rascunho"}
                      </span>
                      {!theme.isActive && canPublish ? (
                        <span className="text-xs font-semibold text-violet-200">
                          Pronto para publicar
                        </span>
                      ) : null}
                    </div>
                    <h2 className="mt-4 truncate text-xl font-black">
                      {theme.name}
                    </h2>
                    <p className="mt-1 truncate font-mono text-xs text-white/35">
                      /{theme.slug}
                    </p>
                  </div>

                  <Link
                    href={`/admin/temas/${theme.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "icon-lg" }),
                      "min-h-11 min-w-11 rounded-xl border-white/10 bg-white/[0.025]",
                    )}
                    aria-label={`Editar ${theme.name}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-white/8 text-center">
                  <div className="bg-black/25 px-3 py-4">
                    <strong className="block text-lg">
                      {theme.activeSongCount}
                    </strong>
                    <span className="text-[0.68rem] text-white/38">ativas</span>
                  </div>
                  <div className="bg-black/25 px-3 py-4">
                    <strong className="block text-lg">
                      {theme.totalSongCount}
                    </strong>
                    <span className="text-[0.68rem] text-white/38">total</span>
                  </div>
                </div>
                <div className="mt-4">
                  <SupportedRounds activeSongCount={theme.activeSongCount} />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
