"use client";

import { LoaderCircle, Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { roundCountFromBracketSize } from "@/domain/bracket";
import { type BracketSize } from "@/domain/music/content-validation";

type StartGameFormProps = {
  themeId: string;
  activeSongCount: number;
  supportedBracketSizes: BracketSize[];
  modeGroups?: {
    primary: BracketSize[];
    quick: BracketSize[];
    extended: BracketSize[];
  };
};

export function StartGameForm({
  themeId,
  activeSongCount,
  supportedBracketSizes,
  modeGroups,
}: StartGameFormProps) {
  const router = useRouter();
  const [bracketSize, setBracketSize] = useState<BracketSize | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(
    null,
  );
  const errorId = useId();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const needsUpdatedModes = error?.code === "INSUFFICIENT_ACTIVE_SONGS";
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  const [isStarting, setIsStarting] = useState(false);
  const sections = modeGroups
    ? [
        { title: "Principais", sizes: modeGroups.primary },
        { title: "Rápidas", sizes: modeGroups.quick },
        { title: "Mais opções", sizes: modeGroups.extended },
      ]
    : [{ title: null, sizes: supportedBracketSizes }];

  async function startGame() {
    if (isStarting || needsUpdatedModes) return;
    if (bracketSize === null) {
      setError({ message: "Escolha uma modalidade antes de iniciar." });
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
        error?: { code?: string; message?: string };
      };
      if (!response.ok || !payload.url) {
        setError({
          code: payload.error?.code,
          message:
            payload.error?.message ?? "Não foi possível iniciar a partida.",
        });
        setIsStarting(false);
        return;
      }
      router.push(payload.url);
    } catch (caught) {
      setError({
        message:
          caught instanceof Error
            ? caught.message
            : "Não foi possível iniciar a partida.",
      });
      setIsStarting(false);
    }
  }

  return (
    <div className="rounded-2xl border-t-4 border-[var(--duel-b)] bg-[var(--app-surface)] p-5 sm:p-7">
      <fieldset disabled={isStarting || needsUpdatedModes}>
        <legend className="text-2xl font-black">Quantas rodadas?</legend>
        <p className="mt-2 text-sm leading-6 text-[var(--app-muted)]">
          O tema tem {activeSongCount} músicas disponíveis. A partida sorteia
          somente a quantidade escolhida.
        </p>
        {sections
          .filter((section) => section.sizes.length > 0)
          .map((section) => (
            <div
              key={section.title ?? "modalidades"}
              className="mt-5 grid gap-3 sm:grid-cols-2"
            >
              {section.title ? (
                <h3
                  className={
                    section.title === "Mais opções"
                      ? "text-sm text-white/55 sm:col-span-2"
                      : "font-semibold sm:col-span-2"
                  }
                >
                  {section.title}
                </h3>
              ) : null}
              {section.sizes.map((size) => (
                <label
                  key={size}
                  className="flex min-h-16 cursor-pointer items-center gap-3 rounded-md border border-white/10 bg-black/20 px-4 transition-colors has-checked:border-white has-checked:bg-white/10"
                >
                  <input
                    type="radio"
                    name="bracketSize"
                    value={size}
                    checked={bracketSize === size}
                    onChange={() => setBracketSize(size)}
                    className="size-4 accent-white"
                  />
                  <span className="font-semibold">
                    {roundCountFromBracketSize(size)} rodadas
                    <span className="block text-sm font-normal text-[var(--app-muted)]">
                      {size} músicas
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ))}
      </fieldset>

      <Button
        type="button"
        size="lg"
        onClick={startGame}
        disabled={isStarting || bracketSize === null || needsUpdatedModes}
        aria-describedby={error ? errorId : undefined}
        className="mt-6 min-h-12 w-full rounded-md bg-[var(--duel-b)] font-bold text-[var(--app-bg)] hover:bg-[var(--duel-b)] hover:brightness-110"
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
            : error?.code === "CATALOG_BUSY"
              ? "Tentar novamente"
              : "Iniciar partida"}
      </Button>
      {error ? (
        <div className="mt-3 space-y-3">
          <p
            ref={errorRef}
            id={errorId}
            tabIndex={-1}
            className="rounded-md text-sm leading-6 text-red-200"
            role="alert"
          >
            {error.message}
            {needsUpdatedModes
              ? " Atualize as modalidades e escolha novamente."
              : null}
          </p>
          {needsUpdatedModes ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-12 w-full"
              onClick={() => window.location.reload()}
            >
              Atualizar modalidades
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
