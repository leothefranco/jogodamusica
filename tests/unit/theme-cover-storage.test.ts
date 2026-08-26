import { describe, expect, it, vi } from "vitest";

import { createThemeCoverStorage } from "@/server/storage/theme-cover-storage";

const reference = {
  bucket: "theme-covers" as const,
  objectKey:
    "10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg",
};

describe("adapter servidor de capa no Storage", () => {
  it("lê metadados pela API oficial e deriva a URL pública canônica", async () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]);
    const download = vi.fn().mockResolvedValue({
      data: new Blob([bytes], { type: "image/jpeg" }),
      error: null,
    });
    const getPublicUrl = vi.fn().mockReturnValue({
      data: { publicUrl: "https://project.supabase.co/canonical-cover.jpg" },
    });
    const from = vi.fn().mockReturnValue({ download, getPublicUrl });
    const storage = createThemeCoverStorage({
      createClient: async () => ({ storage: { from } }),
    });

    await expect(storage.inspect(reference)).resolves.toEqual({
      contentType: "image/jpeg",
      size: bytes.byteLength,
      signatureBytes: bytes,
    });
    await expect(storage.getPublicUrl(reference)).resolves.toBe(
      "https://project.supabase.co/canonical-cover.jpg",
    );
    expect(from).toHaveBeenCalledWith("theme-covers");
    expect(download).toHaveBeenCalledWith(
      reference.objectKey,
      {},
      { cache: "no-store", signal: expect.any(AbortSignal) },
    );
    expect(getPublicUrl).toHaveBeenCalledWith(reference.objectKey);
  });

  it("distingue objeto ausente de falha transitória na leitura", async () => {
    const from = vi.fn().mockReturnValue({
      getPublicUrl: vi.fn(),
      download: vi.fn().mockResolvedValue({
        data: null,
        error: { statusCode: "404" },
      }),
      remove: vi.fn(),
    });
    const storage = createThemeCoverStorage({
      createClient: async () => ({ storage: { from } }),
    });

    await expect(storage.inspect(reference)).rejects.toMatchObject({
      code: "THEME_COVER_NOT_FOUND",
    });

    const transientStorage = createThemeCoverStorage({
      createClient: async () => ({
        storage: {
          from: () => ({
            getPublicUrl: vi.fn(),
            download: vi.fn().mockResolvedValue({
              data: null,
              error: { statusCode: "503" },
            }),
            remove: vi.fn(),
          }),
        },
      }),
    });
    await expect(transientStorage.inspect(reference)).rejects.toMatchObject({
      code: "THEME_COVER_INSPECTION_FAILED",
    });

    const ambiguousBadRequestStorage = createThemeCoverStorage({
      createClient: async () => ({
        storage: {
          from: () => ({
            getPublicUrl: vi.fn(),
            download: vi.fn().mockResolvedValue({
              data: null,
              error: { statusCode: "400" },
            }),
            remove: vi.fn(),
          }),
        },
      }),
    });
    await expect(
      ambiguousBadRequestStorage.inspect(reference),
    ).rejects.toMatchObject({ code: "THEME_COVER_INSPECTION_FAILED" });
  });

  it("reconhece status HTTP 404 mesmo quando statusCode é NoSuchKey", async () => {
    const from = vi.fn().mockReturnValue({
      getPublicUrl: vi.fn(),
      download: vi.fn().mockResolvedValue({
        data: null,
        error: { status: 404, statusCode: "NoSuchKey" },
      }),
      remove: vi.fn().mockResolvedValue({
        data: null,
        error: { status: 404, statusCode: "NoSuchKey" },
      }),
    });
    const storage = createThemeCoverStorage({
      createClient: async () => ({ storage: { from } }),
    });

    await expect(storage.inspect(reference)).rejects.toMatchObject({
      code: "THEME_COVER_NOT_FOUND",
    });
    await expect(storage.remove(reference)).resolves.toBe("already-absent");
  });

  it("considera a remoção repetida de objeto ausente bem-sucedida", async () => {
    const remove = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn().mockReturnValue({ remove });
    const storage = createThemeCoverStorage({
      createClient: async () => ({ storage: { from } }),
    });

    await expect(storage.remove(reference)).resolves.toBe("already-absent");
    expect(remove).toHaveBeenCalledWith([reference.objectKey]);
  });

  it("aborta o fetch autenticado do DELETE e só assenta após o transporte", async () => {
    vi.useFakeTimers();
    let observedSignal: AbortSignal | undefined;
    let transportSettled = false;
    const transport = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        observedSignal = init?.signal ?? undefined;
        await new Promise<never>((_resolve, reject) => {
          observedSignal?.addEventListener(
            "abort",
            () => {
              transportSettled = true;
              reject(observedSignal?.reason);
            },
            { once: true },
          );
        });
        return new Response();
      },
    );
    const createClient = vi.fn(async (options?: { fetch?: typeof fetch }) => ({
      storage: {
        from: () => ({
          download: vi.fn(),
          getPublicUrl: vi.fn(),
          remove: async () => {
            await options?.fetch?.("https://project.supabase.co/delete", {
              method: "DELETE",
            });
            return { data: [{ name: reference.objectKey }], error: null };
          },
        }),
      },
    }));
    const storage = createThemeCoverStorage({
      createClient,
      cleanupTimeoutMs: 25,
      fetchImplementation: transport as typeof fetch,
    });

    try {
      const cleanup = storage.remove(reference);
      const cleanupResult = expect(cleanup).rejects.toMatchObject({
        code: "THEME_COVER_CLEANUP_FAILED",
      });
      await vi.advanceTimersByTimeAsync(25);

      await cleanupResult;
      expect(createClient).toHaveBeenCalledWith({
        fetch: expect.any(Function),
      });
      expect(transport).toHaveBeenCalledOnce();
      expect(observedSignal?.aborted).toBe(true);
      expect(transportSettled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
