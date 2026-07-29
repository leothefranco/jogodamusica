import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PlaylistImportManager } from "@/components/admin/playlist-import-manager";
import { getYouTubePlaylistImportEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getThemeEditor } from "@/server/services/theme-content-service";

export default async function ImportPlaylistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const maxItems =
    getYouTubePlaylistImportEnv().YOUTUBE_PLAYLIST_IMPORT_MAX_ITEMS;
  let editor: Awaited<ReturnType<typeof getThemeEditor>>;
  try {
    editor = await getThemeEditor(id);
  } catch (error) {
    if (error instanceof AppError && error.code === "THEME_NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
      <Link
        href={`/admin/temas/${id}`}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl pr-3 text-sm font-semibold text-white/55 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar ao tema
      </Link>
      <p className="mt-7 text-xs font-bold tracking-[0.2em] text-violet-300 uppercase">
        {editor.theme.name}
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-[-0.04em] sm:text-5xl">
        Importar playlist
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-white/48">
        Revise a elegibilidade dos vídeos antes de adicioná-los ao catálogo.
      </p>
      <div className="mt-9">
        <PlaylistImportManager themeId={id} maxItems={maxItems} />
      </div>
    </main>
  );
}
