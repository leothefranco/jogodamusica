import "server-only";

import type { z } from "zod";

import {
  AppError,
  createErrorResponseContext,
  errorResponse,
  fieldErrorsFromZod,
  type ServerFailureReport,
} from "@/lib/errors";
import { reportObservabilityEvent } from "@/server/observability/reporter";
import {
  requestFailureErrorCodeSchema,
  type PublicGameSurface,
} from "@/server/observability/schema";

export async function parsePublicGameBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("INVALID_JSON", "Envie um JSON válido.", 400);
  }

  return parsePublicGameValue(body, schema);
}

export function parsePublicGameValue<T>(
  value: unknown,
  schema: z.ZodType<T>,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new AppError(
      "INVALID_REQUEST",
      "Revise os dados enviados.",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }
  return parsed.data;
}

export async function handlePublicGameRequest(
  operation: () => Promise<Response>,
): Promise<Response>;
export async function handlePublicGameRequest(
  surface: PublicGameSurface,
  operation: () => Promise<Response>,
): Promise<Response>;
export async function handlePublicGameRequest(
  surfaceOrOperation: PublicGameSurface | (() => Promise<Response>),
  operation?: () => Promise<Response>,
): Promise<Response> {
  const surface =
    typeof surfaceOrOperation === "string" ? surfaceOrOperation : undefined;
  const requestOperation =
    typeof surfaceOrOperation === "function" ? surfaceOrOperation : operation!;
  const failureContext = surface ? createErrorResponseContext() : undefined;

  try {
    return await requestOperation();
  } catch (error) {
    return errorResponse(error, {
      ...(surface
        ? {
            reportFailure: (failure: ServerFailureReport) => {
              const controlledCode = requestFailureErrorCodeSchema.safeParse(
                failure.errorCode,
              );
              reportObservabilityEvent({
                eventName: "request_failed",
                correlationId: failure.correlationId,
                payload: {
                  surface,
                  errorCode: controlledCode.success
                    ? controlledCode.data
                    : "INTERNAL_ERROR",
                  status: failure.status,
                  failureClass: failure.failureClass,
                },
              });
            },
            correlateServerFailure: true,
            failureContext,
          }
        : {}),
    });
  }
}
