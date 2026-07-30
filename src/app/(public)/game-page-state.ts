import "server-only";

import { notFound } from "next/navigation";

import { gameParamsSchema } from "@/domain/game/validation";
import { AppError } from "@/lib/errors";
import { getGameState } from "@/server/services/game-service";

export async function getPublicGamePageState(sessionIdValue: string) {
  const params = gameParamsSchema.safeParse({ sessionId: sessionIdValue });
  if (!params.success) notFound();

  try {
    return await getGameState(params.data.sessionId);
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
