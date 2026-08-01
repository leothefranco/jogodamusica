import { z } from "zod";

import { bracketSizeSchema } from "@/domain/music/content-validation";

export const createGameInputSchema = z.object({
  themeId: z.string().uuid(),
  bracketSize: bracketSizeSchema,
});

export const matchDecisionInputSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("vote"),
      winnerSongId: z.string().uuid(),
    })
    .strict(),
  z.object({ type: z.literal("tiebreak") }).strict(),
]);

export const abandonGameInputSchema = z.object({
  action: z.literal("abandon"),
});

export const playbackErrorInputSchema = z.object({
  errorCode: z.union([
    z.literal(2),
    z.literal(5),
    z.literal(100),
    z.literal(101),
    z.literal(150),
  ]),
  matchId: z.string().uuid(),
});

export const gameParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const matchDecisionParamsSchema = gameParamsSchema.extend({
  matchId: z.string().uuid(),
});
