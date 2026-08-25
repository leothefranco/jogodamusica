import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { createThemeCreationWorkflow } from "@/server/services/create-theme-workflow";

const coverReference = {
  bucket: "theme-covers" as const,
  objectKey:
    "10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg",
};
const canonicalCoverUrl =
  "https://project.supabase.co/storage/v1/object/public/theme-covers/10000000-0000-4000-8000-000000000001/30000000-0000-4000-8000-000000000003.jpg";
const validJpegMetadata = {
  contentType: "image/jpeg",
  size: 4,
  signatureBytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
};

const admin = {
  userId: "10000000-0000-4000-8000-000000000001",
  email: "admin@example.com",
  displayName: "Admin",
  role: "admin" as const,
};

function validFormData() {
  const formData = new FormData();
  formData.set("name", "  Clássicos  ");
  formData.set("slug", "classicos");
  formData.set("description", "");
  return formData;
}

type WorkflowDependencies = Parameters<typeof createThemeCreationWorkflow>[0];

function createWorkflow(
  dependencies: Omit<
    WorkflowDependencies,
    "withCoverOperationLock" | "withCoverUrlLock"
  > &
    Partial<
      Pick<WorkflowDependencies, "withCoverOperationLock" | "withCoverUrlLock">
    >,
) {
  const withCoverOperationLock =
    dependencies.withCoverOperationLock ??
    (<T>(_coverUrl: string, operation: () => Promise<T>) => operation());
  const withCoverUrlLock =
    dependencies.withCoverUrlLock ??
    (<T>(
      _coverUrl: string,
      operation: (repository: WorkflowDependencies["repository"]) => Promise<T>,
    ) => operation(dependencies.repository));

  return createThemeCreationWorkflow({
    ...dependencies,
    withCoverOperationLock,
    withCoverUrlLock,
  });
}

describe("criação de tema", () => {
  it("cria sem capa sem acessar o Storage", async () => {
    const storage = {
      inspect: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue("20000000-0000-4000-8000-000000000002"),
      isCoverUrlReferenced: vi.fn(),
    };
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, validFormData())).resolves.toEqual({
      idempotent: false,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(repository.insert).toHaveBeenCalledWith({
      name: "Clássicos",
      slug: "classicos",
      description: null,
      coverUrl: null,
      isActive: false,
    });
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(storage.getPublicUrl).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("reconhece retry idêntico sem capa sem acessar o Storage", async () => {
    const storage = {
      inspect: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({
        id: "20000000-0000-4000-8000-000000000002",
        name: "Clássicos",
        slug: "classicos",
        description: null,
        coverUrl: null,
        isActive: false,
      }),
      insert: vi.fn().mockRejectedValue({ code: "23505" }),
      isCoverUrlReferenced: vi.fn(),
    };
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, validFormData())).resolves.toEqual({
      idempotent: true,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("preserva o conflito de slug sem capa e sem acessar o Storage", async () => {
    const storage = {
      inspect: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({
        id: "20000000-0000-4000-8000-000000000002",
        name: "Outro tema",
        slug: "classicos",
        description: null,
        coverUrl: null,
        isActive: false,
      }),
      insert: vi.fn().mockRejectedValue({ code: "23505" }),
      isCoverUrlReferenced: vi.fn(),
    };
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, validFormData())).rejects.toMatchObject({
      code: "THEME_SLUG_CONFLICT",
      fieldErrors: { slug: ["Escolha outro slug."] },
    });
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("rejeita URL arbitrária na criação sem consultar Storage ou banco", async () => {
    const storage = {
      inspect: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn(),
      insert: vi.fn(),
      isCoverUrlReferenced: vi.fn(),
    };
    const formData = validFormData();
    formData.set("coverUrl", "https://example.com/capa.jpg");
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      code: "INVALID_THEME_COVER_REFERENCE",
    });
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejeita referência não textual sem convertê-la em criação sem capa", async () => {
    const storage = {
      inspect: vi.fn(),
      getPublicUrl: vi.fn(),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn(),
      insert: vi.fn(),
      isCoverUrlReferenced: vi.fn(),
    };
    const formData = validFormData();
    formData.set("coverReference", new File(["não é JSON"], "referencia.txt"));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      code: "INVALID_THEME_COVER_REFERENCE",
    });
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("persiste a URL canônica derivada da referência validada", async () => {
    const callOrder: string[] = [];
    const storage = {
      inspect: vi.fn(async () => {
        callOrder.push("inspect");
        return validJpegMetadata;
      }),
      getPublicUrl: vi.fn(() => {
        callOrder.push("canonical-url");
        return canonicalCoverUrl;
      }),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockResolvedValue("20000000-0000-4000-8000-000000000002"),
      isCoverUrlReferenced: vi.fn(),
    };
    const withCoverUrlLock = vi.fn(async (_coverUrl, operation) => {
      callOrder.push("lock");
      return operation(repository);
    });
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      withCoverUrlLock,
    });

    await expect(createTheme(admin, formData)).resolves.toEqual({
      idempotent: false,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(storage.inspect).toHaveBeenCalledWith(coverReference);
    expect(storage.getPublicUrl).toHaveBeenCalledWith(coverReference);
    expect(withCoverUrlLock).toHaveBeenCalledWith(
      canonicalCoverUrl,
      expect.any(Function),
    );
    expect(callOrder).toEqual(["canonical-url", "inspect", "lock"]);
    expect(repository.insert).toHaveBeenCalledWith({
      name: "Clássicos",
      slug: "classicos",
      description: null,
      coverUrl: canonicalCoverUrl,
      isActive: false,
    });
  });

  it("não compensa antes de conseguir derivar a URL canônica", async () => {
    const originalError = new AppError(
      "THEME_COVER_CANONICAL_URL_FAILED",
      "Não foi possível derivar a URL.",
      502,
    );
    const storage = {
      inspect: vi.fn(),
      getPublicUrl: vi.fn().mockRejectedValue(originalError),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn(),
      insert: vi.fn(),
      isCoverUrlReferenced: vi.fn(),
    };
    const withCoverUrlLock = vi.fn();
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      withCoverUrlLock,
    });

    await expect(createTheme(admin, formData)).rejects.toBe(originalError);
    expect(storage.inspect).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(withCoverUrlLock).not.toHaveBeenCalled();
  });

  it("compensa a capa confiável quando os campos do tema são inválidos", async () => {
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn().mockResolvedValue("removed" as const),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn(),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
    };
    const formData = validFormData();
    formData.set("name", "");
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "removed",
      code: "INVALID_THEME",
    });
    expect(storage.remove).toHaveBeenCalledWith(coverReference);
    expect(repository.insert).not.toHaveBeenCalled();
  });

  it("rejeita e compensa uma assinatura inválida antes de persistir", async () => {
    const storage = {
      inspect: vi.fn().mockResolvedValue({
        contentType: "image/jpeg",
        size: 4,
        signatureBytes: Uint8Array.from([0x4d, 0x5a, 0x90, 0x00]),
      }),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn().mockResolvedValue("removed" as const),
    };
    const repository = {
      findBySlug: vi.fn(),
      insert: vi.fn(),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "removed",
      code: "INVALID_THEME_COVER_METADATA",
    });
    expect(repository.insert).not.toHaveBeenCalled();
    expect(storage.remove).toHaveBeenCalledWith(coverReference);
  });

  it("não executa inspect ou remove enquanto a transação do banco está aberta", async () => {
    let databaseTransactionOpen = false;
    const originalError = new AppError(
      "THEME_DATABASE_FAILED",
      "O tema não foi salvo.",
      500,
    );
    const storage = {
      inspect: vi.fn(async () => {
        expect(databaseTransactionOpen).toBe(false);
        return {
          contentType: "image/jpeg",
          size: 4,
          signatureBytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xdb]),
        };
      }),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(async () => {
        expect(databaseTransactionOpen).toBe(false);
        return "removed" as const;
      }),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockRejectedValue(originalError),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
    };
    const withCoverUrlLock: WorkflowDependencies["withCoverUrlLock"] = async (
      _coverUrl,
      operation,
    ) => {
      databaseTransactionOpen = true;
      try {
        return await operation(repository);
      } finally {
        databaseTransactionOpen = false;
      }
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      withCoverUrlLock,
    });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "removed",
      code: "THEME_DATABASE_FAILED",
    });
    expect(storage.inspect).toHaveBeenCalledOnce();
    expect(storage.remove).toHaveBeenCalledOnce();
  });

  it.each([
    [
      "MIME",
      {
        contentType: "image/gif",
        size: 4,
        signatureBytes: Uint8Array.from([0x47, 0x49, 0x46]),
      },
    ],
    ["tamanho", { ...validJpegMetadata, size: 0 }],
  ])(
    "compensa a capa existente quando seus metadados falham por %s",
    async (_label, metadata) => {
      const storage = {
        inspect: vi.fn().mockResolvedValue(metadata),
        getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
        remove: vi.fn().mockResolvedValue("removed" as const),
      };
      const repository = {
        findBySlug: vi.fn(),
        insert: vi.fn(),
        isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
      };
      const formData = validFormData();
      formData.set("coverReference", JSON.stringify(coverReference));
      const createTheme = createWorkflow({ repository, storage });

      await expect(createTheme(admin, formData)).rejects.toMatchObject({
        cleanupStatus: "removed",
        code: "INVALID_THEME_COVER_METADATA",
      });
      expect(repository.insert).not.toHaveBeenCalled();
      expect(storage.remove).toHaveBeenCalledWith(coverReference);
    },
  );

  it("reconhece o retry idêntico depois que a resposta de criação se perde", async () => {
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({
        id: "20000000-0000-4000-8000-000000000002",
        name: "Clássicos",
        slug: "classicos",
        description: null,
        coverUrl: canonicalCoverUrl,
        isActive: false as const,
      }),
      insert: vi.fn().mockResolvedValue(null),
      isCoverUrlReferenced: vi.fn(),
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).resolves.toEqual({
      idempotent: true,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("mantém conflito para payload divergente sem apagar a capa vencedora", async () => {
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({
        id: "20000000-0000-4000-8000-000000000002",
        name: "Outro nome",
        slug: "classicos",
        description: null,
        coverUrl: canonicalCoverUrl,
        isActive: false,
      }),
      insert: vi.fn().mockResolvedValue(null),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(true),
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "preserved-in-use",
      code: "THEME_SLUG_CONFLICT",
      fieldErrors: { slug: ["Escolha outro slug."] },
    });
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("serializa o resultado concorrente pelo slug sem apagar a capa consumida", async () => {
    type StoredTheme = {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      coverUrl: string | null;
      isActive: boolean;
    };
    let storedTheme: StoredTheme | null = null;
    let insertedThemeCount = 0;
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn(async () => storedTheme),
      insert: vi.fn(async (values: Omit<StoredTheme, "id">) => {
        await Promise.resolve();
        if (storedTheme) return null;
        insertedThemeCount += 1;
        storedTheme = {
          id: "20000000-0000-4000-8000-000000000002",
          ...values,
        };
        return storedTheme.id;
      }),
      isCoverUrlReferenced: vi.fn(async () => Boolean(storedTheme)),
    };
    let lockQueue = Promise.resolve();
    const lockedCoverUrls: string[] = [];
    const withCoverOperationLock: WorkflowDependencies["withCoverOperationLock"] =
      async (coverUrl, operation) => {
        lockedCoverUrls.push(coverUrl);
        const previous = lockQueue;
        let release = () => {};
        lockQueue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await operation();
        } finally {
          release();
        }
      };
    const createTheme = createWorkflow({
      repository,
      storage,
      withCoverOperationLock,
    });
    const first = validFormData();
    first.set("coverReference", JSON.stringify(coverReference));
    const second = validFormData();
    second.set("coverReference", JSON.stringify(coverReference));

    const results = await Promise.all([
      createTheme(admin, first),
      createTheme(admin, second),
    ]);

    expect(results).toEqual([
      {
        idempotent: false,
        themeId: "20000000-0000-4000-8000-000000000002",
      },
      {
        idempotent: true,
        themeId: "20000000-0000-4000-8000-000000000002",
      },
    ]);
    expect(insertedThemeCount).toBe(1);
    expect(lockedCoverUrls).toEqual([canonicalCoverUrl, canonicalCoverUrl]);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("não apaga a capa vencedora quando um concorrente falha depois do lock", async () => {
    type StoredTheme = {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      coverUrl: string | null;
      isActive: boolean;
    };
    let storedTheme: StoredTheme | null = null;
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn(async () => storedTheme),
      insert: vi.fn(async (values: Omit<StoredTheme, "id">) => {
        if (storedTheme) return null;
        storedTheme = {
          id: "20000000-0000-4000-8000-000000000002",
          ...values,
        };
        return storedTheme.id;
      }),
      isCoverUrlReferenced: vi.fn(async () => Boolean(storedTheme)),
    };
    let lockQueue = Promise.resolve();
    const withCoverOperationLock: WorkflowDependencies["withCoverOperationLock"] =
      async (_coverUrl, operation) => {
        const previous = lockQueue;
        let release = () => {};
        lockQueue = new Promise<void>((resolve) => {
          release = resolve;
        });
        await previous;
        try {
          return await operation();
        } finally {
          release();
        }
      };
    const createTheme = createWorkflow({
      repository,
      storage,
      withCoverOperationLock,
    });
    const winner = validFormData();
    winner.set("coverReference", JSON.stringify(coverReference));
    const failedContender = validFormData();
    failedContender.set("name", "");
    failedContender.set("coverReference", JSON.stringify(coverReference));

    const [winnerResult, failedResult] = await Promise.allSettled([
      createTheme(admin, winner),
      createTheme(admin, failedContender),
    ]);

    expect(winnerResult).toMatchObject({
      status: "fulfilled",
      value: {
        idempotent: false,
        themeId: "20000000-0000-4000-8000-000000000002",
      },
    });
    expect(failedResult).toMatchObject({
      status: "rejected",
      reason: {
        cleanupStatus: "preserved-in-use",
        code: "INVALID_THEME",
      },
    });
    expect(repository.isCoverUrlReferenced).toHaveBeenCalledWith(
      canonicalCoverUrl,
    );
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("reconcilia como sucesso idempotente um commit que venceu sem resposta", async () => {
    const commitError = new AppError(
      "THEME_DATABASE_COMMIT_FAILED",
      "Não foi possível confirmar a criação.",
      500,
    );
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue({
        id: "20000000-0000-4000-8000-000000000002",
        name: "Clássicos",
        slug: "classicos",
        description: null,
        coverUrl: canonicalCoverUrl,
        isActive: false,
      }),
      insert: vi
        .fn()
        .mockResolvedValueOnce("20000000-0000-4000-8000-000000000002")
        .mockResolvedValueOnce(null),
      isCoverUrlReferenced: vi.fn(),
    };
    let lockCalls = 0;
    const withCoverUrlLock: WorkflowDependencies["withCoverUrlLock"] = async (
      _coverUrl,
      operation,
    ) => {
      lockCalls += 1;
      const result = await operation(repository);
      if (lockCalls === 1) throw commitError;
      return result;
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      withCoverUrlLock,
    });

    await expect(createTheme(admin, formData)).resolves.toEqual({
      idempotent: true,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(lockCalls).toBe(2);
    expect(repository.insert).toHaveBeenCalledTimes(2);
    expect(repository.isCoverUrlReferenced).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("preserva o erro original quando a compensação falha", async () => {
    const originalError = new AppError(
      "THEME_RULE_REJECTED",
      "O tema não atende à regra.",
      409,
    );
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi
        .fn()
        .mockRejectedValue(
          new AppError("THEME_COVER_CLEANUP_FAILED", "Falha externa.", 502),
        ),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockRejectedValue(originalError),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "cleanup-failed",
      code: "THEME_RULE_REJECTED",
      message: "O tema não atende à regra.",
    });
    expect(log).toHaveBeenCalledWith("[theme-cover-compensation-failed]", {
      cleanupCode: "THEME_COVER_CLEANUP_FAILED",
      originalCode: "THEME_RULE_REJECTED",
    });
    log.mockRestore();
  });

  it("distingue cleanup idempotente após falha do banco", async () => {
    const originalError = new AppError(
      "THEME_DATABASE_FAILED",
      "O tema não foi salvo.",
      500,
    );
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn().mockResolvedValue("already-absent" as const),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockRejectedValue(originalError),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "already-absent",
      code: "THEME_DATABASE_FAILED",
      message: "O tema não foi salvo.",
    });
    expect(storage.remove).toHaveBeenCalledOnce();
  });

  it("não apaga a capa quando o banco não consegue provar se ela foi consumida", async () => {
    const originalError = new AppError(
      "THEME_DATABASE_FAILED",
      "O tema não foi salvo.",
      500,
    );
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(),
    };
    const repository = {
      findBySlug: vi.fn().mockRejectedValue(new Error("lookup unavailable")),
      insert: vi.fn().mockRejectedValue(originalError),
      isCoverUrlReferenced: vi.fn(),
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({ repository, storage });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "cleanup-failed",
      code: "THEME_DATABASE_FAILED",
      message: "O tema não foi salvo.",
    });
    expect(storage.remove).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(
      "[theme-cover-compensation-safety-check-failed]",
      { originalCode: "THEME_DATABASE_FAILED" },
    );
    log.mockRestore();
  });
});
