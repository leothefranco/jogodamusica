import {
  AudioLines,
  Check,
  CirclePlay,
  Crown,
  Headphones,
  Swords,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const gameSteps = [
  {
    icon: Headphones,
    number: "01",
    title: "Escolha um tema",
    description: "Do rock nacional aos clássicos da festa.",
  },
  {
    icon: CirclePlay,
    number: "02",
    title: "Ouça e compare",
    description: "Dois trechos, uma decisão por confronto.",
  },
  {
    icon: Crown,
    number: "03",
    title: "Eleja a campeã",
    description: "Avance pelo chaveamento até a grande final.",
  },
] as const;

function BrandMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 place-items-center rounded-xl border border-violet-300/25 bg-violet-400/10 text-violet-200 shadow-[0_0_28px_rgba(139,92,246,0.18)]"
    >
      <AudioLines className="size-5" strokeWidth={2.25} />
    </span>
  );
}

function BracketPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-[34rem]"
      aria-label="Prévia ilustrativa de um chaveamento musical"
    >
      <div className="absolute inset-x-8 top-10 h-40 rounded-full bg-violet-500/20 blur-3xl" />
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d0d18]/90 p-4 shadow-[0_28px_90px_rgba(0,0,0,0.48)] backdrop-blur sm:p-6">
        <div className="mb-5 flex items-center justify-between border-b border-white/8 pb-4">
          <div>
            <p className="text-[0.65rem] font-semibold tracking-[0.22em] text-violet-300 uppercase">
              Agora jogando
            </p>
            <p className="mt-1 text-sm font-semibold text-white">
              Hinos que todo mundo canta
            </p>
          </div>
          <span className="rounded-full border border-emerald-300/20 bg-emerald-300/8 px-3 py-1 text-[0.65rem] font-semibold text-emerald-200">
            Semifinal
          </span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
          <div className="group rounded-2xl border border-violet-300/30 bg-gradient-to-b from-violet-400/15 to-transparent p-3 sm:p-4">
            <div className="mb-4 flex aspect-square items-end overflow-hidden rounded-xl bg-[radial-gradient(circle_at_32%_25%,rgba(167,139,250,.55),transparent_32%),linear-gradient(145deg,#25194a,#121225_70%)] p-3">
              <div className="flex h-10 items-end gap-1">
                {[45, 75, 52, 90, 64, 38, 70].map((height, index) => (
                  <span
                    // This deterministic illustration is decorative.
                    key={`${height}-${index}`}
                    className="wave-bar w-1 rounded-full bg-violet-200/80"
                    style={{
                      height: `${height}%`,
                      animationDelay: `${index * 90}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
            <p className="truncate text-sm font-semibold text-white">
              Música A
            </p>
            <p className="mt-1 text-xs text-white/48">Artista</p>
          </div>

          <span className="grid size-8 place-items-center rounded-full border border-white/10 bg-white/5 text-[0.65rem] font-black text-white/55">
            VS
          </span>

          <div className="rounded-2xl border border-cyan-300/20 bg-gradient-to-b from-cyan-400/10 to-transparent p-3 sm:p-4">
            <div className="mb-4 grid aspect-square place-items-center overflow-hidden rounded-xl bg-[radial-gradient(circle_at_70%_30%,rgba(103,232,249,.4),transparent_30%),linear-gradient(145deg,#103542,#111522_70%)]">
              <div className="relative grid size-16 place-items-center rounded-full border border-cyan-100/20 bg-black/20">
                <CirclePlay className="size-7 text-cyan-100/75" />
                <span className="absolute inset-2 rounded-full border border-dashed border-cyan-100/15" />
              </div>
            </div>
            <p className="truncate text-sm font-semibold text-white">
              Música B
            </p>
            <p className="mt-1 text-xs text-white/48">Artista</p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/7">
            <div className="h-full w-2/3 rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400" />
          </div>
          <span className="text-[0.65rem] font-medium text-white/45">
            4 / 7
          </span>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className="relative isolate flex min-h-screen flex-col overflow-hidden bg-[#08080f] text-white">
      <div className="grid-fade pointer-events-none absolute inset-0 -z-20 opacity-45" />
      <div className="pointer-events-none absolute -top-44 left-1/2 -z-10 size-[34rem] -translate-x-1/2 rounded-full bg-violet-600/18 blur-[110px] sm:size-[48rem]" />
      <div className="pointer-events-none absolute top-[30rem] -right-64 -z-10 size-[30rem] rounded-full bg-cyan-500/8 blur-[120px]" />

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a
          href="#inicio"
          className="flex min-h-11 items-center gap-3 rounded-xl pr-3 outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
          aria-label="Jogo da Música — início"
        >
          <BrandMark />
          <span className="text-sm font-bold tracking-tight sm:text-base">
            Jogo da <span className="text-violet-300">Música</span>
          </span>
        </a>

        <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 text-[0.65rem] font-semibold tracking-[0.16em] text-white/55 uppercase">
          <span className="size-1.5 rounded-full bg-amber-300 shadow-[0_0_9px_rgba(252,211,77,.7)]" />
          MVP em construção
        </span>
      </header>

      <section
        id="inicio"
        className="mx-auto grid w-full max-w-7xl flex-1 items-center gap-14 px-5 pt-12 pb-20 sm:px-8 sm:pt-16 lg:grid-cols-[1.03fr_.97fr] lg:gap-8 lg:px-10 lg:pt-12 lg:pb-24"
      >
        <div className="max-w-2xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-300/15 bg-violet-300/[0.06] px-3 py-2 text-xs font-medium text-violet-200">
            <Swords className="size-3.5" aria-hidden="true" />
            Uma disputa. Um aparelho. Uma campeã.
          </div>

          <h1 className="text-[clamp(3.15rem,12vw,6.8rem)] leading-[0.88] font-black tracking-[-0.065em] text-balance">
            Qual música
            <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-200 bg-clip-text pb-2 text-transparent">
              vence a noite?
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-pretty text-white/58 sm:text-lg sm:leading-8">
            Reúna a galera, escolha um tema e decida confronto por confronto até
            coroar a música favorita do grupo.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              disabled
              className="min-h-12 rounded-xl bg-violet-400 px-5 text-sm font-bold text-[#130d22] opacity-100 shadow-[0_12px_35px_rgba(139,92,246,.24)] disabled:opacity-100"
            >
              Temas em breve
              <Crown data-icon="inline-end" />
            </Button>
            <p className="flex min-h-11 items-center gap-2 text-xs text-white/42">
              <Check className="size-4 text-emerald-300" aria-hidden="true" />
              Sem cadastro para jogar
            </p>
          </div>
        </div>

        <BracketPreview />
      </section>

      <section
        aria-labelledby="como-funciona"
        className="border-t border-white/8 bg-white/[0.018]"
      >
        <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
          <div className="mb-8 flex items-end justify-between gap-8">
            <div>
              <p className="text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
                Ritmo da partida
              </p>
              <h2
                id="como-funciona"
                className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl"
              >
                Simples de começar. Difícil de escolher.
              </h2>
            </div>
            <span className="hidden text-xs text-white/35 sm:block">
              Jogue em um único aparelho
            </span>
          </div>

          <ol className="grid gap-px overflow-hidden rounded-2xl border border-white/8 bg-white/8 md:grid-cols-3">
            {gameSteps.map(({ icon: Icon, number, title, description }) => (
              <li
                key={number}
                className="group relative bg-[#0b0b14] p-6 transition-colors hover:bg-[#10101d] sm:p-7"
              >
                <div className="mb-8 flex items-start justify-between">
                  <span className="grid size-10 place-items-center rounded-xl border border-white/8 bg-white/[0.035] text-violet-200">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="font-mono text-xs text-white/25">
                    {number}
                  </span>
                </div>
                <h3 className="font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/45">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-white/8 px-5 py-6 text-center text-xs text-white/35">
        Jogo da Música · Fundação do MVP
      </footer>
    </main>
  );
}
