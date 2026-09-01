import "server-only";

import type { ContentActionState } from "@/components/admin/content-action-state";
import { toAppError } from "@/lib/errors";
import type { AdminUser } from "@/server/auth/authorization";
import { ThemeCreationError } from "@/server/services/create-theme-workflow";

type CreateThemeActionAdapterDependencies<TResult> = {
  authenticate(): Promise<AdminUser>;
  createTheme(admin: AdminUser, formData: FormData): Promise<TResult>;
};

export function createThemeActionAdapter<TResult>({
  authenticate,
  createTheme,
}: CreateThemeActionAdapterDependencies<TResult>) {
  return async function runCreateThemeAction(formData: FormData) {
    const admin = await authenticate();
    try {
      return await createTheme(admin, formData);
    } catch (error) {
      const appError = toAppError(error);
      const rawReference = formData.get("coverReference");
      const hasManagedReference =
        rawReference !== null &&
        (typeof rawReference !== "string" || rawReference.trim() !== "");
      const coverReferenceStatus =
        error instanceof ThemeCreationError
          ? error.cleanupStatus
          : hasManagedReference
            ? appError.code === "INVALID_THEME_COVER_REFERENCE" ||
              appError.code === "THEME_COVER_NOT_FOUND"
              ? "rejected"
              : "reusable"
            : undefined;

      return {
        status: "error",
        message: appError.message,
        fieldErrors: appError.fieldErrors,
        ...(coverReferenceStatus ? { coverReferenceStatus } : {}),
      } satisfies ContentActionState;
    }
  };
}
