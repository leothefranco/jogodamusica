import { describe, expect, it, vi } from "vitest";

import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import {
  createThemeContentService,
  createThemeEditorService,
} from "@/server/services/theme-content-service";

const themeId = "10000000-0000-4000-8000-000000000010";
const songId = "20000000-0000-4000-8000-000000000020";
const now = new Date("2026-01-01T00:00:00.000Z");
const track = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte",
  sourceChannel: "Canal",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};
const availableObservation = applySourceAvailabilityResult({
  current: null,
  observedAt: now,
  result: { type: "available", reason: "available", track },
});
const theme = {
  id: themeId,
  name: "Clássicos",
  slug: "classicos",
  description: null,
  coverUrl: null,
  isActive: false,
  activeSongCount: 0,
  totalSongCount: 0,
  updatedAt: now,
};
const associatedTrack = {
  songId,
  ...track,
  title: "Título",
  artist: "Artista",
  startTimeSeconds: 0,
  previewDurationSeconds: 30,
  isActive: true,
  displayOrder: null,
  sourceAvailability: availableObservation,
};

function createService(options: {
  observeResult?: {
    songId: string;
    observation: typeof availableObservation;
    availability: {
      state: "available_fresh" | "unavailable" | "unknown";
      playable: boolean;
      degraded: boolean;
    };
    applied: boolean;
    result:
      | { type: "available"; reason: "available"; track: typeof track }
      | {
          type: "unavailable";
          reason: "region_blocked";
          track: typeof track;
        }
      | { type: "transient_error"; errorCode: "transport" };
  };
  association?: ReturnType<
    typeof vi.fn<(input: Record<string, unknown>) => Promise<void>>
  >;
}) {
  const association = options.association ?? vi.fn(async () => undefined);
  const observeSourceAvailability = vi.fn().mockResolvedValue(
    options.observeResult ?? {
      songId,
      observation: availableObservation,
      availability: {
        state: "available_fresh",
        playable: true,
        degraded: false,
      },
      applied: true,
      result: { type: "available", reason: "available", track },
    },
  );
  const service = createThemeContentService({
    deleteThemeRecord: async (id) => id,
    findThemeSong: async () => associatedTrack,
    findThemeSongByProviderContentId: async () => associatedTrack,
    findThemeSummary: async () => theme,
    observeSourceAvailability,
    removeThemeSongRecord: async (_themeId, id) => id,
    setThemeActiveRecord: async (id) => id,
    themeHasSessions: async () => false,
    updateThemeSongAssociation: async () => undefined,
    updateThemeRecord: async (id) => id,
    upsertSongAndAssociation: async () => undefined,
    withThemeContentLock: async (_themeId, operation) =>
      operation({
        findThemeSong: async () => associatedTrack,
        findThemeSongByProviderContentId: async () => null,
        findThemeSummary: async () => theme,
        removeThemeSongRecord: async (id) => id,
        setThemeActiveRecord: async (isActive) =>
          isActive ? themeId : themeId,
        updateThemeSongAssociation: async () => undefined,
        updateThemeRecord: async () => themeId,
        upsertSongAndAssociation: async () => undefined,
        upsertThemeSongAssociation: association,
      }),
  });

  return { association, observeSourceAvailability, service };
}

const associationInput = {
  providerContentId: track.providerContentId,
  title: "Título",
  artist: "Artista",
  startTimeSeconds: 0,
  previewDurationSeconds: 30,
  isActive: true,
};

describe("integração individual da disponibilidade no Tema", () => {
  it("observa/persiste fora do lock e associa pelo songId somente quando jogável", async () => {
    const order: string[] = [];
    const { association, observeSourceAvailability, service } = createService({
      association: vi.fn(async () => {
        order.push("association");
      }),
    });
    observeSourceAvailability.mockImplementationOnce(async () => {
      order.push("observation");
      return {
        songId,
        observation: availableObservation,
        availability: {
          state: "available_fresh" as const,
          playable: true,
          degraded: false,
        },
        applied: true,
        result: {
          type: "available" as const,
          reason: "available" as const,
          track,
        },
      };
    });

    await service.attachResolvedTrack(themeId, associationInput);

    expect(order).toEqual(["observation", "association"]);
    expect(association).toHaveBeenCalledWith({
      songId,
      title: "Título",
      artist: "Artista",
      startTimeSeconds: 0,
      previewDurationSeconds: 30,
      isActive: true,
    });
  });

  it("preserva a observação indisponível e recusa a nova associação", async () => {
    const blockedTrack = { ...track, isRegionAllowed: false };
    const { association, observeSourceAvailability, service } = createService({
      observeResult: {
        songId,
        observation: { ...availableObservation, confirmedState: "unavailable" },
        availability: {
          state: "unavailable",
          playable: false,
          degraded: false,
        },
        applied: true,
        result: {
          type: "unavailable",
          reason: "region_blocked",
          track: blockedTrack,
        },
      },
    });

    await expect(
      service.attachResolvedTrack(themeId, associationInput),
    ).rejects.toMatchObject({ code: "VIDEO_REGION_BLOCKED", status: 400 });
    expect(observeSourceAvailability).toHaveBeenCalledOnce();
    expect(association).not.toHaveBeenCalled();
  });

  it("revalida Fonte já associada pelo mesmo normalizador/persistência", async () => {
    const { observeSourceAvailability, service } = createService({});

    await expect(
      service.revalidateSourceAvailability(themeId, songId),
    ).resolves.toMatchObject({ state: "available_fresh", playable: true });
    expect(observeSourceAvailability).toHaveBeenCalledWith(
      track.providerContentId,
    );
  });

  it("recarrega editor derivando saúde e URLs sem chamar provider", async () => {
    const getThemeEditor = createThemeEditorService({
      clock: () => now,
      findThemeSummary: async () => theme,
      listThemeSongs: async () => [associatedTrack],
    });

    await expect(getThemeEditor(themeId)).resolves.toMatchObject({
      songs: [
        {
          availability: {
            state: "available_fresh",
            playable: true,
            degraded: false,
          },
          embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
          watchUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        },
      ],
    });
  });
});
