import "server-only";

import type { z } from "zod";

import { AppError, errorResponse, fieldErrorsFromZod } from "@/lib/errors";

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
) {
  try {
    return await operation();
  } catch (error) {
    return errorResponse(error);
  }
}
