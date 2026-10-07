import "server-only";
import type { BracketSize } from "@/domain/music/content-validation";
export type GameCreationMetric = {
  metric: "game_creation";
  result: "created" | "insufficient" | "contention_retry" | "failed";
  bracketSize: BracketSize | null;
  mode: "authoritative_direct" | "legacy_guardrail";
  policyVersion: number;
  durationMs: number;
  lockMs: number;
  readMs: number;
  persistMs: number;
};
export type GameCreationMetrics = { record(event: GameCreationMetric): void };
export function recordGameCreationMetric(
  event: GameCreationMetric,
  metrics: GameCreationMetrics = {
    record: (value) => console.info("[game-creation]", value),
  },
) {
  try {
    metrics.record(event);
  } catch {
    /* Never retry or reject a committed game for telemetry. */
  }
}
