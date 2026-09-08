import "server-only";

import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import type { ThemeStateEvent } from "@/domain/music/theme-state";
import type { ResolvedProviderTrack } from "@/domain/music/provider";
import type {
  LockedThemeContentRepository,
  ThemeSongEditorItem,
  ThemeSummary,
} from "@/server/repositories/theme-content-repository";
import {
  createThemeContentService,
  createThemeEditorService,
} from "@/server/services/theme-content-service";
import { createSourceAvailabilityService } from "@/server/services/source-availability-service";

const actorId = "30000000-0000-4000-8000-000000000012";
const epoch = new Date("2026-01-01T00:00:00Z");
const entryId = (index: number) =>
  `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const track = (index: number): ResolvedProviderTrack => ({
  providerContentId: String(index).padStart(11, "0"),
  sourceTitle: "Entrada E2E",
  sourceChannel: "E2E",
  thumbnailUrl: "https://example.com/fixture.jpg",
  durationSeconds: 180,
  isEmbeddable: true,
  isRegionAllowed: true,
});
function entry(index: number): ThemeSongEditorItem {
  return {
    songId: entryId(index),
    ...track(index),
    title: "Entrada E2E",
    artist: "E2E",
    startTimeSeconds: 0,
    previewDurationSeconds: 30,
    displayOrder: index,
    isActive: true,
    sourceAvailability:
      index === 4
        ? null
        : applySourceAvailabilityResult({
            current: null,
            observedAt: epoch,
            result: {
              type: "available",
              reason: "available",
              track: track(index),
            },
          }),
  };
}
type FixtureRecord = {
  theme: ThemeSummary;
  entries: ThemeSongEditorItem[];
  now: Date;
  events: ThemeStateEvent[];
  providerCalls: number;
  providerAvailable: boolean;
  queue: Promise<void>;
};
const fixtureGlobal = globalThis as typeof globalThis & {
  themeStateFixtures?: Map<string, FixtureRecord>;
};
const records = (fixtureGlobal.themeStateFixtures ??= new Map());
function recordFor(id: string): FixtureRecord {
  if (process.env.E2E_TEST_MODE !== "1") throw new Error("Fixture unavailable");
  let record = records.get(id);
  if (!record) {
    record = {
      theme: {
        id,
        name: "Tema E2E",
        slug: "tema-e2e",
        description: null,
        coverUrl: null,
        isActive: false,
        editorialState: "draft",
        activeSongCount: 4,
        totalSongCount: 4,
        updatedAt: epoch,
      },
      entries: [1, 2, 3, 4].map(entry),
      now: epoch,
      events: [],
      providerCalls: 0,
      providerAvailable: true,
      queue: Promise.resolve(),
    };
    records.set(id, record);
  }
  return record;
}
function services(record: FixtureRecord) {
  const unexpected = async (): Promise<never> => {
    throw new Error("Unsupported fixture operation");
  };
  const source = createSourceAvailabilityService({
    clock: () => record.now,
    findSource: async (providerContentId) => {
      const entry = record.entries.find(
        (item) => item.providerContentId === providerContentId,
      );
      return entry
        ? {
            songId: entry.songId,
            providerContentId,
            observation: entry.sourceAvailability,
            track: { ...entry, isRegionAllowed: true },
          }
        : null;
    },
    persistObservation: async ({ providerContentId, observation, track }) => {
      const entry = record.entries.find(
        (item) => item.providerContentId === providerContentId,
      );
      if (!entry) throw new Error("Missing fixture entry");
      const previousObservation = entry.sourceAvailability;
      entry.sourceAvailability = observation;
      return {
        songId: entry.songId,
        observation,
        previousObservation,
        applied: true,
        track,
      };
    },
    metrics: { record() {} },
    provider: {
      observe: async (providerContentId) => {
        record.providerCalls += 1;
        return record.providerAvailable
          ? {
              type: "available",
              reason: "available",
              track: track(Number(providerContentId)),
            }
          : { type: "unavailable", reason: "not_found", track: null };
      },
    },
  });
  const repository: LockedThemeContentRepository = {
    assertActiveAdmin: async (id) => {
      if (id !== actorId) throw new Error("Unauthorized fixture actor");
    },
    findThemeSummary: async () => ({ ...record.theme }),
    listThemeSongs: async () => structuredClone(record.entries),
    findThemeSong: async (id) =>
      structuredClone(
        record.entries.find((entry) => entry.songId === id) ?? null,
      ),
    findThemeSongByProviderContentId: async (id) =>
      structuredClone(
        record.entries.find((entry) => entry.providerContentId === id) ?? null,
      ),
    setThemeActiveRecord: async (isActive) => {
      record.theme.isActive = isActive;
      record.theme.editorialState = isActive ? "published" : "draft";
      return record.theme.id;
    },
    removeThemeSongRecord: async (id) => {
      record.entries = record.entries.filter((entry) => entry.songId !== id);
      return id;
    },
    updateThemeSongAssociation: unexpected,
    updateThemeRecord: unexpected,
    upsertSongAndAssociation: unexpected,
    upsertThemeSongAssociation: unexpected,
  };
  const content = createThemeContentService({
    clock: () => record.now,
    recordThemeStateEvent: (event) => {
      record.events.push(event);
    },
    observeSourceAvailability: source.observeSource,
    findThemeSummary: repository.findThemeSummary,
    findThemeSong: (_themeId, id) => repository.findThemeSong(id),
    findThemeSongByProviderContentId: (_themeId, id) =>
      repository.findThemeSongByProviderContentId(id),
    withThemeContentLock: async (_id, operation) => {
      const preceding = record.queue;
      let release!: () => void;
      record.queue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await preceding;
      try {
        return await operation(repository);
      } finally {
        release();
      }
    },
    deleteThemeRecord: unexpected,
    removeThemeSongRecord: unexpected,
    setThemeActiveRecord: unexpected,
    themeHasSessions: unexpected,
    updateThemeSongAssociation: unexpected,
    updateThemeRecord: unexpected,
    upsertSongAndAssociation: unexpected,
  });
  const editor = createThemeEditorService({
    clock: () => record.now,
    findThemeSummary: repository.findThemeSummary,
    listThemeSongs: repository.listThemeSongs,
  });
  return { content, editor };
}

export async function readThemeStateFixture(id: string) {
  const record = recordFor(id);
  return {
    editor: await services(record).editor(id),
    providerCalls: record.providerCalls,
    lastEventCause: record.events.at(-1)?.cause ?? "nenhuma",
  };
}

export type FixtureCommand =
  | "publish"
  | "draft"
  | "confirm"
  | "grace"
  | "expire"
  | "recover"
  | "unavailable"
  | "remove"
  | "catalog32"
  | "catalog64"
  | "catalog128";
export async function runThemeStateFixture(
  id: string,
  command: FixtureCommand,
) {
  const record = recordFor(id);
  const { content } = services(record);
  if (
    command === "catalog32" ||
    command === "catalog64" ||
    command === "catalog128"
  ) {
    record.entries = Array.from(
      { length: Number(command.slice(7)) },
      (_, offset) => {
        const item = entry(offset + 1);
        return {
          ...item,
          sourceAvailability: applySourceAvailabilityResult({
            current: null,
            observedAt: record.now,
            result: {
              type: "available",
              reason: "available",
              track: track(offset + 1),
            },
          }),
        };
      },
    );
    return;
  }
  if (command === "publish" || command === "draft")
    return content.setThemePublication(id, command === "publish", actorId);
  if (command === "grace") {
    record.now = new Date("2026-01-08T12:00:00Z");
    return;
  }
  if (command === "expire") {
    record.now = new Date("2026-01-09T00:00:00.001Z");
    return;
  }
  const lastEntry = record.entries.at(-1);
  if (!lastEntry) throw new Error("Empty fixture");
  if (command === "remove")
    return content.removeThemeSong(id, lastEntry.songId);
  record.providerAvailable = command !== "unavailable";
  if (command === "recover") {
    for (const entry of record.entries)
      await content.revalidateSourceAvailability(id, entry.songId);
  } else {
    await content.revalidateSourceAvailability(id, lastEntry.songId);
  }
}
