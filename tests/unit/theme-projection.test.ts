import { describe, expect, it } from "vitest";
import { classifyThemeState } from "@/domain/music/theme-state";
import {
  deriveThemeProjection,
  changedProjectionFields,
} from "@/domain/music/theme-projection";

const now = new Date("2026-10-07T12:00:00.000Z");
const cases = [
  {
    editorialState: "draft" as const,
    counts: {
      availableFresh: 128,
      availableGrace: 0,
      unavailable: 0,
      unknown: 0,
    },
  },
  {
    editorialState: "published" as const,
    counts: {
      availableFresh: 4,
      availableGrace: 0,
      unavailable: 0,
      unknown: 0,
    },
  },
  {
    editorialState: "published" as const,
    counts: {
      availableFresh: 3,
      availableGrace: 1,
      unavailable: 0,
      unknown: 0,
    },
  },
  {
    editorialState: "published" as const,
    counts: {
      availableFresh: 4,
      availableGrace: 0,
      unavailable: 1,
      unknown: 0,
    },
  },
  {
    editorialState: "published" as const,
    counts: {
      availableFresh: 4,
      availableGrace: 0,
      unavailable: 0,
      unknown: 1,
    },
  },
  {
    editorialState: "published" as const,
    counts: {
      availableFresh: 3,
      availableGrace: 0,
      unavailable: 0,
      unknown: 1,
    },
  },
  {
    editorialState: "published" as const,
    counts: {
      availableFresh: 3,
      availableGrace: 0,
      unavailable: 1,
      unknown: 0,
    },
  },
];

describe("projeção derivada do Tema", () => {
  it.each(cases)(
    "preserva a classificadora única para $editorialState/$counts",
    (input) => {
      const expected = classifyThemeState(input);
      const projection = deriveThemeProjection({
        ...input,
        now,
        policyVersion: 1,
      });
      expect(projection).toMatchObject({
        ...expected.counts,
        editorialState: expected.editorialState,
        visibility: expected.visibility,
        operationalState: expected.operationalState,
        ruleVersion: expected.ruleVersion,
        policyVersion: 1,
        supportedModes: [
          ...expected.modes.quick,
          ...expected.modes.primary,
          ...expected.modes.extended,
        ],
        calculatedAt: now,
      });
    },
  );

  it.each([
    [64, 63, 64],
    [32, 31, 32],
  ])("remove somente o modo %s→%s", (from, to, lost) => {
    const make = (count: number) =>
      deriveThemeProjection({
        editorialState: "published",
        counts: {
          availableFresh: count,
          availableGrace: 0,
          unavailable: 0,
          unknown: 0,
        },
        now,
        policyVersion: 1,
      });
    expect(make(to).supportedModes).toEqual(
      make(from).supportedModes.filter((mode) => mode !== lost),
    );
  });

  it("recálculo idêntico ignora o novo instante e preserva ausência de efeito lógico", () => {
    const first = deriveThemeProjection({ ...cases[1], now, policyVersion: 1 });
    const next = deriveThemeProjection({
      ...cases[1],
      now: new Date(now.getTime() + 1000),
      policyVersion: 1,
    });
    expect(changedProjectionFields(first, next)).toEqual([]);
    expect(
      changedProjectionFields({ ...first, playableCount: 99 }, next),
    ).toEqual(["playableCount"]);
  });

  it("não aceita contagens derivadas inválidas", () => {
    expect(() =>
      deriveThemeProjection({
        ...cases[1],
        counts: { ...cases[1].counts, unknown: -1 },
        now,
        policyVersion: 1,
      }),
    ).toThrow();
  });
});
