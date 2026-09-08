import {
  ArrowLeft,
  Crown,
  Download,
  ExternalLink,
  RotateCcw,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { getRoundLabel } from "@/domain/game/experience";
import { projectCompletedGame } from "@/domain/game/projections";
import { cn } from "@/lib/utils";
import { getPublicGamePageState } from "../../game-page-state";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const state = await getPublicGamePageState(sessionId);

  if (state.session.status === "active") redirect(`/jogo/${sessionId}`);
  if (state.session.status === "abandoned")
    redirect(`/tema/${state.theme.slug}`);

  const result = projectCompletedGame(state);
  if (!result) notFound();
  const { champion } = result;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] px-5 py-10 text-white sm:px-8">
      <div className="relative mx-auto max-w-5xl">
        <section className="border-t-4 border-b-4 border-t-[var(--duel-a)] border-b-[var(--duel-b)] py-8 text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-none border border-white/25 bg-[var(--app-surface)] text-[var(--app-text)]">
            <Trophy className="size-8" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold tracking-[0.2em] text-[var(--duel-a)] uppercase">
            Campeã de {state.theme.name}
          </p>
          <h1 className="mt-3 font-['JDM_Anton'] text-5xl font-normal tracking-tight text-balance uppercase sm:text-6xl">
            {champion.title}
          </h1>
          <p className="mt-3 text-lg text-[var(--app-muted)]">
            {champion.artist}
          </p>
          <div className="mx-auto mt-7 aspect-video max-w-2xl overflow-hidden rounded-none border-r-4 border-l-4 border-r-[var(--duel-b)] border-l-[var(--duel-a)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={champion.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section
          className="mx-auto mt-12 max-w-4xl rounded-none border-t-4 border-[var(--duel-b)] bg-[var(--app-surface)] p-5 sm:p-7"
          aria-labelledby="imagem-do-resultado"
        >
          <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-[var(--duel-a)] uppercase">
                RESULTADO
              </p>
              <h2
                id="imagem-do-resultado"
                className="mt-3 text-2xl font-black sm:text-3xl"
              >
                Compartilhar a campeã
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--app-muted)] sm:text-base">
                Baixe a imagem para Stories e Status com o tema, a música
                vencedora e o endereço do Jogo da Música.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`/api/resultados/${sessionId}/imagem?download=1`}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "min-h-12 rounded-none bg-[var(--duel-a)] px-5 font-bold text-[var(--app-bg)] hover:brightness-110",
                  )}
                >
                  <Download aria-hidden="true" />
                  Baixar imagem
                </a>
                <a
                  href={`/api/resultados/${sessionId}/imagem`}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "outline", size: "lg" }),
                    "min-h-12 rounded-none px-5",
                  )}
                >
                  <ExternalLink aria-hidden="true" />
                  Abrir imagem
                </a>
              </div>
            </div>

            <a
              href={`/api/resultados/${sessionId}/imagem`}
              target="_blank"
              rel="noreferrer"
              className="group mx-auto block w-full max-w-[260px] overflow-hidden rounded-none border border-white/10 bg-black/25 shadow-xl outline-none focus-visible:ring-2 focus-visible:ring-white"
              aria-label="Abrir a imagem do resultado em tamanho completo"
            >
              {/* This is a same-origin generated image. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/resultados/${sessionId}/imagem`}
                alt={`Imagem compartilhável da campeã ${champion.title}`}
                className="aspect-[9/16] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
              />
            </a>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="chaveamento">
          <h2 id="chaveamento" className="text-2xl font-black">
            Chaveamento completo
          </h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {result.matches.map(({ match, songA, songB }) => {
              return (
                <article
                  key={match.id}
                  className="rounded-none border border-white/10 bg-white/[0.035] p-4"
                >
                  <p className="text-xs font-semibold text-[var(--duel-a)]">
                    {getRoundLabel({
                      bracketSize: state.session.bracketSize,
                      roundNumber: match.roundNumber,
                      matchPosition: match.position,
                    })}
                  </p>
                  {[songA, songB].map((song, index) => (
                    <p
                      key={song?.songId ?? index}
                      className={cn(
                        "mt-3 flex items-center justify-between gap-3 rounded-none border-l-4 px-3 py-2 text-sm",
                        index === 0
                          ? "border-l-[var(--duel-a)]"
                          : "border-l-[var(--duel-b)]",
                        song?.songId === match.winnerSongId
                          ? "bg-white/10 font-bold text-[var(--app-text)]"
                          : "bg-black/20 text-[var(--app-muted)]",
                      )}
                    >
                      <span>
                        {song ? `${song.title} — ${song.artist}` : "—"}
                      </span>
                      {song?.songId === match.winnerSongId ? (
                        <>
                          <span className="text-xs">Vencedora</span>
                          <Crown
                            className="size-4 shrink-0"
                            aria-hidden="true"
                          />
                        </>
                      ) : null}
                    </p>
                  ))}
                </article>
              );
            })}
          </div>
        </section>

        <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href={`/tema/${state.theme.slug}`}
            className={cn(
              buttonVariants({ size: "lg" }),
              "min-h-12 rounded-none bg-[var(--duel-a)] px-5 font-bold text-[var(--app-bg)] hover:brightness-110",
            )}
          >
            <RotateCcw aria-hidden="true" />
            Jogar novamente
          </Link>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-12 rounded-none px-5",
            )}
          >
            <ArrowLeft aria-hidden="true" />
            Voltar ao início
          </Link>
        </div>
      </div>
    </main>
  );
}
