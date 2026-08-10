import { projectCompletedGame } from "@/domain/game/projections";
import type { GameState } from "@/domain/game/state";

export type ResultShareCard = {
  artist: string;
  resultUrl: string;
  siteLabel: string;
  themeName: string;
  thumbnailUrl: string | null;
  title: string;
  titleFontSize: number;
};

const allowedThumbnailHosts = new Set(["i.ytimg.com", "img.youtube.com"]);

function getSafeThumbnailUrl(value: string): string | null {
  try {
    const url = new URL(value);
    const isAllowedSupabaseHost = url.hostname.endsWith(".supabase.co");

    if (
      url.protocol !== "https:" ||
      (!allowedThumbnailHosts.has(url.hostname) && !isAllowedSupabaseHost)
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function getResultShareTitleFontSize(title: string): number {
  if (title.length > 58) return 58;
  if (title.length > 38) return 70;
  if (title.length > 24) return 82;
  return 96;
}

export function createResultShareCard(
  state: GameState,
  appUrl: string,
): ResultShareCard | null {
  const result = projectCompletedGame(state);
  if (!result) return null;
  const { champion } = result;

  const baseUrl = new URL(appUrl);
  const resultUrl = new URL(`/resultado/${state.session.id}`, baseUrl);

  return {
    artist: champion.artist,
    resultUrl: resultUrl.toString(),
    siteLabel: baseUrl.host,
    themeName: state.theme.name,
    thumbnailUrl: getSafeThumbnailUrl(champion.thumbnailUrl),
    title: champion.title,
    titleFontSize: getResultShareTitleFontSize(champion.title),
  };
}
