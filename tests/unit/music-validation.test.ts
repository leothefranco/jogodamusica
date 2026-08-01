import { describe, expect, it } from "vitest";

import {
  bracketSizeSchema,
  getSupportedBracketSizes,
  getThemePublishability,
  themeSongInputSchema,
  trackAssociationInputSchema,
  themeInputSchema,
  validatePreviewWindow,
} from "@/domain/music/content-validation";
import {
  parseIsoDurationSeconds,
  parseYouTubeVideoId,
} from "@/domain/music/youtube";
import { parseYouTubePlaylistId } from "@/domain/music/playlist";
import { AppError } from "@/lib/errors";

describe("identificação de vídeos do YouTube", () => {
  it.each([
    ["dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?t=30", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("resolve %s", (input, expected) => {
    expect(parseYouTubeVideoId(input)).toBe(expected);
  });

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/watch?v=curto",
    "não é um vídeo",
  ])("rejeita %s", (input) => {
    expect(() => parseYouTubeVideoId(input)).toThrow(AppError);
  });
});

describe("identificação de playlists do YouTube", () => {
  it.each([
    ["PL1234567890abcdef", "PL1234567890abcdef"],
    [
      "https://www.youtube.com/playlist?list=PL1234567890abcdef",
      "PL1234567890abcdef",
    ],
    [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1234567890abcdef",
      "PL1234567890abcdef",
    ],
  ])("resolve %s", (input, expected) => {
    expect(parseYouTubePlaylistId(input)).toBe(expected);
  });

  it.each([
    "https://example.com/playlist?list=PL1234567890abcdef",
    "https://www.youtube.com/playlist",
    "lista inválida",
  ])("rejeita %s", (input) => {
    expect(() => parseYouTubePlaylistId(input)).toThrow(AppError);
  });
});

describe("duração e trecho", () => {
  it.each([
    ["PT3M12S", 192],
    ["PT1H2M3S", 3723],
    ["P1DT2H", 93_600],
  ])("converte %s para segundos", (duration, expected) => {
    expect(parseIsoDurationSeconds(duration)).toBe(expected);
  });

  it("aceita um trecho contido no vídeo", () => {
    expect(() =>
      validatePreviewWindow({
        durationSeconds: 180,
        startTimeSeconds: 120,
        previewDurationSeconds: 60,
      }),
    ).not.toThrow();
  });

  it("aceita a duração completa de uma música", () => {
    expect(
      trackAssociationInputSchema.safeParse({
        providerContentId: "dQw4w9WgXcQ",
        title: "Never Gonna Give You Up",
        artist: "Rick Astley",
        startTimeSeconds: 0,
        previewDurationSeconds: 213,
        isActive: true,
      }).success,
    ).toBe(true);
    expect(() =>
      validatePreviewWindow({
        durationSeconds: 213,
        startTimeSeconds: 0,
        previewDurationSeconds: 213,
      }),
    ).not.toThrow();
  });

  it("rejeita duração igual a zero", () => {
    expect(
      themeSongInputSchema.safeParse({
        title: "Música",
        artist: "Artista",
        startTimeSeconds: 0,
        previewDurationSeconds: 0,
        displayOrder: "",
        isActive: true,
      }).success,
    ).toBe(false);
  });

  it("rejeita trecho que ultrapassa o vídeo", () => {
    expect(() =>
      validatePreviewWindow({
        durationSeconds: 100,
        startTimeSeconds: 80,
        previewDurationSeconds: 30,
      }),
    ).toThrowError(expect.objectContaining({ code: "INVALID_PREVIEW_WINDOW" }));
  });
});

describe("publicação de tema", () => {
  it.each([64, 128] as const)(
    "aceita a modalidade de %i músicas",
    (bracketSize) => {
      expect(bracketSizeSchema.safeParse(bracketSize).success).toBe(true);
    },
  );

  it.each([3, 256])("rejeita a modalidade inválida %i", (bracketSize) => {
    expect(bracketSizeSchema.safeParse(bracketSize).success).toBe(false);
  });

  it("informa quantas músicas faltam", () => {
    expect(getThemePublishability(3)).toEqual({
      canPublish: false,
      missingSongCount: 1,
    });
  });

  it("libera publicação a partir de quatro músicas", () => {
    expect(getThemePublishability(4)).toEqual({
      canPublish: true,
      missingSongCount: 0,
    });
  });

  it("valida tema sem modalidade padrão", () => {
    expect(
      themeInputSchema.safeParse({
        name: "Clássicos",
        slug: "classicos",
        description: "",
        coverUrl: "https://example.com/capa.jpg",
      }).success,
    ).toBe(true);

    expect(
      themeInputSchema.safeParse({
        name: "Inválido",
        slug: "Slug Inválido",
        description: "",
        coverUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it.each([
    [3, []],
    [4, [4]],
    [7, [4]],
    [8, [4, 8]],
    [16, [4, 8, 16]],
    [32, [4, 8, 16, 32]],
    [64, [4, 8, 16, 32, 64]],
    [128, [4, 8, 16, 32, 64, 128]],
    [200, [4, 8, 16, 32, 64, 128]],
  ])("deriva modalidades para %i músicas ativas", (count, expected) => {
    expect(getSupportedBracketSizes(count)).toEqual(expected);
  });
});
