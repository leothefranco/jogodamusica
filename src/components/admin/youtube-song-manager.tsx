"use client";

import { FormEvent, useActionState, useState } from "react";
import { CheckCircle2, LoaderCircle, Plus, Search, Video } from "lucide-react";

import {
  initialContentActionState,
  type ContentActionState,
} from "@/components/admin/content-action-state";
import { adminInputClassName } from "@/components/admin/form-styles";
import { Button } from "@/components/ui/button";
import type { ProviderSearchResult } from "@/domain/music/provider";

type SelectedTrack = ProviderSearchResult & {
  embedUrl: string;
  watchUrl: string;
};

type ApiError = {
  error?: {
    message?: string;
  };
};

type SearchResponse = {
  data: SelectedTrack[];
};

type ResolveResponse = {
  data: SelectedTrack;
};

type YouTubeSongManagerProps = {
  action: (
    state: ContentActionState,
    formData: FormData,
  ) => Promise<ContentActionState>;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function YouTubeSongManager({ action }: YouTubeSongManagerProps) {
  const [actionState, formAction, actionPending] = useActionState(
    action,
    initialContentActionState,
  );
  const [query, setQuery] = useState("");
  const [manualInput, setManualInput] = useState("");
  const [results, setResults] = useState<SelectedTrack[]>([]);
  const [selected, setSelected] = useState<SelectedTrack | null>(null);
  const [loading, setLoading] = useState<"search" | "resolve" | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("search");
    setRequestError(null);
    setSelected(null);

    try {
      const response = await fetch(
        `/api/admin/youtube/search?q=${encodeURIComponent(query)}`,
      );
      const payload = (await response.json()) as SearchResponse & ApiError;
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Não foi possível pesquisar agora.",
        );
      }
      setResults(payload.data);
      if (payload.data.length === 0) {
        setRequestError("Nenhum vídeo encontrado para essa consulta.");
      }
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Não foi possível pesquisar agora.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function resolve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading("resolve");
    setRequestError(null);
    setSelected(null);

    try {
      const response = await fetch("/api/admin/youtube/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: manualInput }),
      });
      const payload = (await response.json()) as ResolveResponse & ApiError;
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Não foi possível resolver esse vídeo.",
        );
      }
      setSelected(payload.data);
    } catch (error) {
      setRequestError(
        error instanceof Error
          ? error.message
          : "Não foi possível resolver esse vídeo.",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-5 lg:grid-cols-2">
        <form
          onSubmit={search}
          className="rounded-2xl border border-white/8 bg-black/15 p-5"
        >
          <div className="grid gap-2 text-sm font-semibold">
            <label htmlFor="youtube-search-query">Pesquisar no YouTube</label>
            <div className="flex gap-2">
              <input
                id="youtube-search-query"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                minLength={2}
                maxLength={100}
                required
                placeholder="Artista ou música"
                className={adminInputClassName}
              />
              <Button
                type="submit"
                size="lg"
                disabled={loading !== null}
                className="min-h-11 rounded-xl px-4"
                aria-label="Pesquisar"
              >
                {loading === "search" ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Search />
                )}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/38">
            A pesquisa usa a cota da YouTube Data API somente no painel.
          </p>
        </form>

        <form
          onSubmit={resolve}
          className="rounded-2xl border border-white/8 bg-black/15 p-5"
        >
          <div className="grid gap-2 text-sm font-semibold">
            <label htmlFor="youtube-video-input">Colar URL ou ID</label>
            <div className="flex gap-2">
              <input
                id="youtube-video-input"
                value={manualInput}
                onChange={(event) => setManualInput(event.target.value)}
                required
                placeholder="https://youtu.be/... ou ID"
                className={adminInputClassName}
              />
              <Button
                type="submit"
                size="lg"
                disabled={loading !== null}
                className="min-h-11 rounded-xl px-4"
                aria-label="Resolver vídeo"
              >
                {loading === "resolve" ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Video />
                )}
              </Button>
            </div>
          </div>
          <p className="mt-3 text-xs leading-5 text-white/38">
            Alternativa direta para encontrar um vídeo específico.
          </p>
        </form>
      </div>

      {requestError ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-300/20 bg-amber-300/8 px-4 py-3 text-sm text-amber-100"
        >
          {requestError}
        </div>
      ) : null}

      {results.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-white/75">
            Resultados da pesquisa
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {results.map((track) => (
              <button
                key={track.providerContentId}
                type="button"
                onClick={() => setSelected(track)}
                className="min-h-24 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-left transition outline-none hover:border-violet-300/30 hover:bg-violet-400/5 focus-visible:ring-2 focus-visible:ring-violet-300"
              >
                <span className="line-clamp-2 text-sm font-bold">
                  {track.sourceTitle}
                </span>
                <span className="mt-2 block text-xs text-white/45">
                  {track.sourceChannel} ·{" "}
                  {formatDuration(track.durationSeconds)}
                </span>
                <span
                  className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${
                    track.isEmbeddable ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {track.isEmbeddable ? (
                    <CheckCircle2 className="size-3.5" />
                  ) : null}
                  {track.isEmbeddable
                    ? "Pode ser incorporado"
                    : "Incorporação bloqueada"}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {selected ? (
        <form
          key={selected.providerContentId}
          action={formAction}
          className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,32rem),1fr))] gap-6 rounded-2xl border border-violet-300/18 bg-violet-400/[0.045] p-5 sm:p-6"
        >
          <div className="min-w-0">
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              <iframe
                src={selected.embedUrl}
                title={`Prévia de ${selected.sourceTitle}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <p className="mt-3 text-sm font-bold break-words">
              {selected.sourceTitle}
            </p>
            <p className="mt-1 text-xs text-white/45">
              {selected.sourceChannel} ·{" "}
              {formatDuration(selected.durationSeconds)}
            </p>
          </div>

          <div className="min-w-0 space-y-4">
            {actionState.message ? (
              <div
                role="alert"
                className="rounded-xl border border-red-300/20 bg-red-400/8 px-4 py-3 text-sm text-red-100"
              >
                {actionState.message}
              </div>
            ) : null}

            <input
              type="hidden"
              name="providerContentId"
              value={selected.providerContentId}
            />
            <div className="grid items-start gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Título exibido
                <input
                  name="title"
                  defaultValue={selected.sourceTitle}
                  required
                  maxLength={200}
                  className={adminInputClassName}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Artista exibido
                <input
                  name="artist"
                  defaultValue={selected.sourceChannel}
                  required
                  maxLength={200}
                  className={adminInputClassName}
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold">
                Início do trecho (segundos)
                <input
                  name="startTimeSeconds"
                  type="number"
                  min={0}
                  max={selected.durationSeconds - 1}
                  defaultValue={0}
                  required
                  className={adminInputClassName}
                />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Duração do trecho (segundos)
                <input
                  name="previewDurationSeconds"
                  type="number"
                  min={1}
                  max={selected.durationSeconds}
                  defaultValue={selected.durationSeconds}
                  required
                  className={adminInputClassName}
                />
                <span className="text-xs leading-5 font-normal text-white/42">
                  A música inteira já vem selecionada. Reduza este valor se
                  quiser usar apenas um trecho.
                </span>
              </label>
            </div>

            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-white/8 bg-black/15 px-4 text-sm font-semibold">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked
                className="size-4 accent-violet-400"
              />
              Música ativa neste tema
            </label>

            <Button
              type="submit"
              size="lg"
              disabled={actionPending || !selected.isEmbeddable}
              className="min-h-11 rounded-xl px-5"
            >
              {actionPending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <Plus />
              )}
              {actionPending ? "Adicionando..." : "Adicionar ao tema"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/38">
          Pesquise ou informe uma URL para visualizar e configurar a música.
        </div>
      )}
    </div>
  );
}
