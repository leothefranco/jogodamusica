import { describe, expect, it } from "vitest";

import {
  classifyThemeState,
  deriveThemeStateEvents,
} from "@/domain/music/theme-state";

describe("estado do Tema", () => {
  it.each([32, 64])(
    "distingue perda %i por saúde de retirada editorial sem dados livres",
    (size) => {
      const before = classifyThemeState({
        editorialState: "published",
        counts: {
          availableFresh: size,
          availableGrace: 0,
          unavailable: 0,
          unknown: 0,
        },
      });
      const editorial = classifyThemeState({
        editorialState: "published",
        counts: {
          availableFresh: size - 1,
          availableGrace: 0,
          unavailable: 0,
          unknown: 0,
        },
      });
      const health = classifyThemeState({
        editorialState: "published",
        counts: {
          availableFresh: size - 1,
          availableGrace: 0,
          unavailable: 1,
          unknown: 0,
        },
      });
      const editorialEvents = deriveThemeStateEvents(
        before,
        editorial,
        "editorial",
      );
      const healthEvents = deriveThemeStateEvents(before, health, "health");
      expect(editorialEvents.map(({ type }) => type)).toEqual([
        "primary_modes_changed",
      ]);
      expect(editorialEvents).toEqual([
        {
          type: "primary_modes_changed",
          cause: "editorial",
          ruleVersion: 1,
          editorialState: "published",
          visibility: "visible",
          operationalState: "healthy",
          counts: {
            availableFresh: size - 1,
            availableGrace: 0,
            unavailable: 0,
            unknown: 0,
            playableCount: size - 1,
            potentialCount: size - 1,
            activeEntryCount: size - 1,
          },
          lostPrimaryModes: [size],
        },
      ]);
      expect(healthEvents.map(({ type, cause }) => ({ type, cause }))).toEqual([
        { type: "degradation_changed", cause: "health" },
        { type: "primary_modes_changed", cause: "health" },
      ]);
      expect(deriveThemeStateEvents(before, before, "health")).toEqual([]);
    },
  );

  it("produz eventos fechados para publicação, visibilidade e suspensão", () => {
    const draft = classifyThemeState({
      editorialState: "draft",
      counts: {
        availableFresh: 4,
        availableGrace: 0,
        unavailable: 0,
        unknown: 0,
      },
    });
    const published = classifyThemeState({
      editorialState: "published",
      counts: draft.counts,
    });
    const suspended = classifyThemeState({
      editorialState: "published",
      counts: {
        availableFresh: 3,
        availableGrace: 0,
        unavailable: 0,
        unknown: 1,
      },
    });
    expect(
      deriveThemeStateEvents(draft, published, "editorial").map(
        ({ type }) => type,
      ),
    ).toEqual(["editorial_changed", "visibility_changed"]);
    expect(
      deriveThemeStateEvents(published, suspended, "health").map(
        ({ type }) => type,
      ),
    ).toEqual(["visibility_changed", "suspension_changed"]);
    expect(
      deriveThemeStateEvents(suspended, published, "health").map(
        ({ type }) => type,
      ),
    ).toEqual(["visibility_changed", "suspension_changed"]);
  });

  it.each([
    [3, [], [], []],
    [4, [], [4], []],
    [31, [], [4, 8, 16], []],
    [32, [32], [4, 8, 16], []],
    [63, [32], [4, 8, 16], []],
    [64, [32, 64], [4, 8, 16], []],
    [127, [32, 64], [4, 8, 16], []],
    [128, [32, 64], [4, 8, 16], [128]],
  ])(
    "deriva modalidades para %i jogáveis",
    (availableFresh, primary, quick, extended) => {
      expect(
        classifyThemeState({
          editorialState: "published",
          counts: {
            availableFresh: availableFresh as number,
            availableGrace: 0,
            unavailable: 0,
            unknown: 0,
          },
        }).modes,
      ).toEqual({ primary, quick, extended });
    },
  );

  it("explica os avisos e a perda de modalidade principal causada por saúde", () => {
    expect(
      classifyThemeState({
        editorialState: "published",
        counts: {
          availableFresh: 60,
          availableGrace: 3,
          unavailable: 1,
          unknown: 1,
        },
      }),
    ).toMatchObject({
      ruleVersion: 1,
      counts: { playableCount: 63, potentialCount: 64, activeEntryCount: 65 },
      warnings: {
        grace: true,
        unavailable: true,
        unknown: true,
        healthLostPrimaryModes: [64],
      },
    });
  });

  it("preserva published e suspende por verificação quando há três jogáveis e uma desconhecida", () => {
    const state = classifyThemeState({
      editorialState: "published",
      counts: {
        availableFresh: 3,
        availableGrace: 0,
        unavailable: 0,
        unknown: 1,
      },
    });

    expect(state).toMatchObject({
      editorialState: "published",
      visibility: "hidden",
      operationalState: "suspended_pending_verification",
      counts: { playableCount: 3, potentialCount: 4 },
    });
  });

  it.each([
    ["draft", 0, 0, 0, 0, "editorial_draft", "hidden"],
    ["draft", 128, 1, 1, 1, "editorial_draft", "hidden"],
    ["published", 4, 0, 0, 0, "healthy", "visible"],
    ["published", 3, 1, 0, 0, "degraded", "visible"],
    ["published", 4, 0, 1, 0, "degraded", "visible"],
    ["published", 4, 0, 0, 1, "degraded", "visible"],
    ["published", 2, 1, 0, 1, "suspended_pending_verification", "hidden"],
    [
      "published",
      3,
      0,
      1,
      0,
      "suspended_insufficient_healthy_entries",
      "hidden",
    ],
    [
      "published",
      0,
      0,
      0,
      0,
      "suspended_insufficient_healthy_entries",
      "hidden",
    ],
  ] as const)(
    "classifica %s (%i fresh, %i grace, %i unavailable, %i unknown) como %s/%s",
    (
      editorialState,
      availableFresh,
      availableGrace,
      unavailable,
      unknown,
      operationalState,
      visibility,
    ) => {
      expect(
        classifyThemeState({
          editorialState,
          counts: { availableFresh, availableGrace, unavailable, unknown },
        }),
      ).toMatchObject({ editorialState, operationalState, visibility });
    },
  );
});
