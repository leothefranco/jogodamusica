import { z } from "zod";

import { bracketSizeSchema } from "@/domain/music/content-validation";

const gameSongSchema = z.object({
  songId: z.string().min(1),
  title: z.string(),
  artist: z.string(),
  thumbnailUrl: z.string(),
  provider: z.literal("youtube"),
  providerContentId: z.string().min(1),
  startTimeSeconds: z.number().nonnegative(),
  previewDurationSeconds: z.number().positive(),
});

const gameSessionSchema = z.object({
  id: z.string().min(1),
  themeId: z.string().min(1),
  bracketSize: bracketSizeSchema,
  status: z.enum(["active", "completed", "abandoned"]),
  currentRound: z.number().int().positive(),
  championSongId: z.string().min(1).nullable(),
  startedAt: z.coerce.date(),
  completedAt: z.coerce.date().nullable(),
});

const gameMatchSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  roundNumber: z.number().int().positive(),
  position: z.number().int().positive(),
  songAId: z.string().min(1).nullable(),
  songBId: z.string().min(1).nullable(),
  winnerSongId: z.string().min(1).nullable(),
  status: z.enum(["pending", "ready", "completed"]),
  completedAt: z.coerce.date().nullable(),
});

const gameStateTransportSchema = z.object({
  theme: z.object({ name: z.string(), slug: z.string().min(1) }),
  session: gameSessionSchema,
  songs: z.array(
    gameSongSchema.extend({
      sessionId: z.string().min(1),
      seed: z.number().int().positive(),
    }),
  ),
  matches: z.array(gameMatchSchema),
  currentMatch: gameMatchSchema.nullable(),
  progress: z.object({
    completedMatches: z.number().int().nonnegative(),
    totalMatches: z.number().int().nonnegative(),
    currentRound: z.number().int().positive(),
    roundCount: z.number().int().positive(),
  }),
});

export function decodeGameState(value: unknown) {
  return gameStateTransportSchema.parse(value);
}
