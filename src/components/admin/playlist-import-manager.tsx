"use client";

import { FormEvent, useState } from "react";
import { CheckCheck, LoaderCircle, ListMusic } from "lucide-react";

import { adminInputClassName } from "@/components/admin/form-styles";
import { Button } from "@/components/ui/button";
import type { PlaylistPreview } from "@/server/services/playlist-import-service";

type ApiError = { error?: { message?: string } };
type PreviewResponse = { data: PlaylistPreview };
type ImportResponse = {
  data: { added: number; alreadyAssociated: number; ignored: number };
};

const statusLabels: Record<PlaylistPreview["items"][number]["status"], string> =
  {
    ready: "Pronto",
    already_associated: "Já associado",
    duplicate: "Duplicado",
    unavailable: "Indisponível",
    not_embeddable: "Não incorporável",
    region_blocked: "Bloqueado no Brasil",
    invalid: "Inválido",
  };

export function PlaylistImportManager({
  themeId,
  maxItems,
}: {
  themeId: string;
  maxItems: number;
}) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pending, setPending] = useState<"preview" | "import" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generatePreview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending("preview");
    setError(null);
    setPreview(null);
    setSelectedIds([]);
    try {
      const response = await fetch("/api/admin/youtube/playlists/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themeId, input }),
      });
      const payload = (await response.json()) as PreviewResponse & ApiError;
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Não foi possível gerar a prévia.",
        );
      }
      setPreview(payload.data);
      setSelectedIds(
        payload.data.items.flatMap((item) =>
          item.status === "ready" && item.providerContentId
            ? [item.providerContentId]
            : [],
        ),
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível gerar a prévia.",
      );
    } finally {
      setPending(null);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setPending("import");
    setError(null);
    try {
      const response = await fetch("/api/admin/youtube/playlists/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          themeId,
          previewId: preview.previewId,
          selectedProviderContentIds: selectedIds,
        }),
      });
      const payload = (await response.json()) as ImportResponse & ApiError;
      if (!response.ok) {
        throw new Error(
          payload.error?.message ?? "Não foi possível importar a playlist.",
        );
      }
      const { added, alreadyAssociated, ignored } = payload.data;
      const message = `${added} adicionada(s), ${alreadyAssociated} já associada(s), ${ignored} ignorada(s)`;
      window.location.assign(
        `/admin/temas/${themeId}?message=${encodeURIComponent(message)}`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Não foi possível importar a playlist.",
      );
      setPending(null);
    }
  }

  const readyIds =
    preview?.items.flatMap((item) =>
      item.status === "ready" && item.providerContentId
        ? [item.providerContentId]
        : [],
    ) ?? [];
  const hasExistingItems = Boolean(
    preview?.items.some(({ status }) => status === "already_associated"),
  );

  return (
    <div className="space-y-6">
      <form
        onSubmit={generatePreview}
        className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-7"
      >
        <label
          htmlFor="playlist-input"
          className="grid gap-2 text-sm font-semibold"
        >
          URL ou ID da playlist
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            id="playlist-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            required
            maxLength={500}
            placeholder="https://youtube.com/playlist?list=..."
            className={adminInputClassName}
          />
          <Button
            type="submit"
            size="lg"
            disabled={pending !== null}
            className="min-h-11 rounded-xl px-5"
          >
            {pending === "preview" ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <ListMusic />
            )}
            Gerar prévia
          </Button>
        </div>
        <p className="mt-3 text-xs leading-5 text-white/42">
          Playlists públicas ou não listadas. Até {maxItems} posições por
          importação.
        </p>
      </form>

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-300/20 bg-red-400/8 px-4 py-3 text-sm text-red-100"
        >
          {error}
        </div>
      ) : null}

      {preview ? (
        <section className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.16em] text-violet-300 uppercase">
                Prévia
              </p>
              <h2 className="mt-2 text-2xl font-black">
                {preview.playlistTitle}
              </h2>
              <p className="mt-2 text-sm text-white/45">
                {preview.positionsScanned} posição(ões) ·{" "}
                {preview.uniqueVideoCount} vídeo(s) único(s) ·{" "}
                {preview.duplicateCount} duplicata(s)
              </p>
              {preview.isTruncated ? (
                <p className="mt-2 text-sm font-semibold text-amber-200">
                  Limite atingido. A playlist possui itens adicionais.
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSelectedIds(readyIds)}
              >
                Selecionar prontos
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelectedIds([])}
              >
                Desmarcar todos
              </Button>
            </div>
          </div>

          <div className="mt-6 grid gap-3">
            {preview.items.map((item) => {
              const selectable =
                item.status === "ready" && Boolean(item.providerContentId);
              const checked = Boolean(
                item.providerContentId &&
                selectedIds.includes(item.providerContentId),
              );
              return (
                <label
                  key={`${item.position}:${item.providerContentId ?? "invalid"}`}
                  className={`flex items-start gap-4 rounded-xl border p-4 ${
                    selectable
                      ? "border-white/10 bg-black/20"
                      : "border-white/5 bg-black/10 text-white/48"
                  }`}
                >
                  <input
                    type="checkbox"
                    disabled={!selectable}
                    checked={checked}
                    onChange={(event) => {
                      const id = item.providerContentId;
                      if (!id) return;
                      setSelectedIds((current) =>
                        event.target.checked
                          ? [...new Set([...current, id])]
                          : current.filter((value) => value !== id),
                      );
                    }}
                    className="mt-1 size-4 accent-violet-400"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">
                      {item.track?.sourceTitle ??
                        item.providerContentId ??
                        "Item sem vídeo válido"}
                    </strong>
                    <span className="mt-1 block text-xs text-white/42">
                      {item.track?.sourceChannel
                        ? `${item.track.sourceChannel} · `
                        : ""}
                      {statusLabels[item.status]}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          <div className="mt-7 flex flex-col gap-3 border-t border-white/8 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-white/48">
              {selectedIds.length} item(ns) selecionado(s)
            </p>
            <Button
              type="button"
              size="lg"
              disabled={
                pending !== null ||
                (selectedIds.length === 0 && !hasExistingItems)
              }
              onClick={confirmImport}
              className="min-h-11 rounded-xl px-5"
            >
              {pending === "import" ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <CheckCheck />
              )}
              Confirmar importação
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
