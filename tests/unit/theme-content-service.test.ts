import { describe, expect, it } from "vitest";

import { createThemeContentService } from "@/server/services/theme-content-service";

const resolvedTrack = {
  providerContentId: "dQw4w9WgXcQ",
  sourceTitle: "Fonte",
  sourceChannel: "Canal",
  thumbnailUrl: "https://example.com/thumb.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
};

const associatedTrack = {
  songId: "20000000-0000-4000-8000-000000000020",
  ...resolvedTrack,
  title: "Título",
  artist: "Artista",
  startTimeSeconds: 0,
  previewDurationSeconds: 30,
  isActive: true,
  displayOrder: null,
  sourceAvailability: null,
};

type ServiceDependencies = Parameters<typeof createThemeContentService>[0];

function createService(overrides: Partial<ServiceDependencies> = {}) {
  const { withThemeContentLock: lockOverride, ...boundaryOverrides } =
    overrides;
  const boundaries: Omit<ServiceDependencies, "withThemeContentLock"> = {
    deleteThemeRecord: async (themeId) => themeId,
    findThemeSong: async () => associatedTrack,
    findThemeSongByProviderContentId: async () => associatedTrack,
    findThemeSummary: async () => ({
      id: "10000000-0000-4000-8000-000000000010",
      name: "Clássicos",
      slug: "classicos",
      description: null,
      coverUrl: null,
      isActive: true,
      activeSongCount: 4,
      totalSongCount: 4,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    }),
    observeSourceAvailability: async () => ({
      songId: associatedTrack.songId,
      observation: {
        region: "BR",
        confirmedState: "available",
        confirmationReason: "available",
        errorCode: null,
        observedAt: new Date("2026-01-01T00:00:00Z"),
        lastAttemptAt: new Date("2026-01-01T00:00:00Z"),
        lastConfirmedAt: new Date("2026-01-01T00:00:00Z"),
        validUntil: new Date("2026-01-08T00:00:00Z"),
        graceUntil: new Date("2026-01-09T00:00:00Z"),
        nextCheckAt: new Date("2026-01-08T00:00:00Z"),
        revision: 1,
        policyVersion: 1,
      },
      availability: {
        state: "available_fresh",
        playable: true,
        degraded: false,
      },
      applied: true,
      result: {
        type: "available",
        reason: "available",
        track: resolvedTrack,
      },
    }),
    removeThemeSongRecord: async (_themeId, songId) => songId,
    setThemeActiveRecord: async (themeId) => themeId,
    themeHasSessions: async () => false,
    updateThemeSongAssociation: async () => undefined,
    updateThemeRecord: async (themeId) => themeId,
    upsertSongAndAssociation: async () => undefined,
    ...boundaryOverrides,
  };
  let mutationQueue = Promise.resolve();
  const withThemeContentLock: ServiceDependencies["withThemeContentLock"] =
    lockOverride ??
    (async (themeId, operation) => {
      const previousMutation = mutationQueue;
      let releaseMutation: () => void = () => {};
      mutationQueue = new Promise<void>((resolve) => {
        releaseMutation = resolve;
      });
      await previousMutation;

      try {
        return await operation({
          findThemeSong: (songId) => boundaries.findThemeSong(themeId, songId),
          findThemeSongByProviderContentId: (providerContentId) =>
            boundaries.findThemeSongByProviderContentId(
              themeId,
              providerContentId,
            ),
          findThemeSummary: () => boundaries.findThemeSummary(themeId),
          removeThemeSongRecord: (songId) =>
            boundaries.removeThemeSongRecord(themeId, songId),
          setThemeActiveRecord: (isActive) =>
            boundaries.setThemeActiveRecord(themeId, isActive),
          updateThemeSongAssociation: (input) =>
            boundaries.updateThemeSongAssociation({ themeId, ...input }),
          updateThemeRecord: (values) =>
            boundaries.updateThemeRecord(themeId, values),
          upsertSongAndAssociation: (input) =>
            boundaries.upsertSongAndAssociation({ themeId, ...input }),
          upsertThemeSongAssociation: (input) =>
            boundaries.upsertSongAndAssociation({
              themeId,
              ...resolvedTrack,
              ...input,
            }),
        });
      } finally {
        releaseMutation();
      }
    });

  return createThemeContentService({
    ...boundaries,
    withThemeContentLock,
  });
}

describe("serviço de conteúdo de temas", () => {
  it("preserva a quantidade jogável ao reassociar uma música de tema publicado", async () => {
    let associationWasSaved = false;
    const service = createService({
      upsertSongAndAssociation: async () => {
        associationWasSaved = true;
      },
    });

    await expect(
      service.attachResolvedTrack("10000000-0000-4000-8000-000000000010", {
        providerContentId: "dQw4w9WgXcQ",
        title: "Título",
        artist: "Artista",
        startTimeSeconds: 0,
        previewDurationSeconds: 30,
        isActive: false,
      }),
    ).rejects.toMatchObject({ code: "THEME_NOT_PLAYABLE", status: 409 });
    expect(associationWasSaved).toBe(false);
  });

  it("rejeita música individual bloqueada no Brasil antes de associá-la", async () => {
    let associationWasSaved = false;
    const service = createService({
      observeSourceAvailability: async () => ({
        songId: associatedTrack.songId,
        observation: {
          region: "BR",
          confirmedState: "unavailable",
          confirmationReason: "region_blocked",
          errorCode: null,
          observedAt: new Date("2026-01-01T00:00:00Z"),
          lastAttemptAt: new Date("2026-01-01T00:00:00Z"),
          lastConfirmedAt: new Date("2026-01-01T00:00:00Z"),
          validUntil: null,
          graceUntil: null,
          nextCheckAt: new Date("2026-01-02T00:00:00Z"),
          revision: 1,
          policyVersion: 1,
        },
        availability: {
          state: "unavailable",
          playable: false,
          degraded: false,
        },
        applied: true,
        result: {
          type: "unavailable",
          reason: "region_blocked",
          track: { ...resolvedTrack, isRegionAllowed: false },
        },
      }),
      upsertSongAndAssociation: async () => {
        associationWasSaved = true;
      },
    });

    await expect(
      service.attachResolvedTrack("10000000-0000-4000-8000-000000000010", {
        providerContentId: "dQw4w9WgXcQ",
        title: "Título",
        artist: "Artista",
        startTimeSeconds: 0,
        previewDurationSeconds: 30,
        isActive: true,
      }),
    ).rejects.toMatchObject({ code: "VIDEO_REGION_BLOCKED", status: 400 });
    expect(associationWasSaved).toBe(false);
  });

  it("preserva a quantidade jogável ao desativar uma música de tema publicado", async () => {
    let associationWasUpdated = false;
    const service = createService({
      updateThemeSongAssociation: async () => {
        associationWasUpdated = true;
      },
    });

    await expect(
      service.updateThemeSong(
        "10000000-0000-4000-8000-000000000010",
        "20000000-0000-4000-8000-000000000020",
        {
          title: "Título",
          artist: "Artista",
          startTimeSeconds: 0,
          previewDurationSeconds: 30,
          displayOrder: null,
          isActive: false,
        },
      ),
    ).rejects.toMatchObject({ code: "THEME_NOT_PLAYABLE", status: 409 });
    expect(associationWasUpdated).toBe(false);
  });

  it("preserva a quantidade jogável ao remover uma música de tema publicado", async () => {
    let associationWasRemoved = false;
    const service = createService({
      removeThemeSongRecord: async () => {
        associationWasRemoved = true;
        return associatedTrack.songId;
      },
    });

    await expect(
      service.removeThemeSong(
        "10000000-0000-4000-8000-000000000010",
        associatedTrack.songId,
      ),
    ).rejects.toMatchObject({ code: "THEME_NOT_PLAYABLE", status: 409 });
    expect(associationWasRemoved).toBe(false);
  });

  it("permite remover associação ativa não reproduzível sem reduzir o mínimo publicável", async () => {
    let associationWasRemoved = false;
    const service = createService({
      findThemeSong: async () => ({
        ...associatedTrack,
        isEmbeddable: false,
      }),
      removeThemeSongRecord: async (_themeId, songId) => {
        associationWasRemoved = true;
        return songId;
      },
    });

    await service.removeThemeSong(
      "10000000-0000-4000-8000-000000000010",
      associatedTrack.songId,
    );

    expect(associationWasRemoved).toBe(true);
  });

  it("não publica tema com apenas três músicas ativas e reproduzíveis", async () => {
    let publicationWasSaved = false;
    const service = createService({
      findThemeSummary: async () => ({
        id: "10000000-0000-4000-8000-000000000010",
        name: "Clássicos",
        slug: "classicos",
        description: null,
        coverUrl: null,
        isActive: false,
        activeSongCount: 3,
        totalSongCount: 3,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      setThemeActiveRecord: async (themeId) => {
        publicationWasSaved = true;
        return themeId;
      },
    });

    await expect(
      service.setThemePublication("10000000-0000-4000-8000-000000000010", true),
    ).rejects.toMatchObject({ code: "THEME_NOT_PLAYABLE", status: 409 });
    expect(publicationWasSaved).toBe(false);
  });

  it("publica tema com quatro músicas ativas e reproduzíveis", async () => {
    let publicationWasSaved = false;
    const service = createService({
      findThemeSummary: async () => ({
        id: "10000000-0000-4000-8000-000000000010",
        name: "Clássicos",
        slug: "classicos",
        description: null,
        coverUrl: null,
        isActive: false,
        activeSongCount: 4,
        totalSongCount: 4,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      setThemeActiveRecord: async (themeId) => {
        publicationWasSaved = true;
        return themeId;
      },
    });

    await service.setThemePublication(
      "10000000-0000-4000-8000-000000000010",
      true,
    );

    expect(publicationWasSaved).toBe(true);
  });

  it("não exclui tema que possui histórico de partidas", async () => {
    let themeWasDeleted = false;
    const service = createService({
      deleteThemeRecord: async (themeId) => {
        themeWasDeleted = true;
        return themeId;
      },
      themeHasSessions: async () => true,
    });

    await expect(
      service.deleteTheme("10000000-0000-4000-8000-000000000010"),
    ).rejects.toMatchObject({ code: "THEME_HAS_HISTORY", status: 409 });
    expect(themeWasDeleted).toBe(false);
  });

  it("atualiza os dados editoriais de tema publicado sem modalidade padrão", async () => {
    let savedTheme: Record<string, unknown> | null = null;
    const service = createService({
      updateThemeRecord: async (themeId, values) => {
        savedTheme = values;
        return themeId;
      },
    });

    const input = {
      name: "Clássicos",
      slug: "classicos",
      description: null,
      coverUrl: null,
    };
    await service.updateTheme("10000000-0000-4000-8000-000000000010", input);

    expect(savedTheme).toEqual(input);
  });

  it("serializa desativações concorrentes para preservar uma chave publicada", async () => {
    let activeSongCount = 5;
    const service = createService({
      findThemeSummary: async () => ({
        id: "10000000-0000-4000-8000-000000000010",
        name: "Clássicos",
        slug: "classicos",
        description: null,
        coverUrl: null,
        isActive: true,
        activeSongCount,
        totalSongCount: 5,
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      }),
      updateThemeSongAssociation: async () => {
        activeSongCount -= 1;
      },
    });
    const input = {
      title: "Título",
      artist: "Artista",
      startTimeSeconds: 0,
      previewDurationSeconds: 30,
      displayOrder: null,
      isActive: false,
    };

    const results = await Promise.allSettled([
      service.updateThemeSong(
        "10000000-0000-4000-8000-000000000010",
        "20000000-0000-4000-8000-000000000020",
        input,
      ),
      service.updateThemeSong(
        "10000000-0000-4000-8000-000000000010",
        "30000000-0000-4000-8000-000000000030",
        input,
      ),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(
      1,
    );
    expect(activeSongCount).toBe(4);
  });
});
