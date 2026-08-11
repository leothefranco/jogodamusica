export type FieldErrors = Record<string, string[]>;

function redactDiagnostic(value: string) {
  return value
    .replace(
      /\b(password|passwd|senha|secret|token|api[_-]?key|authorization)\b(\s*[:=]\s*)([^\s,;]+)/gi,
      "$1$2[REDACTED]",
    )
    .replace(/\bBearer\s+[^\s,;]+/gi, "Bearer [REDACTED]")
    .replace(
      /\b(postgres(?:ql)?):\/\/[^\s/@]+:[^\s/@]+@/gi,
      "$1://[REDACTED]@",
    );
}

function serializeErrorCause(cause: unknown, depth = 0): unknown {
  if (depth >= 2 || cause === undefined) return undefined;
  if (!(cause instanceof Error)) return { type: typeof cause };

  return {
    name: cause.name,
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

export function errorResponse(error: unknown) {
  const isUnexpected = !(error instanceof AppError);
  const appError = toAppError(error);
  const requestId = isUnexpected ? crypto.randomUUID() : undefined;
  const headers = new Headers(appError.responseHeaders);

  if (requestId) {
    headers.set("x-request-id", requestId);
    console.error("[server-error]", {
      requestId,
      name: error instanceof Error ? error.name : typeof error,
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

  return Response.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        fieldErrors: appError.fieldErrors,
        ...(requestId ? { requestId } : {}),
      },
    },
    { status: appError.status, headers },
  );
}
