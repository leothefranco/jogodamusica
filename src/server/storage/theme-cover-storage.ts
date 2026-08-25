import "server-only";

import type {
  ManagedThemeCoverMetadata,
  ManagedThemeCoverReference,
} from "@/domain/music/theme-cover";
import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";

type StorageOperationError = {
  code?: string;
  status?: number;
  statusCode?: number | string;
};

type ThemeCoverBucketClient = {
  getPublicUrl(path: string): { data: { publicUrl: string } };
  info(path: string): Promise<{
    data: { contentType?: string; size?: number } | null;
    error: StorageOperationError | null;
  }>;
  remove(paths: string[]): Promise<{
    data: Array<{ name?: string }> | null;
    error: StorageOperationError | null;
  }>;
};

type ThemeCoverStorageClient = {
  storage: {
    from(bucket: string): ThemeCoverBucketClient;
  };
};

type ThemeCoverStorageDependencies = {
  createClient(): Promise<ThemeCoverStorageClient>;
};

function isMissingObject(error: StorageOperationError | null) {
  const status = Number(error?.statusCode ?? error?.status);
  return status === 404 || error?.code === "not_found";
}

export function createThemeCoverStorage({
  createClient,
}: ThemeCoverStorageDependencies) {
  return {
    async inspect(
      reference: ManagedThemeCoverReference,
    ): Promise<ManagedThemeCoverMetadata> {
      const client = await createClient();
      const { data, error } = await client.storage
        .from(reference.bucket)
        .info(reference.objectKey);

      if (error || !data) {
        if (isMissingObject(error)) {
          throw new AppError(
            "THEME_COVER_NOT_FOUND",
            "A capa enviada não foi encontrada.",
            400,
            { coverFile: ["Envie a imagem novamente."] },
          );
        }

        throw new AppError(
          "THEME_COVER_INSPECTION_FAILED",
          "Não foi possível validar a capa enviada.",
          502,
          { coverFile: ["Tente novamente."] },
        );
      }

      return {
        contentType: data.contentType ?? null,
        size: data.size ?? null,
      };
    },

    getPublicUrl(reference: ManagedThemeCoverReference) {
      return createClient().then(
        (client) =>
          client.storage
            .from(reference.bucket)
            .getPublicUrl(reference.objectKey).data.publicUrl,
      );
    },

    async remove(reference: ManagedThemeCoverReference) {
      const client = await createClient();
      const { data, error } = await client.storage
        .from(reference.bucket)
        .remove([reference.objectKey]);

      if (error) {
        if (isMissingObject(error)) return "already-absent" as const;
        throw new AppError(
          "THEME_COVER_CLEANUP_FAILED",
          "Não foi possível remover a capa órfã.",
          502,
        );
      }

      return data?.length ? ("removed" as const) : ("already-absent" as const);
    },
  };
}

export const themeCoverStorage = createThemeCoverStorage({
  createClient: async () => (await createClient()) as ThemeCoverStorageClient,
});
