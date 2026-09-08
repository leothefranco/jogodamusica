import {
  ArrowUpRight,
  AudioLines,
  Check,
  CirclePlay,
  Crown,
  Headphones,
  Swords,
} from "lucide-react";
import Link from "next/link";

import { ThemeThumbnailStack } from "@/components/theme-thumbnail-stack";
import { buttonVariants } from "@/components/ui/button";
import { countLabel } from "@/lib/language";
import { cn } from "@/lib/utils";
import type { PublicTheme } from "@/server/services/public-theme-service";

const gameSteps = [
  {
    icon: Headphones,
    title: "Escolha um tema",
    description: "Encontre a disputa que combina com a sua turma.",
  },
  {
    icon: CirclePlay,
    title: "Ouça e compare",
    description: "Inicie os dois trechos e decida quem avança.",
  },
  {
    icon: Crown,
    title: "Eleja a campeã",
    description: "Siga pelo chaveamento até a grande final.",
  },
] as const;

function Brand() {
  return (
    <span className="flex items-center gap-3 font-bold">
      <span className="grid size-10 place-items-center rounded-xl border border-violet-300/25 bg-violet-400/10 text-violet-200">
        <AudioLines className="size-5" aria-hidden="true" />
      </span>
      Jogo da <span className="-ml-2 text-violet-300">Música</span>
    </span>
  );
}

export function HomeExperience({ themes }: { themes: PublicTheme[] }) {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#08080f] text-white">
      <div className="grid-fade pointer-events-none absolute inset-0 -z-20 opacity-45" />
      <div className="pointer-events-none absolute -top-48 left-1/2 -z-10 size-[42rem] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[120px]" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a
          href="#inicio"
          className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          aria-label="Jogo da Música — início"
        >
          <Brand />
        </a>
        <a
          href="#temas"
          className="inline-flex min-h-11 items-center rounded-full border border-white/10 bg-white/[0.035] px-4 text-xs font-semibold text-white/65 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
        >
          Escolher tema
        </a>
      </header>

      <section
        id="inicio"
        className="mx-auto grid w-full max-w-7xl items-center gap-10 px-5 pt-8 pb-10 sm:px-8 sm:pt-14 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:pt-16 lg:pb-16"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-2 text-xs font-medium text-violet-200">
            <Swords className="size-4" aria-hidden="true" />
            Uma disputa. Um aparelho. Uma campeã.
          </div>
          <h1 className="mt-7 max-w-4xl text-[clamp(3.2rem,10vw,6.5rem)] leading-[0.88] font-black tracking-[-0.065em] text-balance">
            Qual música
            <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-200 bg-clip-text pb-2 text-transparent">
              vence a noite?
            </span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/65 sm:text-lg">
            Reúna a galera, compare duas músicas por vez e descubra a favorita
            do grupo.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#temas"
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-h-14 rounded-2xl bg-violet-300 px-7 font-bold text-[#130d22] hover:bg-violet-200",
              )}
            >
              Escolher um tema
              <Crown data-icon="inline-end" aria-hidden="true" />
            </a>
            <span className="flex items-center gap-2 text-xs text-white/45">
              <Check className="size-4 text-emerald-300" aria-hidden="true" />
              Sem cadastro para jogar
            </span>
          </div>
        </div>

        <div
          className="relative hidden min-h-[390px] items-center justify-center overflow-hidden rounded-[2rem] border border-violet-200/15 bg-[#141024] p-8 sm:flex"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(167,139,250,.3),transparent_65%)]" />
          <div className="absolute top-6 right-6 left-6 flex justify-between text-[10px] font-bold tracking-[.2em] text-violet-200/70 uppercase">
            <span>Aumente o som</span>
            <AudioLines className="size-4" />
          </div>
          <div className="relative grid size-64 rotate-[-12deg] place-items-center rounded-full border border-white/10 bg-[repeating-radial-gradient(circle,#14131b_0px,#14131b_3px,#282330_4px,#14131b_5px)] shadow-[0_24px_60px_#0008]">
            <div className="grid size-28 place-items-center rounded-full bg-violet-300 text-[#21143d]">
              <Crown className="size-12" strokeWidth={1.4} />
            </div>
          </div>
          <div className="absolute right-5 bottom-6 left-5 rounded-2xl border border-white/15 bg-[#211a34]/95 px-5 py-4">
            <p className="text-xs text-violet-200">
              A playlist é o ponto de partida.
            </p>
            <p className="mt-1 text-xl font-black tracking-tight">
              A campeã? Vocês decidem.
            </p>
          </div>
        </div>
      </section>

      <section
        aria-label="Como funciona"
        className="mx-auto grid max-w-7xl gap-5 px-5 pb-10 sm:grid-cols-3 sm:px-8 lg:px-10"
      >
        {gameSteps.map(({ icon: Icon, title, description }, index) => (
          <div
            key={title}
            className="flex items-start gap-3 border-t border-white/10 pt-4"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-violet-300/10 text-violet-200">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-bold">
                <span className="mr-2 text-violet-300/60">0{index + 1}</span>
                {title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/55">
                {description}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section
        id="temas"
        aria-labelledby="titulo-temas"
        className="border-t border-white/8 bg-white/[0.018]"
      >
        <div className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
          <p className="text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
            Escolha a disputa
          </p>
          <h2
            id="titulo-temas"
            className="mt-2 text-3xl font-black tracking-tight sm:text-4xl"
          >
            Temas disponíveis
          </h2>

          {themes.length ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {themes.map((theme) => (
                <Link
                  key={theme.id}
                  href={`/tema/${theme.slug}`}
                  className="group overflow-hidden rounded-3xl border border-white/10 bg-[#0e0e19] transition outline-none hover:-translate-y-1 hover:border-violet-300/35 focus-visible:ring-2 focus-visible:ring-violet-300 motion-reduce:transform-none"
                >
                  <ThemeThumbnailStack
                    thumbnailUrls={theme.thumbnailUrls}
                    fallbackCoverUrl={theme.coverUrl}
                    className="aspect-[16/10]"
                  />
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-xl font-bold">{theme.name}</h3>
                      <ArrowUpRight
                        className="size-5 shrink-0 text-violet-300 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transform-none"
                        aria-hidden="true"
                      />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-white/50">
                      {theme.description ??
                        "Uma chave musical pronta para jogar."}
                    </p>
                    <p className="mt-5 text-xs font-semibold text-violet-200">
                      {theme.activeSongCount} músicas ·{" "}
                      {countLabel(
                        theme.supportedBracketSizes.length,
                        "modalidade",
                      )}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="mt-8 rounded-3xl border border-dashed border-white/15 p-8 text-center text-white/55">
              Ainda não há temas publicados. Volte em breve.
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-white/8 px-5 py-6 text-center text-xs text-white/35">
        Jogo da Música · escolha, compare e coroe uma campeã
      </footer>
    </main>
  );
}
