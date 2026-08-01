import { ArrowLeft, Music2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StartGameForm } from "@/components/game/start-game-form";
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
    <main className="relative min-h-screen overflow-hidden bg-[#08080f] px-5 py-8 text-white sm:px-8">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-35" />
      <div className="relative mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm text-white/60 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar aos temas
        </Link>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem] lg:items-start">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-300/8 px-3 py-2 text-xs font-semibold text-violet-200">
              <Music2 className="size-4" aria-hidden="true" />
              {theme.activeSongCount} músicas disponíveis
            </span>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-balance sm:text-6xl">
              {theme.name}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/58 sm:text-lg">
              {theme.description ??
                "Escolha o tamanho da chave e descubra a campeã deste tema."}
            </p>

            <div
              className="mt-8 aspect-[16/9] max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_30%_20%,rgba(167,139,250,.32),transparent_34%),linear-gradient(145deg,#241543,#0d1823)]"
              aria-hidden="true"
            >
              {theme.coverUrl ? (
                // The URL is validated as HTTP(S) in the administrative flow.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={theme.coverUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-80"
                />
              ) : null}
            </div>
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
