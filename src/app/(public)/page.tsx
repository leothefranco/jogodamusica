import {
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
import { getPublicThemes } from "@/server/services/public-theme-service";

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

export default async function HomePage() {
  const themes = await getPublicThemes();

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
        className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:pt-24"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-2 text-xs font-medium text-violet-200">
            <Swords className="size-4" aria-hidden="true" />
            Uma disputa. Um aparelho. Uma campeã.
          </div>
          <h1 className="mt-7 max-w-4xl text-[clamp(3.4rem,11vw,7rem)] leading-[0.88] font-black tracking-[-0.065em] text-balance">
            Qual música
            <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-200 bg-clip-text pb-2 text-transparent">
              vence a noite?
            </span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-white/58">
            Reúna a galera, compare duas músicas por vez e descubra a favorita
            do grupo.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href="#temas"
              className={cn(
                buttonVariants({ size: "lg" }),
                "min-h-12 rounded-xl bg-violet-300 px-5 font-bold text-[#130d22] hover:bg-violet-200",
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

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-[0_30px_100px_rgba(0,0,0,.45)]">
          <p className="text-xs font-bold tracking-[0.18em] text-violet-300 uppercase">
            Como funciona
          </p>
          <ol className="mt-5 space-y-3">
            {gameSteps.map(({ icon: Icon, title, description }, index) => (
              <li
                key={title}
                className="flex gap-4 rounded-2xl border border-white/8 bg-black/20 p-4"
              >
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-violet-300/10 text-violet-200">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="font-bold">
                    <span className="mr-2 text-white/25">0{index + 1}</span>
                    {title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-white/45">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        id="temas"
        aria-labelledby="titulo-temas"
        className="border-t border-white/8 bg-white/[0.018]"
      >
        <div className="mx-auto w-full max-w-7xl px-5 py-16 sm:px-8 lg:px-10">
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
                    className="aspect-[16/9]"
                  />
                  <div className="p-5">
                    <h3 className="text-xl font-bold">{theme.name}</h3>
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
