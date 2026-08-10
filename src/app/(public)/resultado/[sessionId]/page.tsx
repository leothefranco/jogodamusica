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
    <main className="relative min-h-screen overflow-hidden bg-[#08080f] px-5 py-10 text-white sm:px-8">
      <div className="grid-fade pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative mx-auto max-w-5xl">
        <section className="text-center">
          <span className="mx-auto grid size-16 place-items-center rounded-2xl border border-amber-200/25 bg-amber-200/10 text-amber-200">
            <Trophy className="size-8" aria-hidden="true" />
          </span>
          <p className="mt-5 text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
            Campeã de {state.theme.name}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight text-balance sm:text-6xl">
            {champion.title}
          </h1>
          <p className="mt-3 text-lg text-white/55">{champion.artist}</p>
          <div className="mx-auto mt-7 aspect-video max-w-2xl overflow-hidden rounded-3xl border border-amber-200/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={champion.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </section>

        <section
          className="mx-auto mt-12 max-w-4xl rounded-3xl border border-violet-300/15 bg-violet-300/[0.045] p-5 sm:p-7"
          aria-labelledby="imagem-do-resultado"
        >
          <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_260px]">
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-violet-300 uppercase">
                Pronta para compartilhar
              </p>
              <h2
                id="imagem-do-resultado"
                className="mt-3 text-2xl font-black sm:text-3xl"
              >
                Sua campeã virou uma história
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/55 sm:text-base">
                Geramos uma imagem vertical para Stories e Status com o tema, a
                música vencedora e o endereço do Jogo da Música.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <a
                  href={`/api/resultados/${sessionId}/imagem?download=1`}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "min-h-12 rounded-xl bg-violet-300 px-5 font-bold text-[#160d25] hover:bg-violet-200",
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
                    "min-h-12 rounded-xl px-5",
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
              className="group mx-auto block w-full max-w-[260px] overflow-hidden rounded-2xl border border-white/10 bg-black/25 shadow-2xl shadow-violet-950/40 outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
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
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                >
                  <p className="text-xs font-semibold text-violet-300">
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
                        "mt-3 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm",
                        song?.songId === match.winnerSongId
                          ? "bg-emerald-300/10 font-bold text-emerald-100"
                          : "bg-black/20 text-white/55",
                      )}
                    >
                      <span>
                        {song ? `${song.title} — ${song.artist}` : "—"}
                      </span>
                      {song?.songId === match.winnerSongId ? (
                        <>
                          <span className="sr-only">Vencedora</span>
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
              "min-h-12 rounded-xl bg-violet-300 px-5 font-bold text-[#160d25] hover:bg-violet-200",
            )}
          >
            <RotateCcw aria-hidden="true" />
            Jogar novamente
          </Link>
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "min-h-12 rounded-xl px-5",
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
