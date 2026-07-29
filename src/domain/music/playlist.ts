import { AppError } from "@/lib/errors";

const playlistIdPattern = /^[A-Za-z0-9_-]{10,150}$/;
const supportedHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
]);

export type PlaylistItemStatus =
  | "ready"
  | "already_associated"
  | "duplicate"
  | "unavailable"
  | "not_embeddable"
  | "region_blocked"
  | "invalid";

export type ProviderPlaylistItemStatus = Exclude<
  PlaylistItemStatus,
  "already_associated"
>;

export function parseYouTubePlaylistId(input: string): string {
  const candidate = input.trim();
  if (playlistIdPattern.test(candidate)) return candidate;

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AppError(
      "INVALID_PLAYLIST_INPUT",
      "Informe uma URL válida do YouTube ou um ID de playlist.",
      400,
      { input: ["URL ou ID de playlist inválido."] },
    );
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !supportedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new AppError(
      "INVALID_PLAYLIST_INPUT",
      "A URL precisa pertencer ao YouTube.",
      400,
      { input: ["URL de playlist inválida."] },
    );
  }

  const playlistId = url.searchParams.get("list");
  if (!playlistId || !playlistIdPattern.test(playlistId)) {
    throw new AppError(
      "INVALID_PLAYLIST_INPUT",
      "Não foi possível identificar a playlist nessa URL.",
      400,
      { input: ["URL ou ID de playlist inválido."] },
    );
  }

  return playlistId;
}
