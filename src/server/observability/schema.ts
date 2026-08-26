import { z } from "zod";

import {
  observabilityEnvironmentSchema,
  releaseCommitSchema,
} from "@/lib/env-schema";

const utcTimestampSchema = z
  .string()
  .refine(
    (value) => value.endsWith("Z") && !Number.isNaN(Date.parse(value)),
    "occurredAt precisa ser um timestamp UTC válido.",
  );

export const publicGameSurfaceSchema = z.enum([
  "game_create",
  "game_session",
  "game_decision",
  "game_player_error",
  "theme_catalog",
  "game_result_image",
]);

export const requestFailureErrorCodeSchema = z.enum([
  "INTERNAL_ERROR",
  "INVALID_BRACKET_STATE",
  "INVALID_ROUND_WINNERS",
]);

const eventEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  occurredAt: utcTimestampSchema,
  environment: observabilityEnvironmentSchema,
  releaseCommit: releaseCommitSchema.optional(),
  correlationId: z.string().uuid(),
});

export const requestFailedEventSchema = z
  .object({
    ...eventEnvelopeSchema.shape,
    eventName: z.literal("request_failed"),
    payload: z
      .object({
        surface: publicGameSurfaceSchema,
        errorCode: requestFailureErrorCodeSchema,
        status: z.number().int().min(500).max(599),
        failureClass: z.enum(["expected_app_error", "unexpected_error"]),
      })
      .strict(),
  })
  .strict();

export const playerPlaybackFailedEventSchema = z
  .object({
    ...eventEnvelopeSchema.shape,
    eventName: z.literal("player_playback_failed"),
    payload: z
      .object({
        surface: z.literal("game_player"),
        playerErrorCode: z.union([
          z.literal(2),
          z.literal(5),
          z.literal(100),
          z.literal(101),
          z.literal(150),
        ]),
        failureClass: z.literal("provider_playback"),
      })
      .strict(),
  })
  .strict();

export const observabilityEventSchema = z.discriminatedUnion("eventName", [
  requestFailedEventSchema,
  playerPlaybackFailedEventSchema,
]);

export type PublicGameSurface = z.infer<typeof publicGameSurfaceSchema>;
export type ObservabilityEnvironment = ObservabilityEvent["environment"];
export type RequestFailureErrorCode = z.infer<
  typeof requestFailureErrorCodeSchema
>;
export type PlayerPlaybackErrorCode = z.infer<
  typeof playerPlaybackFailedEventSchema
>["payload"]["playerErrorCode"];
export type ObservabilityEvent = z.infer<typeof observabilityEventSchema>;
