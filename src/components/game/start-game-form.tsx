"use client";

import { LoaderCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { roundCountFromBracketSize } from "@/domain/bracket";
import { type BracketSize } from "@/domain/music/content-validation";

type StartGameFormProps = {
  themeId: string;
  activeSongCount: number;
  supportedBracketSizes: BracketSize[];
};

export function StartGameForm({
  themeId,
  activeSongCount,
  supportedBracketSizes,
}: StartGameFormProps) {
  const router = useRouter();
  const [bracketSize, setBracketSize] = useState<BracketSize | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  async function startGame() {
    if (bracketSize === null) {
      setError("Escolha uma modalidade antes de iniciar.");
      return;
    }

    setError(null);
    setIsStarting(true);

    try {
      const response = await fetch("/api/games", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ themeId, bracketSize }),
      });
      const payload = (await response.json()) as {
        url?: string;
        error?: { message?: string };
      };
      if (!response.ok || !payload.url) {
        throw new Error(
          payload.error?.message ?? "Não foi possível iniciar a partida.",
        );
      }
      router.push(payload.url);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível iniciar a partida.",
      );
      setIsStarting(false);
    }
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5 sm:p-7">
      <fieldset>
        <legend className="text-lg font-bold">Quantas rodadas?</legend>
        <p className="mt-2 text-sm leading-6 text-white/55">
          O tema tem {activeSongCount} músicas disponíveis. A partida sorteia
          somente a quantidade escolhida.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {supportedBracketSizes.map((size) => (
            <label
              key={size}
              className="flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 transition-colors has-checked:border-violet-300/60 has-checked:bg-violet-400/10"
            >
              <input
                type="radio"
                name="bracketSize"
                value={size}
                checked={bracketSize === size}
                onChange={() => setBracketSize(size)}
                className="size-4 accent-violet-300"
              />
              <span className="font-semibold">
                {roundCountFromBracketSize(size)} rodadas
                <span className="block text-sm font-normal text-white/50">
                  {size} músicas
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button
        type="button"
        size="lg"
        onClick={startGame}
        disabled={isStarting || bracketSize === null}
        className="mt-6 min-h-12 w-full rounded-xl bg-violet-300 font-bold text-[#160d25] hover:bg-violet-200"
      >
        {isStarting ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <Play aria-hidden="true" />
        )}
        {isStarting
          ? "Preparando chave..."
          : bracketSize === null
            ? "Escolha uma modalidade"
            : "Iniciar partida"}
      </Button>
      {error ? (
        <p className="mt-3 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
