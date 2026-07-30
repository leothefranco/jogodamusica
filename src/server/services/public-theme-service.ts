import "server-only";

import {
  getSupportedBracketSizes,
  type BracketSize,
} from "@/domain/music/content-validation";
import {
  findPlayableThemeBySlug,
  listPlayableThemes,
  type PlayableThemeRecord,
} from "@/server/repositories/public-theme-repository";

export type PublicTheme = PlayableThemeRecord & {
  supportedBracketSizes: BracketSize[];
  selectedBracketSize: BracketSize;
};

type PublicThemeServiceDependencies = {
  listPlayableThemes(): Promise<PlayableThemeRecord[]>;
  findPlayableThemeBySlug(slug: string): Promise<PlayableThemeRecord | null>;
};

function presentTheme(theme: PlayableThemeRecord): PublicTheme {
  const supportedBracketSizes = getSupportedBracketSizes(theme.activeSongCount);
  const selectedBracketSize = supportedBracketSizes.includes(
    theme.defaultBracketSize,
  )
    ? theme.defaultBracketSize
    : supportedBracketSizes.at(-1)!;

  return { ...theme, supportedBracketSizes, selectedBracketSize };
}

export function createPublicThemeService(
  dependencies: PublicThemeServiceDependencies,
) {
  return {
    async listThemes(): Promise<PublicTheme[]> {
      return (await dependencies.listPlayableThemes()).map(presentTheme);
    },
    async getTheme(slug: string): Promise<PublicTheme | null> {
      const theme = await dependencies.findPlayableThemeBySlug(slug);
      return theme ? presentTheme(theme) : null;
    },
  };
}

const publicThemeService = createPublicThemeService({
  listPlayableThemes,
  findPlayableThemeBySlug,
});

export const getPublicThemes = publicThemeService.listThemes;
export const getPublicTheme = publicThemeService.getTheme;
