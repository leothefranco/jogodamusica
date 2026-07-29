import { z } from "zod";

import { bracketSizeSchema } from "@/domain/music/content-validation";

export const createGameInputSchema = z.object({
  themeId: z.string().uuid(),
  bracketSize: bracketSizeSchema,
});

export const voteInputSchema = z.object({
  winnerSongId: z.string().uuid(),
});

export const gameParamsSchema = z.object({
  sessionId: z.string().uuid(),
});

export const voteParamsSchema = gameParamsSchema.extend({
  matchId: z.string().uuid(),
});
