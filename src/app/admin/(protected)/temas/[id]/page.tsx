import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  ListMusic,
  Save,
  Trash2,
} from "lucide-react";

import {
  attachTrackAction,
  deleteThemeAction,
  removeThemeSongAction,
  setThemePublicationAction,
  updateThemeAction,
  updateThemeSongAction,
} from "@/app/admin/(protected)/temas/actions";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { adminInputClassName } from "@/components/admin/form-styles";
import { ThemeForm } from "@/components/admin/theme-form";
import { YouTubeSongManager } from "@/components/admin/youtube-song-manager";
import { SupportedRounds } from "@/components/admin/supported-rounds";
import { Button } from "@/components/ui/button";
import { AppError } from "@/lib/errors";
import { getThemeEditor } from "@/server/services/theme-content-service";

export default async function EditThemePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);

  let editor: Awaited<ReturnType<typeof getThemeEditor>>;
  try {
    editor = await getThemeEditor(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "THEME_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  const { theme, songs, publishability } = editor;
  const updateAction = updateThemeAction.bind(null, theme.id);
  const attachAction = attachTrackAction.bind(null, theme.id);

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href="/admin/temas"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-white/55 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar aos temas
      </Link>

      <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-bold ${
                theme.isActive
                  ? "border-emerald-300/20 bg-emerald-400/8 text-emerald-200"
                  : "border-white/8 bg-white/[0.035] text-white/45"
              }`}
            >
              {theme.isActive ? "Publicado" : "Rascunho"}
            </span>
            <span className="text-xs text-white/35">
              {theme.activeSongCount} música(s) ativa(s)
            </span>
          </div>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
            {theme.name}
          </h1>
          <p className="mt-2 font-mono text-xs text-white/35">/{theme.slug}</p>
          <div className="mt-4">
            <SupportedRounds activeSongCount={theme.activeSongCount} />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href={`/admin/temas/${theme.id}/importar-playlist`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-5 text-sm font-semibold hover:bg-white/[0.06]"
          >
            <ListMusic aria-hidden="true" />
            Importar playlist
          </Link>
          <form
            action={setThemePublicationAction.bind(
              null,
              theme.id,
              !theme.isActive,
            )}
          >
            <Button
              type="submit"
              size="lg"
              variant={theme.isActive ? "outline" : "default"}
              disabled={!theme.isActive && !publishability.canPublish}
              className="min-h-11 rounded-xl px-5"
            >
              <CheckCircle2 aria-hidden="true" />
              {theme.isActive ? "Desativar" : "Publicar tema"}
            </Button>
          </form>
          <form action={deleteThemeAction.bind(null, theme.id)}>
            <ConfirmSubmitButton
              type="submit"
              size="lg"
              variant="destructive"
              confirmation="Excluir este tema e todas as suas associações? Esta ação não pode ser desfeita."
              className="min-h-11 rounded-xl px-4"
            >
              <Trash2 aria-hidden="true" />
              Excluir
            </ConfirmSubmitButton>
          </form>
        </div>
      </div>

      {query.message ? (
        <div
          role="status"
          className="mt-7 rounded-xl border border-emerald-300/20 bg-emerald-400/8 px-4 py-3 text-sm text-emerald-100"
        >
          {query.message}
        </div>
      ) : null}
      {query.error ? (
        <div
          role="alert"
          className="mt-7 rounded-xl border border-red-300/20 bg-red-400/8 px-4 py-3 text-sm text-red-100"
        >
          {query.error}
        </div>
      ) : null}

      {!theme.isActive && !publishability.canPublish ? (
        <div className="mt-7 flex gap-3 rounded-xl border border-amber-300/18 bg-amber-300/7 px-4 py-4 text-sm text-amber-100">
          <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <p>
            Faltam {publishability.missingSongCount} música(s) ativa(s) para
            atingir o mínimo de quatro e publicar o tema.
          </p>
        </div>
      ) : null}

      <div className="mt-10 grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-7">
          <h2 className="text-xl font-black">Dados do tema</h2>
          <p className="mt-2 text-sm leading-6 text-white/42">
            Nome, endereço e apresentação do catálogo musical.
          </p>
          <div className="mt-7">
            <ThemeForm
              action={updateAction}
              submitLabel="Salvar alterações"
              defaults={{
                name: theme.name,
                slug: theme.slug,
                description: theme.description ?? "",
                coverUrl: theme.coverUrl ?? "",
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-7">
          <h2 className="text-xl font-black">Adicionar música</h2>
          <p className="mt-2 text-sm leading-6 text-white/42">
            Pesquise somente no painel ou cole uma URL. Os metadados são
            resolvidos no servidor antes do cadastro.
          </p>
          <div className="mt-7">
            <YouTubeSongManager action={attachAction} />
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-white/8 bg-[#0d0d18] p-5 sm:p-7">
        <div>
          <h2 className="text-xl font-black">Músicas do tema</h2>
          <p className="mt-2 text-sm text-white/42">
            {songs.length} associada(s), {theme.activeSongCount} ativa(s).
          </p>
        </div>

        {songs.length === 0 ? (
          <div className="mt-7 rounded-xl border border-dashed border-white/10 px-5 py-10 text-center text-sm text-white/38">
            Nenhuma música associada ainda.
          </div>
        ) : (
          <div className="mt-7 grid gap-4">
            {songs.map((song) => (
              <article
                key={song.songId}
                className="rounded-2xl border border-white/8 bg-black/15 p-5"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-bold ${
                          song.isActive
                            ? "border-emerald-300/20 text-emerald-200"
                            : "border-white/8 text-white/38"
                        }`}
                      >
                        {song.isActive ? "Ativa" : "Inativa"}
                      </span>
                      <a
                        href={song.watchUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-violet-200 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
                      >
                        Abrir YouTube
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    </div>
                    <p className="mt-3 font-bold">{song.sourceTitle}</p>
                    <p className="mt-1 text-xs text-white/38">
                      Fonte: {song.sourceChannel} · {song.durationSeconds}s
                    </p>
                  </div>
                </div>

                <form
                  action={updateThemeSongAction.bind(
                    null,
                    theme.id,
                    song.songId,
                  )}
                  className="mt-5 grid gap-4 lg:grid-cols-6"
                >
                  <label className="grid gap-2 text-xs font-semibold lg:col-span-2">
                    Título exibido
                    <input
                      name="title"
                      defaultValue={song.title}
                      required
                      maxLength={200}
                      className={adminInputClassName}
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold lg:col-span-2">
                    Artista exibido
                    <input
                      name="artist"
                      defaultValue={song.artist}
                      required
                      maxLength={200}
                      className={adminInputClassName}
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold">
                    Início (s)
                    <input
                      name="startTimeSeconds"
                      type="number"
                      min={0}
                      defaultValue={song.startTimeSeconds}
                      required
                      className={adminInputClassName}
                    />
                  </label>
                  <label className="grid gap-2 text-xs font-semibold">
                    Duração (s)
                    <input
                      name="previewDurationSeconds"
                      type="number"
                      min={1}
                      max={song.durationSeconds}
                      defaultValue={song.previewDurationSeconds}
                      required
                      className={adminInputClassName}
                    />
                    <span className="leading-4 font-normal text-white/38">
                      Máximo: {song.durationSeconds}s (música inteira).
                    </span>
                  </label>
                  <label className="grid gap-2 text-xs font-semibold">
                    Ordem
                    <input
                      name="displayOrder"
                      type="number"
                      min={0}
                      defaultValue={song.displayOrder ?? ""}
                      className={adminInputClassName}
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-3 self-end rounded-xl border border-white/8 bg-black/15 px-4 text-sm font-semibold lg:col-span-2">
                    <input
                      type="checkbox"
                      name="isActive"
                      defaultChecked={song.isActive}
                      className="size-4 accent-violet-400"
                    />
                    Ativa neste tema
                  </label>
                  <div className="flex items-end gap-3 lg:col-span-3 lg:justify-end">
                    <Button
                      type="submit"
                      size="lg"
                      className="min-h-11 rounded-xl px-4"
                    >
                      <Save aria-hidden="true" />
                      Salvar música
                    </Button>
                  </div>
                </form>

                <form
                  action={removeThemeSongAction.bind(
                    null,
                    theme.id,
                    song.songId,
                  )}
                  className="mt-3 flex justify-end"
                >
                  <ConfirmSubmitButton
                    type="submit"
                    variant="ghost"
                    confirmation={`Remover “${song.title}” deste tema? A música continuará disponível para outros temas.`}
                    className="min-h-11 rounded-xl px-3 text-red-200 hover:bg-red-400/10 hover:text-red-100"
                  >
                    <Trash2 aria-hidden="true" />
                    Remover do tema
                  </ConfirmSubmitButton>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
