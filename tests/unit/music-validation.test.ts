import { describe, expect, it } from "vitest";

import {
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
  it("informa quantas músicas faltam", () => {
    expect(getThemePublishability(8, 5)).toEqual({
      canPublish: false,
      missingSongCount: 3,
    });
  });

  it("libera publicação com músicas suficientes", () => {
    expect(getThemePublishability(4, 6)).toEqual({
      canPublish: true,
      missingSongCount: 0,
    });
  });

  it("valida slug, URL e tamanho de chave", () => {
    expect(
      themeInputSchema.safeParse({
        name: "Clássicos",
        slug: "classicos",
        description: "",
        coverUrl: "https://example.com/capa.jpg",
        defaultBracketSize: "16",
      }).success,
    ).toBe(true);

    expect(
      themeInputSchema.safeParse({
        name: "Inválido",
        slug: "Slug Inválido",
        description: "",
        coverUrl: "javascript:alert(1)",
        defaultBracketSize: "10",
      }).success,
    ).toBe(false);
  });
});
