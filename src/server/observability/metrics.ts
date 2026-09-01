import { observabilityEventSchema } from "@/server/observability/schema";

export function getObservabilityMetricDimensions(candidate: unknown) {
  const event = observabilityEventSchema.parse(candidate);
  const commonDimensions = {
    eventName: event.eventName,
    environment: event.environment,
    releaseCommit: event.releaseCommit ?? "unknown",
  };

  if (event.eventName === "request_failed") {
    return {
      ...commonDimensions,
      surface: event.payload.surface,
      errorCode: event.payload.errorCode,
      status: event.payload.status,
      failureClass: event.payload.failureClass,
    };
  }

  return {
    ...commonDimensions,
    surface: event.payload.surface,
    playerErrorCode: event.payload.playerErrorCode,
    failureClass: event.payload.failureClass,
  };
}
