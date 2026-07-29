import { AppError } from "@/lib/errors";

const youtubeIdPattern = /^[A-Za-z0-9_-]{11}$/;
const supportedHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

export function parseYouTubeVideoId(input: string): string {
  const candidate = input.trim();

  if (youtubeIdPattern.test(candidate)) {
    return candidate;
  }

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new AppError(
      "INVALID_YOUTUBE_INPUT",
      "Informe uma URL válida do YouTube ou um ID de vídeo com 11 caracteres.",
      400,
      { input: ["URL ou ID do YouTube inválido."] },
    );
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new AppError(
      "INVALID_YOUTUBE_INPUT",
      "A URL precisa usar HTTP ou HTTPS.",
      400,
      { input: ["Protocolo de URL inválido."] },
    );
  }

  const host = url.hostname.toLowerCase();
  if (!supportedHosts.has(host)) {
    throw new AppError(
      "INVALID_YOUTUBE_INPUT",
      "A URL precisa pertencer ao YouTube.",
      400,
      { input: ["Domínio do YouTube inválido."] },
    );
  }

  let videoId: string | null = null;

  if (host.endsWith("youtu.be")) {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (url.pathname === "/watch") {
    videoId = url.searchParams.get("v");
  } else {
    const [kind, id] = url.pathname.split("/").filter(Boolean);
    if (["embed", "shorts", "live"].includes(kind ?? "")) {
      videoId = id ?? null;
    }
  }

  if (!videoId || !youtubeIdPattern.test(videoId)) {
    throw new AppError(
      "INVALID_YOUTUBE_INPUT",
      "Não foi possível identificar o vídeo nessa URL.",
      400,
      { input: ["URL ou ID do YouTube inválido."] },
    );
  }

  return videoId;
}

export function parseIsoDurationSeconds(duration: string): number {
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(
    duration,
  );

  if (!match) {
    throw new AppError(
      "INVALID_PROVIDER_RESPONSE",
      "O YouTube retornou uma duração inválida.",
      502,
    );
  }

  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  const total =
    Number(days) * 86_400 +
    Number(hours) * 3_600 +
    Number(minutes) * 60 +
    Number(seconds);

  if (!Number.isSafeInteger(total) || total <= 0) {
    throw new AppError(
      "INVALID_PROVIDER_RESPONSE",
      "O YouTube retornou uma duração inválida.",
      502,
    );
  }

  return total;
}
