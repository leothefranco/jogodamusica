import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type {
  ManagedThemeCoverMetadata,
  ManagedThemeCoverReference,
} from "@/domain/music/theme-cover";
import { AppError } from "@/lib/errors";
import { getPublicSupabaseEnv } from "@/lib/public-env";
import { createClient as createDefaultClient } from "@/lib/supabase/server";

type StorageOperationError = {
  code?: string;
  status?: number;
  statusCode?: number | string;
};

type ThemeCoverBucketClient = {
  download(
    path: string,
    options: Record<string, never>,
    parameters: { cache: "no-store"; signal: AbortSignal },
  ): Promise<{
    data: Blob | null;
    error: StorageOperationError | null;
  }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
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
  createClient(options?: {
    fetch?: typeof fetch;
  }): Promise<ThemeCoverStorageClient>;
  cleanupTimeoutMs?: number;
  fetchImplementation?: typeof fetch;
  inspectionTimeoutMs?: number;
};

function cleanupFailedError() {
  return new AppError(
    "THEME_COVER_CLEANUP_FAILED",
    "Não foi possível remover a capa órfã.",
    502,
  );
}

function fetchWithAbortSignal(
  fetchImplementation: typeof fetch,
  signal: AbortSignal,
): typeof fetch {
  return (input, init) => fetchImplementation(input, { ...init, signal });
}

function isMissingObject(error: StorageOperationError | null) {
  if (!error) return false;

  if (Number(error.status) === 404 || Number(error.statusCode) === 404) {
    return true;
  }

  return [error.code, error.statusCode].some((value) => {
    if (typeof value !== "string") return false;
    const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "notfound" || normalized === "nosuchkey";
  });
}

export function createThemeCoverStorage({
  createClient,
  cleanupTimeoutMs = 5_000,
  fetchImplementation = fetch,
  inspectionTimeoutMs = 10_000,
}: ThemeCoverStorageDependencies) {
  return {
    async inspect(
      reference: ManagedThemeCoverReference,
    ): Promise<ManagedThemeCoverMetadata> {
      const client = await createClient();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), inspectionTimeoutMs);
      let data: Blob | null;
      let error: StorageOperationError | null;

      try {
        ({ data, error } = await client.storage
          .from(reference.bucket)
          .download(
            reference.objectKey,
            {},
            { cache: "no-store", signal: controller.signal },
          ));
      } catch {
        throw new AppError(
          "THEME_COVER_INSPECTION_FAILED",
          "Não foi possível validar a capa enviada.",
          502,
          { coverFile: ["Tente novamente."] },
        );
      } finally {
        clearTimeout(timeout);
      }

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
        contentType: data.type || null,
        size: data.size,
        signatureBytes: new Uint8Array(await data.slice(0, 12).arrayBuffer()),
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), cleanupTimeoutMs);
      let data: Array<{ name?: string }> | null;
      let error: StorageOperationError | null;

      try {
        const client = await createClient({
          fetch: fetchWithAbortSignal(fetchImplementation, controller.signal),
        });
        ({ data, error } = await client.storage
          .from(reference.bucket)
          .remove([reference.objectKey]));
      } catch {
        throw cleanupFailedError();
      } finally {
        clearTimeout(timeout);
      }

      if (error) {
        if (isMissingObject(error)) return "already-absent" as const;
        throw cleanupFailedError();
      }

      return data?.length ? ("removed" as const) : ("already-absent" as const);
    },
  };
}

async function createThemeCoverClient(options?: { fetch?: typeof fetch }) {
  if (!options?.fetch) {
    return (await createDefaultClient()) as ThemeCoverStorageClient;
  }

  const cookieStore = await cookies();
  const env = getPublicSupabaseEnv();
  return createServerClient(env.url, env.publishableKey, {
    global: { fetch: options.fetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options: cookieOptions }) => {
            cookieStore.set(name, value, cookieOptions);
          });
        } catch {
          // Server Components cannot write cookies. The Proxy refreshes them.
        }
      },
    },
  }) as ThemeCoverStorageClient;
}

export const themeCoverStorage = createThemeCoverStorage({
  createClient: createThemeCoverClient,
});
