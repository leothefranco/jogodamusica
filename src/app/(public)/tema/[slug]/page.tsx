import { ArrowLeft, Music2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StartGameForm } from "@/components/game/start-game-form";
import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";
import { getPublicTheme } from "@/server/services/public-theme-service";

type ThemePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: ThemePageProps): Promise<Metadata> {
  const theme = await getPublicTheme((await params).slug);
  return theme
    ? { title: theme.name, description: theme.description }
    : { title: "Tema não encontrado" };
}

export default async function ThemePage({ params }: ThemePageProps) {
  const theme = await getPublicTheme((await params).slug);
  if (!theme) notFound();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] px-5 py-8 text-white sm:px-8">
      <div className="relative mx-auto max-w-6xl border-t-4 border-[var(--duel-a)]">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-[var(--app-muted)] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar aos temas
        </Link>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-none border-l-4 border-[var(--duel-a)] bg-[var(--app-surface)] px-3 py-2 text-xs font-semibold text-[var(--duel-a)]">
              <Music2 className="size-4" aria-hidden="true" />
              {theme.activeSongCount} músicas disponíveis
            </span>
            <h1 className="mt-5 font-['JDM_Anton'] text-5xl font-normal tracking-tight text-balance uppercase sm:text-6xl">
              {theme.name}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--app-muted)] sm:text-lg">
              {theme.description ??
                "Escolha o tamanho da chave e descubra a campeã deste tema."}
            </p>

            <ThemeThumbnailStack
              thumbnailUrls={theme.thumbnailUrls}
              fallbackCoverUrl={theme.coverUrl}
              className="mt-8 aspect-[16/9] max-w-2xl rounded-none border-r-4 border-l-4 border-r-[var(--duel-b)] border-l-[var(--duel-a)]"
            />
          </div>

          <StartGameForm
            themeId={theme.id}
            activeSongCount={theme.activeSongCount}
            supportedBracketSizes={theme.supportedBracketSizes}
          />
        </section>
      </div>
    </main>
  );
}
