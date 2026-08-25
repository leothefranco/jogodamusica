import "server-only";

import type { AdminUser } from "@/server/auth/authorization";
import {
  parseManagedThemeCoverReference,
  validateManagedThemeCoverMetadata,
  type ManagedThemeCoverMetadata,
  type ManagedThemeCoverReference,
} from "@/domain/music/theme-cover";
import { AppError, fieldErrorsFromZod, toAppError } from "@/lib/errors";
import { parseThemeFormData } from "@/server/services/theme-form-data";
import {
  findThemeBySlug,
  insertTheme,
  isThemeCoverUrlReferenced,
  withThemeCoverUrlLock,
} from "@/server/repositories/theme-content-repository";
import { themeCoverStorage } from "@/server/storage/theme-cover-storage";

type ThemeCreationValues = {
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isActive: false;
};

type ThemeCreationRecord = Omit<ThemeCreationValues, "isActive"> & {
  id: string;
  isActive: boolean;
};

type ThemeCreationRepository = {
  findBySlug(slug: string): Promise<ThemeCreationRecord | null>;
  insert(values: ThemeCreationValues): Promise<string | null>;
  isCoverUrlReferenced(coverUrl: string): Promise<boolean>;
};

type ThemeCoverStorage = {
  inspect(
    reference: ManagedThemeCoverReference,
  ): Promise<ManagedThemeCoverMetadata>;
  getPublicUrl(reference: ManagedThemeCoverReference): string | Promise<string>;
  remove(
    reference: ManagedThemeCoverReference,
  ): Promise<"removed" | "already-absent">;
};

type CreateThemeCreationWorkflowDependencies = {
  repository: ThemeCreationRepository;
  storage: ThemeCoverStorage;
  withCoverUrlLock<T>(
    coverUrl: string,
    operation: (repository: ThemeCreationRepository) => Promise<T>,
  ): Promise<T>;
};

export type ThemeCoverCleanupStatus =
  "removed" | "already-absent" | "preserved-in-use" | "cleanup-failed";

export class ThemeCreationError extends AppError {
  constructor(
    error: unknown,
    public readonly cleanupStatus: ThemeCoverCleanupStatus,
  ) {
    const original = toAppError(error);
    super(
      original.code,
      original.message,
      original.status,
      original.fieldErrors,
      original.responseHeaders,
    );
  }
}

async function compensateTrustedCover(
  error: unknown,
  reference: ManagedThemeCoverReference,
  coverUrl: string,
  dependencies: Pick<
    CreateThemeCreationWorkflowDependencies,
    "repository" | "storage"
  >,
): Promise<ThemeCreationError> {
  const original = toAppError(error);

  try {
    if (await dependencies.repository.isCoverUrlReferenced(coverUrl)) {
      return new ThemeCreationError(original, "preserved-in-use");
    }

    const cleanupStatus = await dependencies.storage.remove(reference);
    return new ThemeCreationError(original, cleanupStatus);
  } catch (cleanupError) {
    const cleanup = toAppError(cleanupError);
    console.error("[theme-cover-compensation-failed]", {
      cleanupCode: cleanup.code,
      originalCode: original.code,
    });
    return new ThemeCreationError(original, "cleanup-failed");
  }
}

function themeInputFromFormData(formData: FormData, coverUrl: string | null) {
  const parsed = parseThemeFormData(formData, coverUrl);

  if (!parsed.success) {
    throw new AppError(
      "INVALID_THEME",
      "Revise os campos do tema.",
      400,
      fieldErrorsFromZod(parsed.error.flatten().fieldErrors),
    );
  }

  return parsed.data;
}

function postgresCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function sameCreationPayload(
  existing: ThemeCreationRecord,
  values: ThemeCreationValues,
) {
  return (
    existing.name === values.name &&
    existing.slug === values.slug &&
    existing.description === values.description &&
    existing.coverUrl === values.coverUrl
  );
}

function slugConflict() {
  return new AppError(
    "THEME_SLUG_CONFLICT",
    "Já existe um tema com este slug.",
    409,
    { slug: ["Escolha outro slug."] },
  );
}

async function persistThemeCreation(
  values: ThemeCreationValues,
  repository: ThemeCreationRepository,
  protectTrustedCover: boolean,
) {
  let insertionFailure: unknown = slugConflict();
  try {
    const themeId = await repository.insert(values);
    if (themeId) return { idempotent: false, themeId };
  } catch (error) {
    insertionFailure = error;
  }

  let existing: ThemeCreationRecord | null;
  try {
    existing = await repository.findBySlug(values.slug);
  } catch {
    if (protectTrustedCover) {
      console.error("[theme-cover-compensation-safety-check-failed]", {
        originalCode: toAppError(insertionFailure).code,
      });
      throw new ThemeCreationError(insertionFailure, "cleanup-failed");
    }
    throw insertionFailure;
  }

  if (existing && sameCreationPayload(existing, values)) {
    return { idempotent: true, themeId: existing.id };
  }

  throw postgresCode(insertionFailure) === "23505"
    ? slugConflict()
    : insertionFailure;
}

export function createThemeCreationWorkflow({
  repository,
  storage,
  withCoverUrlLock,
}: CreateThemeCreationWorkflowDependencies) {
  return async function createTheme(
    admin: AdminUser,
    formData: FormData,
  ): Promise<{ idempotent: boolean; themeId: string }> {
    const rawReference = formData.get("coverReference");
    const hasManagedReference =
      rawReference !== null &&
      (typeof rawReference !== "string" || rawReference.trim() !== "");
    const rawCoverUrl = formData.get("coverUrl");
    if (
      rawCoverUrl !== null &&
      (typeof rawCoverUrl !== "string" || rawCoverUrl.trim() !== "")
    ) {
      throw new AppError(
        "INVALID_THEME_COVER_REFERENCE",
        "Envie a capa pelo campo de arquivo.",
        400,
        { coverFile: ["URLs de capa não são aceitas na criação."] },
      );
    }

    if (hasManagedReference) {
      const reference = parseManagedThemeCoverReference(
        rawReference,
        admin.userId,
      );
      const coverUrl = await storage.getPublicUrl(reference);
      let trustedReference = false;
      let trustedValues: ThemeCreationValues | null = null;

      try {
        return await withCoverUrlLock(coverUrl, async (lockedRepository) => {
          const metadata = await storage.inspect(reference);
          trustedReference = true;

          try {
            validateManagedThemeCoverMetadata(reference, metadata);
            const input = themeInputFromFormData(formData, coverUrl);
            const values: ThemeCreationValues = {
              ...input,
              isActive: false,
            };
            trustedValues = values;
            return await persistThemeCreation(values, lockedRepository, true);
          } catch (error) {
            if (error instanceof ThemeCreationError) throw error;
            throw await compensateTrustedCover(error, reference, coverUrl, {
              repository: lockedRepository,
              storage,
            });
          }
        });
      } catch (error) {
        if (
          error instanceof ThemeCreationError ||
          !trustedReference ||
          !trustedValues
        ) {
          throw error;
        }
        const reconciliationValues = trustedValues;

        try {
          return await withCoverUrlLock(coverUrl, async (lockedRepository) => {
            try {
              return await persistThemeCreation(
                reconciliationValues,
                lockedRepository,
                true,
              );
            } catch (reconciliationError) {
              if (reconciliationError instanceof ThemeCreationError) {
                throw new ThemeCreationError(
                  error,
                  reconciliationError.cleanupStatus,
                );
              }

              throw await compensateTrustedCover(error, reference, coverUrl, {
                repository: lockedRepository,
                storage,
              });
            }
          });
        } catch (recoveryError) {
          if (recoveryError instanceof ThemeCreationError) {
            throw recoveryError;
          }

          console.error("[theme-cover-compensation-lock-failed]", {
            originalCode: toAppError(error).code,
          });
          throw new ThemeCreationError(error, "cleanup-failed");
        }
      }
    }

    const input = themeInputFromFormData(formData, null);
    return persistThemeCreation(
      {
        ...input,
        isActive: false,
      },
      repository,
      false,
    );
  };
}

export const createThemeWithManagedCover = createThemeCreationWorkflow({
  repository: {
    findBySlug: findThemeBySlug,
    insert: insertTheme,
    isCoverUrlReferenced: isThemeCoverUrlReferenced,
  },
  storage: themeCoverStorage,
  withCoverUrlLock: withThemeCoverUrlLock,
});
