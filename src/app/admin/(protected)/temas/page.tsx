import Link from "next/link";
import { Disc3, Pencil, Plus } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { SupportedGameModes } from "@/components/admin/supported-game-modes";
import { ThemeStateStatus } from "@/components/admin/theme-state-status";
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
          <p className="text-xs font-bold tracking-[0.2em] text-[var(--duel-a)] uppercase">
            Conteúdo
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            Temas
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--app-muted)]">
            Prepare coleções e publique com pelo menos quatro Entradas jogáveis.
            A intenção editorial permanece separada da saúde do catálogo.
          </p>
        </div>

        <Link
          href="/admin/temas/novo"
          className={cn(
            buttonVariants({ size: "lg" }),
            "min-h-11 rounded-md px-5",
          )}
        >
          <Plus aria-hidden="true" />
          Novo tema
        </Link>
      </div>

      {query.message ? (
        <div
          role="status"
          className="mt-7 rounded-md border border-emerald-300/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100"
        >
          {query.message}
        </div>
      ) : null}

      {themeItems.length === 0 ? (
        <section className="mt-10 rounded-md border border-dashed border-white/10 px-6 py-16 text-center">
          <Disc3
            className="mx-auto size-9 text-[var(--duel-a)]"
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
              theme.state.counts.playableCount,
            );

            return (
              <article
                key={theme.id}
                className="rounded-md border border-white/8 bg-[var(--app-surface)] p-5 sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {theme.editorialState === "draft" && canPublish ? (
                        <span className="text-xs font-semibold text-[var(--duel-a)]">
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
                      "min-h-11 min-w-11 rounded-md border-white/10 bg-white/[0.025]",
                    )}
                    aria-label={`Editar ${theme.name}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Link>
                </div>

                <div className="mt-7">
                  <ThemeStateStatus state={theme.state} />
                </div>
                <div className="mt-4">
                  <SupportedGameModes modes={theme.state.modes} />
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
