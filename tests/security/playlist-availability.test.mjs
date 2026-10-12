import assert from "node:assert/strict";
import test from "node:test";
import { normalizePlaylistAvailability } from "../../src/domain/music/source-availability.ts";

test("playlist normaliza ausentes e bloqueados e limita a mutação às Fontes solicitadas", () => {
  const observedAt = new Date("2026-10-11T12:00:00.000Z");
  const track = {
    providerContentId: "shared00001",
    sourceTitle: "QA",
    sourceChannel: "QA",
    thumbnailUrl: "/qa.jpg",
    durationSeconds: 180,
    isEmbeddable: true,
    isRegionAllowed: true,
  };
  const attempts = normalizePlaylistAvailability(
    ["shared00001", "missing0001", "blocked0001", "shared00001"],
    [
      track,
      { ...track, providerContentId: "blocked0001", isRegionAllowed: false },
      { ...track, providerContentId: "unwanted001" },
    ],
    observedAt,
  );
  assert.deepEqual(
    attempts.map(({ providerContentId, result, observedAt }) => [
      providerContentId,
      result.type,
      result.reason,
      observedAt.toISOString(),
    ]),
    [
      ["shared00001", "available", "available", "2026-10-11T12:00:00.000Z"],
      ["missing0001", "unavailable", "not_found", "2026-10-11T12:00:00.000Z"],
      [
        "blocked0001",
        "unavailable",
        "region_blocked",
        "2026-10-11T12:00:00.000Z",
      ],
    ],
  );
  assert.equal(attempts[1].result.track, null);
});
