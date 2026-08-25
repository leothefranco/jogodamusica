import { redactDiagnostic } from "@/server/observability/redaction";

export type FieldErrors = Record<string, string[]>;

const safeServerErrorMessage = "Não foi possível concluir a operação.";

export type ServerFailureReport = {
  correlationId: string;
  errorCode: string;
  status: number;
  failureClass: "expected_app_error" | "unexpected_error";
};

type Failure = {
  error: unknown;
  correlationId: string;
  diagnosticLogged: boolean;
  reported: boolean;
};

export type ErrorResponseContext = {
  failure?: Failure;
};

export function createErrorResponseContext(): ErrorResponseContext {
  return {};
}

function getFailure(error: unknown, context: ErrorResponseContext): Failure {
  if (context.failure && Object.is(context.failure.error, error)) {
    return context.failure;
  }

  const failure = {
    error,
    correlationId: crypto.randomUUID(),
    diagnosticLogged: false,
    reported: false,
  };
  context.failure = failure;
  return failure;
}

function serializeErrorCause(cause: unknown, depth = 0): unknown {
  if (depth >= 2 || cause === undefined) return undefined;
  if (!(cause instanceof Error)) return { type: typeof cause };

  return {
    name: redactDiagnostic(cause.name),
    message: redactDiagnostic(cause.message),
    ...(cause.cause === undefined
      ? {}
      : { cause: serializeErrorCause(cause.cause, depth + 1) }),
  };
}

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors: FieldErrors | null = null,
    public readonly responseHeaders?: HeadersInit,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  return new AppError(
    "INTERNAL_ERROR",
    "Não foi possível concluir a operação.",
    500,
  );
}

export function fieldErrorsFromZod(
  fieldErrors: Record<string, string[] | undefined>,
): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).filter((entry): entry is [string, string[]] =>
      Boolean(entry[1]?.length),
    ),
  );
}

export function errorResponse(
  error: unknown,
  options: {
    correlateServerFailure?: boolean;
    failureContext?: ErrorResponseContext;
    reportFailure?(failure: ServerFailureReport): void;
  } = {},
) {
  const isUnexpected = !(error instanceof AppError);
  const appError = toAppError(error);
  const isServerFailure = appError.status >= 500 && appError.status <= 599;
  const shouldCorrelate =
    isServerFailure && (isUnexpected || options.correlateServerFailure);
  const failure = shouldCorrelate
    ? getFailure(error, options.failureContext ?? createErrorResponseContext())
    : undefined;
  const requestId = failure?.correlationId;
  const headers = new Headers(appError.responseHeaders);

  if (requestId) {
    headers.set("x-request-id", requestId);
  }

  if (requestId && isUnexpected && !failure.diagnosticLogged) {
    failure.diagnosticLogged = true;
    console.error("[server-error]", {
      requestId,
      name: redactDiagnostic(
        error instanceof Error ? error.name : typeof error,
      ),
      ...(error instanceof Error
        ? {
            message: redactDiagnostic(error.message),
            stack: error.stack
              ? redactDiagnostic(error.stack)
              : "Stack indisponível.",
            ...(error.cause === undefined
              ? {}
              : { cause: serializeErrorCause(error.cause) }),
          }
        : {}),
      occurredAt: new Date().toISOString(),
    });
  }

  if (requestId && options.reportFailure && !failure.reported) {
    failure.reported = true;
    try {
      options.reportFailure({
        correlationId: requestId,
        errorCode: appError.code,
        status: appError.status,
        failureClass: isUnexpected ? "unexpected_error" : "expected_app_error",
      });
    } catch {
      // Reporting is best effort and cannot alter the public response.
    }
  }

  const responseError = shouldCorrelate
    ? {
        code: appError.code,
        message: safeServerErrorMessage,
        fieldErrors: null,
      }
    : {
        code: appError.code,
        message: appError.message,
        fieldErrors: appError.fieldErrors,
      };

  return Response.json(
    {
      error: {
        ...responseError,
        ...(requestId ? { requestId } : {}),
      },
    },
    { status: appError.status, headers },
  );
}
