export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly fieldErrors: FieldErrors | null = null,
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
  const appError = toAppError(error);

  return Response.json(
    {
      error: {
        code: appError.code,
        message: appError.message,
        fieldErrors: appError.fieldErrors,
      },
    },
    { status: appError.status },
  );
}
