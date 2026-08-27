import "server-only";

import { createHash } from "node:crypto";

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
  withThemeCoverCleanupSlot,
  withThemeCoverOperationLock,
} from "@/server/services/theme-cover-operation-lock";
import {
  acquireThemeCoverClaim,
  finalizeThemeCoverCleanup,
  findThemeBySlug,
  insertTheme,
  isThemeCoverUrlReferenced,
  prepareThemeCoverCleanup,
  type ThemeCoverClaim,
  type ThemeCoverClaimAcquisition,
  type ThemeCoverCleanupClaim,
  withThemeCoverClaimPersistence,
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
  coverClaims: {
    acquire(input: {
      bucket: ManagedThemeCoverReference["bucket"];
      objectKey: string;
      actorId: string;
      ownerId: string;
      payloadHash: string;
    }): Promise<ThemeCoverClaimAcquisition>;
    withPersistence<T extends { themeId: string }>(
      claim: ThemeCoverClaim,
      operation: (repository: ThemeCreationRepository) => Promise<T>,
    ): Promise<T>;
    prepareCleanup(
      claim: ThemeCoverClaim,
      coverUrl: string,
    ): Promise<
      | { status: "preserved-in-use" }
      | { status: "cleanup-ready"; claim: ThemeCoverCleanupClaim }
      | { status: "already-absent" }
    >;
    finalizeCleanup(
      claim: ThemeCoverCleanupClaim,
      outcome: "deleted" | "delete-failed",
    ): Promise<void>;
  };
  withCoverOperationLock<T>(
    coverUrl: string,
    operation: () => Promise<T>,
  ): Promise<T>;
  withCoverCleanupSlot<T>(operation: () => Promise<T>): Promise<T>;
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

function creationPayloadHash(formData: FormData) {
  const parsed = parseThemeFormData(formData, null);
  const requiredText = (field: "name" | "slug") => {
    const raw = formData.get(field);
    return typeof raw === "string"
      ? (["text", raw.trim()] as const)
      : (["non-text"] as const);
  };
  const optionalText = (field: "description") => {
    const raw = formData.get(field);
    if (typeof raw !== "string") return ["non-text"] as const;

    const normalized = raw.trim();
    return normalized === ""
      ? (["null"] as const)
      : (["text", normalized] as const);
  };

  return createHash("sha256")
    .update(
      JSON.stringify({
        version: 2,
        fields: parsed.success
          ? {
              name: parsed.data.name,
              slug: parsed.data.slug,
              description: parsed.data.description,
            }
          : {
              name: requiredText("name"),
              slug: requiredText("slug"),
              description: optionalText("description"),
            },
      }),
    )
    .digest("hex");
}

function claimConflict() {
  return new AppError(
    "THEME_COVER_CLAIM_CONFLICT",
    "Esta capa já está associada a outra tentativa de criação.",
    409,
    { coverFile: ["Envie uma nova capa para este tema."] },
  );
}

function claimUnavailable() {
  return new AppError(
    "THEME_COVER_CLAIM_UNAVAILABLE",
    "Esta capa não pode mais ser usada para criar o tema.",
    409,
    { coverFile: ["Envie a capa novamente e tente de novo."] },
  );
}

async function compensateTrustedCover(
  error: unknown,
  reference: ManagedThemeCoverReference,
  coverUrl: string,
  claim: ThemeCoverClaim,
  dependencies: Pick<
    CreateThemeCreationWorkflowDependencies,
    "storage" | "withCoverCleanupSlot"
  > & {
    coverClaims: CreateThemeCreationWorkflowDependencies["coverClaims"];
  },
): Promise<ThemeCreationError> {
  const original = toAppError(error);

  try {
    return await dependencies.withCoverCleanupSlot(async () => {
      const cleanup = await dependencies.coverClaims.prepareCleanup(
        claim,
        coverUrl,
      );
      if (cleanup.status === "preserved-in-use") {
        return new ThemeCreationError(original, "preserved-in-use");
      }
      if (cleanup.status === "already-absent") {
        return new ThemeCreationError(original, "already-absent");
      }

      try {
        const cleanupStatus = await dependencies.storage.remove(reference);
        await dependencies.coverClaims.finalizeCleanup(
          cleanup.claim,
          "deleted",
        );
        return new ThemeCreationError(original, cleanupStatus);
      } catch (cleanupError) {
        try {
          await dependencies.coverClaims.finalizeCleanup(
            cleanup.claim,
            "delete-failed",
          );
        } catch {
          // The deleting tombstone remains recoverable by a later workflow call.
        }

        const cleanupFailure = toAppError(cleanupError);
        console.error("[theme-cover-compensation-failed]", {
          cleanupCode: cleanupFailure.code,
          originalCode: original.code,
        });
        return new ThemeCreationError(original, "cleanup-failed");
      }
    });
  } catch (cleanupError) {
    const cleanup = toAppError(cleanupError);
    console.error("[theme-cover-compensation-failed]", {
      cleanupCode: cleanup.code,
      originalCode: original.code,
    });
    return new ThemeCreationError(original, "cleanup-failed");
  }
}

async function resumeTrustedCoverCleanup(
  reference: ManagedThemeCoverReference,
  claim: ThemeCoverCleanupClaim,
  dependencies: Pick<
    CreateThemeCreationWorkflowDependencies,
    "storage" | "withCoverCleanupSlot"
  > & {
    coverClaims: CreateThemeCreationWorkflowDependencies["coverClaims"];
  },
) {
  const original = claimUnavailable();
  try {
    return await dependencies.withCoverCleanupSlot(async () => {
      try {
        const cleanupStatus = await dependencies.storage.remove(reference);
        await dependencies.coverClaims.finalizeCleanup(claim, "deleted");
        return new ThemeCreationError(original, cleanupStatus);
      } catch (cleanupError) {
        try {
          await dependencies.coverClaims.finalizeCleanup(
            claim,
            "delete-failed",
          );
        } catch {
          // A later workflow call can reclaim the deleting lease.
        }

        console.error("[theme-cover-compensation-failed]", {
          cleanupCode: toAppError(cleanupError).code,
          originalCode: original.code,
        });
        return new ThemeCreationError(original, "cleanup-failed");
      }
    });
  } catch (cleanupError) {
    console.error("[theme-cover-compensation-failed]", {
      cleanupCode: toAppError(cleanupError).code,
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
  coverClaims,
  withCoverOperationLock,
  withCoverCleanupSlot,
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

      return withCoverOperationLock(coverUrl, async () => {
        const acquisition = await coverClaims.acquire({
          bucket: reference.bucket,
          objectKey: reference.objectKey,
          actorId: admin.userId,
          ownerId: admin.userId,
          payloadHash: creationPayloadHash(formData),
        });
        if (acquisition.status === "conflict") throw claimConflict();
        if (acquisition.status === "deleted") throw claimUnavailable();
        if (acquisition.status === "cleanup-required") {
          throw await resumeTrustedCoverCleanup(reference, acquisition.claim, {
            coverClaims,
            storage,
            withCoverCleanupSlot,
          });
        }

        const claim = acquisition.claim;
        let values: ThemeCreationValues;

        try {
          if (acquisition.status !== "consumed") {
            const metadata = await storage.inspect(reference);
            validateManagedThemeCoverMetadata(reference, metadata);
          }
          const input = themeInputFromFormData(formData, coverUrl);
          values = {
            ...input,
            isActive: false,
          };
        } catch (error) {
          if (toAppError(error).code === "THEME_COVER_INSPECTION_FAILED") {
            throw error;
          }

          throw await compensateTrustedCover(
            error,
            reference,
            coverUrl,
            claim,
            {
              coverClaims,
              storage,
              withCoverCleanupSlot,
            },
          );
        }

        try {
          return await coverClaims.withPersistence(claim, (lockedRepository) =>
            persistThemeCreation(values, lockedRepository, true),
          );
        } catch (error) {
          if (error instanceof ThemeCreationError) throw error;

          try {
            return await coverClaims.withPersistence(
              claim,
              async (lockedRepository) => {
                try {
                  return await persistThemeCreation(
                    values,
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

                  throw reconciliationError;
                }
              },
            );
          } catch (recoveryError) {
            if (recoveryError instanceof ThemeCreationError) {
              throw recoveryError;
            }

            throw await compensateTrustedCover(
              error,
              reference,
              coverUrl,
              claim,
              {
                coverClaims,
                storage,
                withCoverCleanupSlot,
              },
            );
          }
        }
      });
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
  coverClaims: {
    acquire: acquireThemeCoverClaim,
    withPersistence: withThemeCoverClaimPersistence,
    prepareCleanup: prepareThemeCoverCleanup,
    finalizeCleanup: finalizeThemeCoverCleanup,
  },
  withCoverCleanupSlot: withThemeCoverCleanupSlot,
  withCoverOperationLock: withThemeCoverOperationLock,
});
