import { AppError, errorResponse } from "@/lib/errors";
import type { AdminUser } from "@/server/auth/authorization";
import type { getAdminUser } from "@/server/auth/session";
import type { enforceRateLimit } from "@/server/services/rate-limit";

type AdminYouTubeHandlerDependencies = {
  enforceRateLimit: typeof enforceRateLimit;
  getAdminUser: typeof getAdminUser;
};

type AdminYouTubeHandlerOptions = {
  limit: number;
  rateLimitKey: string;
  windowMs?: number;
};

export function createAdminYouTubeHandler(
  dependencies: AdminYouTubeHandlerDependencies,
  options: AdminYouTubeHandlerOptions | null,
  operation: (request: Request, admin: AdminUser) => Promise<Response>,
) {
  return async function handler(request: Request) {
    try {
      const admin = await dependencies.getAdminUser();
      if (!admin) {
        throw new AppError(
          "UNAUTHORIZED",
          "Acesso administrativo necessário.",
          401,
        );
      }

      if (options) {
        await dependencies.enforceRateLimit(
          `${options.rateLimitKey}:${admin.userId}`,
          {
            limit: options.limit,
            windowMs: options.windowMs ?? 60_000,
          },
        );
      }

      return await operation(request, admin);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

export async function readJsonBody(
  request: Request,
  message: string,
): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", message, 400, {
      body: ["Envie um corpo JSON válido."],
    });
  }
}
