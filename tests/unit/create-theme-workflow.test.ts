import { describe, expect, it, vi } from "vitest";

import { AppError } from "@/lib/errors";
import { createThemeCreationWorkflow } from "@/server/services/create-theme-workflow";
import { createThemeCoverOperationLock } from "@/server/services/theme-cover-operation-lock";

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
type LegacyCoverLock = <T>(
  coverUrl: string,
  operation: (repository: WorkflowDependencies["repository"]) => Promise<T>,
) => Promise<T>;
type TestWorkflowDependencies = Omit<
  WorkflowDependencies,
  "coverClaims" | "withCoverCleanupSlot" | "withCoverOperationLock"
> &
  Partial<
    Pick<
      WorkflowDependencies,
      "coverClaims" | "withCoverCleanupSlot" | "withCoverOperationLock"
    >
  > & {
    withCoverCleanupLock?: LegacyCoverLock;
    withCoverUrlLock?: LegacyCoverLock;
  };

function createWorkflow(dependencies: TestWorkflowDependencies) {
  const withCoverCleanupLock =
    dependencies.withCoverCleanupLock ??
    (<T>(
      _coverUrl: string,
      operation: (repository: WorkflowDependencies["repository"]) => Promise<T>,
    ) => operation(dependencies.repository));
  const withCoverOperationLock =
    dependencies.withCoverOperationLock ??
    (<T>(_coverUrl: string, operation: () => Promise<T>) => operation());
  const withCoverUrlLock =
    dependencies.withCoverUrlLock ??
    (<T>(
      _coverUrl: string,
      operation: (repository: WorkflowDependencies["repository"]) => Promise<T>,
    ) => operation(dependencies.repository));
  const coverClaims: WorkflowDependencies["coverClaims"] =
    dependencies.coverClaims ?? {
      acquire: async (input) => ({
        status: "claimed",
        claim: { ...input, epoch: 1 },
      }),
      withPersistence: (claim, operation) =>
        withCoverUrlLock(claim.objectKey, operation),
      prepareCleanup: (claim, coverUrl) =>
        withCoverCleanupLock(coverUrl, async (repository) =>
          (await repository.isCoverUrlReferenced(coverUrl))
            ? { status: "preserved-in-use" as const }
            : {
                status: "cleanup-ready" as const,
                claim: { ...claim, epoch: claim.epoch + 1 },
              },
        ),
      finalizeCleanup: async () => {},
    };

  return createThemeCreationWorkflow({
    repository: dependencies.repository,
    storage: dependencies.storage,
    coverClaims,
    withCoverCleanupSlot:
      dependencies.withCoverCleanupSlot ??
      (<T>(operation: () => Promise<T>) => operation()),
    withCoverOperationLock,
  });
}

function createSharedCoverDatabaseLock(
  repository: WorkflowDependencies["repository"],
) {
  let queue = Promise.resolve();

  return async function withSharedCoverDatabaseLock<T>(
    _coverUrl: string,
    operation: (repository: WorkflowDependencies["repository"]) => Promise<T>,
  ): Promise<T> {
    const previous = queue;
    let release = () => {};
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;

    try {
      return await operation(repository);
    } finally {
      release();
    }
  };
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
      coverReference.objectKey,
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
    const inDatabaseTransaction = async <T>(operation: () => Promise<T>) => {
      databaseTransactionOpen = true;
      try {
        return await operation();
      } finally {
        databaseTransactionOpen = false;
      }
    };
    const coverClaims: NonNullable<WorkflowDependencies["coverClaims"]> = {
      acquire: (input) =>
        inDatabaseTransaction(async () => ({
          status: "claimed" as const,
          claim: { ...input, epoch: 1 },
        })),
      withPersistence: (_claim, operation) =>
        inDatabaseTransaction(() => operation(repository)),
      prepareCleanup: (claim) =>
        inDatabaseTransaction(async () => ({
          status: "cleanup-ready" as const,
          claim: { ...claim, epoch: claim.epoch + 1 },
        })),
      finalizeCleanup: () => inDatabaseTransaction(async () => {}),
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      coverClaims,
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
    const lockedCoverUrls: string[] = [];
    const sharedDatabaseLock = createSharedCoverDatabaseLock(repository);
    const withSharedDatabaseLock: LegacyCoverLock = (coverUrl, operation) => {
      lockedCoverUrls.push(coverUrl);
      return sharedDatabaseLock(coverUrl, operation);
    };
    const createFirstTheme = createWorkflow({
      repository,
      storage,
      withCoverCleanupLock: withSharedDatabaseLock,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
      withCoverUrlLock: withSharedDatabaseLock,
    });
    const createSecondTheme = createWorkflow({
      repository,
      storage,
      withCoverCleanupLock: withSharedDatabaseLock,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
      withCoverUrlLock: withSharedDatabaseLock,
    });
    const first = validFormData();
    first.set("coverReference", JSON.stringify(coverReference));
    const second = validFormData();
    second.set("coverReference", JSON.stringify(coverReference));

    const results = await Promise.all([
      createFirstTheme(admin, first),
      createSecondTheme(admin, second),
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
    expect(lockedCoverUrls).toEqual([
      coverReference.objectKey,
      coverReference.objectKey,
    ]);
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("mantém conflito divergente entre instâncias sem apagar a capa vencedora", async () => {
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
    const withSharedCoverDatabaseLock =
      createSharedCoverDatabaseLock(repository);
    const createWinningTheme = createWorkflow({
      repository,
      storage,
      withCoverCleanupLock: withSharedCoverDatabaseLock,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
      withCoverUrlLock: withSharedCoverDatabaseLock,
    });
    const createDivergentTheme = createWorkflow({
      repository,
      storage,
      withCoverCleanupLock: withSharedCoverDatabaseLock,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
      withCoverUrlLock: withSharedCoverDatabaseLock,
    });
    const winner = validFormData();
    winner.set("coverReference", JSON.stringify(coverReference));
    const divergent = validFormData();
    divergent.set("name", "Outro nome");
    divergent.set("coverReference", JSON.stringify(coverReference));

    const [winnerResult, divergentResult] = await Promise.allSettled([
      createWinningTheme(admin, winner),
      createDivergentTheme(admin, divergent),
    ]);

    expect(winnerResult).toMatchObject({
      status: "fulfilled",
      value: {
        idempotent: false,
        themeId: "20000000-0000-4000-8000-000000000002",
      },
    });
    expect(divergentResult).toMatchObject({
      status: "rejected",
      reason: {
        cleanupStatus: "preserved-in-use",
        code: "THEME_SLUG_CONFLICT",
      },
    });
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

  it("rejeita payload divergente sem iniciar cleanup da claim ativa", async () => {
    type StoredTheme = {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      coverUrl: string | null;
      isActive: boolean;
    };
    let storedTheme: StoredTheme | null = null;
    let releaseWinner = () => {};
    const winnerMayPersist = new Promise<void>((resolve) => {
      releaseWinner = resolve;
    });
    let markWinnerReady = () => {};
    const winnerReady = new Promise<void>((resolve) => {
      markWinnerReady = resolve;
    });
    const storage = {
      inspect: vi.fn().mockResolvedValue(validJpegMetadata),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn().mockResolvedValue("removed" as const),
    };
    const repository = {
      findBySlug: vi.fn(async () => storedTheme),
      insert: vi.fn(async (values: Omit<StoredTheme, "id">) => {
        storedTheme = {
          id: "20000000-0000-4000-8000-000000000002",
          ...values,
        };
        return storedTheme.id;
      }),
      isCoverUrlReferenced: vi.fn(async () => Boolean(storedTheme)),
    };
    let activeClaim: null | {
      bucket: "theme-covers";
      objectKey: string;
      actorId: string;
      ownerId: string;
      payloadHash: string;
      epoch: number;
    } = null;
    const prepareCleanup = vi.fn();
    const finalizeCleanup = vi.fn();
    const coverClaims: NonNullable<WorkflowDependencies["coverClaims"]> = {
      acquire: async (input) => {
        if (!activeClaim) activeClaim = { ...input, epoch: 1 };
        return activeClaim.payloadHash === input.payloadHash
          ? { status: "claimed", claim: activeClaim }
          : { status: "conflict" };
      },
      withPersistence: async (_claim, operation) => {
        markWinnerReady();
        await winnerMayPersist;
        return operation(repository);
      },
      prepareCleanup,
      finalizeCleanup,
    };
    const createDivergentTheme = createWorkflow({
      repository,
      storage,
      coverClaims,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
    });
    const createWinningTheme = createWorkflow({
      repository,
      storage,
      coverClaims,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
    });
    const winner = validFormData();
    winner.set("coverReference", JSON.stringify(coverReference));
    const divergent = validFormData();
    divergent.set("name", "Outro tema");
    divergent.set("coverReference", JSON.stringify(coverReference));

    const winningResult = createWinningTheme(admin, winner);
    await winnerReady;
    await expect(createDivergentTheme(admin, divergent)).rejects.toMatchObject({
      code: "THEME_COVER_CLAIM_CONFLICT",
    });
    releaseWinner();
    await expect(winningResult).resolves.toEqual({
      idempotent: false,
      themeId: "20000000-0000-4000-8000-000000000002",
    });

    expect(storage.inspect).toHaveBeenCalledOnce();
    expect(storage.remove).not.toHaveBeenCalled();
    expect(prepareCleanup).not.toHaveBeenCalled();
    expect(finalizeCleanup).not.toHaveBeenCalled();
  });

  it("não persiste a capa que foi removida depois do inspect do criador", async () => {
    type StoredTheme = {
      id: string;
      name: string;
      slug: string;
      description: string | null;
      coverUrl: string | null;
      isActive: boolean;
    };
    let storedTheme: StoredTheme | null = null;
    let objectExists = true;
    const durableClaim: {
      claim: null | {
        bucket: "theme-covers";
        objectKey: string;
        actorId: string;
        ownerId: string;
        payloadHash: string;
        epoch: number;
      };
      status:
        | "absent"
        | "claimed"
        | "consumed"
        | "deleting"
        | "delete_failed"
        | "deleted";
      themeId: string | null;
    } = {
      claim: null,
      status: "absent",
      themeId: null,
    };
    let releaseWinnerAfterCleanup = () => {};
    const winnerMayAcquireDatabaseLock = new Promise<void>((resolve) => {
      releaseWinnerAfterCleanup = resolve;
    });
    let markWinnerInspected = () => {};
    const winnerInspected = new Promise<void>((resolve) => {
      markWinnerInspected = resolve;
    });
    const storage = {
      inspect: vi.fn(async () => {
        if (!objectExists) {
          throw new AppError(
            "THEME_COVER_NOT_FOUND",
            "A capa enviada não foi encontrada.",
            400,
          );
        }

        return validJpegMetadata;
      }),
      getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
      remove: vi.fn(async () => {
        expect(storedTheme).toBeNull();
        objectExists = false;
        return "removed" as const;
      }),
    };
    const repository = {
      findBySlug: vi.fn(async () => storedTheme),
      insert: vi.fn(async (values: Omit<StoredTheme, "id">) => {
        storedTheme = {
          id: "20000000-0000-4000-8000-000000000002",
          ...values,
        };
        return storedTheme.id;
      }),
      isCoverUrlReferenced: vi.fn(async () => Boolean(storedTheme)),
    };
    let databaseQueue = Promise.resolve();
    const withSharedDatabaseState = async <T>(operation: () => Promise<T>) => {
      const previous = databaseQueue;
      let release = () => {};
      databaseQueue = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation();
      } finally {
        release();
      }
    };
    const createDurableClaims = ({
      delayPersistence = false,
      rejectPersistence = false,
    } = {}): NonNullable<WorkflowDependencies["coverClaims"]> => ({
      acquire: (input) =>
        withSharedDatabaseState(async () => {
          if (!durableClaim.claim) {
            durableClaim.claim = { ...input, epoch: 1 };
            durableClaim.status = "claimed";
          }
          if (durableClaim.claim.payloadHash !== input.payloadHash) {
            return { status: "conflict" as const };
          }
          if (durableClaim.status === "deleted") {
            return { status: "deleted" as const };
          }
          if (durableClaim.status === "consumed") {
            return {
              status: "consumed" as const,
              claim: { ...durableClaim.claim },
            };
          }
          return {
            status: "claimed" as const,
            claim: { ...durableClaim.claim },
          };
        }),
      withPersistence: async (claim, operation) => {
        if (delayPersistence) {
          markWinnerInspected();
          await winnerMayAcquireDatabaseLock;
        }
        if (rejectPersistence) {
          throw new AppError(
            "THEME_RULE_REJECTED",
            "O tema não atende à regra.",
            409,
          );
        }

        return withSharedDatabaseState(async () => {
          if (
            durableClaim.status !== "claimed" ||
            durableClaim.claim?.epoch !== claim.epoch
          ) {
            throw new AppError(
              "THEME_COVER_CLAIM_REVOKED",
              "A reserva desta capa foi encerrada.",
              409,
            );
          }
          const result = await operation(repository);
          durableClaim.status = "consumed";
          durableClaim.themeId = result.themeId;
          return result;
        });
      },
      prepareCleanup: (claim) =>
        withSharedDatabaseState(async () => {
          if (durableClaim.status === "consumed") {
            return { status: "preserved-in-use" as const };
          }
          if (durableClaim.status === "deleted") {
            return { status: "already-absent" as const };
          }
          if (
            durableClaim.status !== "claimed" ||
            durableClaim.claim?.epoch !== claim.epoch
          ) {
            throw new AppError(
              "THEME_COVER_CLEANUP_BUSY",
              "Outra compensação está em andamento.",
              409,
            );
          }

          durableClaim.status = "deleting";
          durableClaim.claim.epoch += 1;
          return {
            status: "cleanup-ready" as const,
            claim: { ...durableClaim.claim },
          };
        }),
      finalizeCleanup: (claim, outcome) =>
        withSharedDatabaseState(async () => {
          expect(durableClaim.status).toBe("deleting");
          expect(durableClaim.claim?.epoch).toBe(claim.epoch);
          durableClaim.status =
            outcome === "deleted" ? "deleted" : "delete_failed";
        }),
    });
    const winnerClaims = createDurableClaims({ delayPersistence: true });
    const failedClaims = createDurableClaims({ rejectPersistence: true });
    const createFailedTheme = createWorkflow({
      repository,
      storage,
      coverClaims: failedClaims,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
    });
    const createWinningTheme = createWorkflow({
      repository,
      storage,
      coverClaims: winnerClaims,
      withCoverOperationLock: createThemeCoverOperationLock({
        waitTimeoutMs: 1_000,
      }),
    });
    const winner = validFormData();
    winner.set("coverReference", JSON.stringify(coverReference));
    const failedContender = validFormData();
    failedContender.set("coverReference", JSON.stringify(coverReference));

    const winningResult = createWinningTheme(admin, winner);
    await winnerInspected;
    const failedResult = createFailedTheme(admin, failedContender);

    await expect(failedResult).rejects.toMatchObject({
      cleanupStatus: "removed",
      code: "THEME_RULE_REJECTED",
    });
    releaseWinnerAfterCleanup();
    await Promise.allSettled([winningResult]);

    const finalCoverUrl = (storedTheme as StoredTheme | null)?.coverUrl;
    expect(finalCoverUrl ? objectExists : true).toBe(true);
    expect(durableClaim.status).toBe(finalCoverUrl ? "consumed" : "deleted");
    expect(storage.remove).toHaveBeenCalledOnce();
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
    let persistenceCalls = 0;
    let claimStatus: "claimed" | "consumed" = "claimed";
    const coverClaims: NonNullable<WorkflowDependencies["coverClaims"]> = {
      acquire: async (input) => ({
        status: claimStatus,
        claim: { ...input, epoch: 1 },
      }),
      withPersistence: async (_claim, operation) => {
        persistenceCalls += 1;
        const result = await operation(repository);
        if (persistenceCalls === 1) {
          claimStatus = "consumed";
          throw commitError;
        }
        return result;
      },
      prepareCleanup: vi.fn(),
      finalizeCleanup: vi.fn(),
    };
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      coverClaims,
    });

    await expect(createTheme(admin, formData)).resolves.toEqual({
      idempotent: true,
      themeId: "20000000-0000-4000-8000-000000000002",
    });
    expect(persistenceCalls).toBe(2);
    expect(claimStatus).toBe("consumed");
    expect(repository.insert).toHaveBeenCalledTimes(2);
    expect(repository.isCoverUrlReferenced).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("preserva o erro original quando o DELETE do cleanup expira", async () => {
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
        .mockRejectedValueOnce(
          new AppError(
            "THEME_COVER_CLEANUP_FAILED",
            "O DELETE foi abortado por timeout.",
            502,
          ),
        )
        .mockResolvedValueOnce("already-absent" as const),
    };
    const repository = {
      findBySlug: vi.fn().mockResolvedValue(null),
      insert: vi.fn().mockRejectedValue(originalError),
      isCoverUrlReferenced: vi.fn().mockResolvedValue(false),
    };
    let claimStatus: "claimed" | "deleting" | "delete_failed" | "deleted" =
      "claimed";
    let claimEpoch = 1;
    const coverClaims: NonNullable<WorkflowDependencies["coverClaims"]> = {
      acquire: async (input) => {
        if (claimStatus === "delete_failed") {
          claimStatus = "deleting";
          claimEpoch += 1;
          return {
            status: "cleanup-required" as const,
            claim: { ...input, epoch: claimEpoch },
          };
        }
        if (claimStatus === "deleted") return { status: "deleted" as const };
        return {
          status: "claimed" as const,
          claim: { ...input, epoch: claimEpoch },
        };
      },
      withPersistence: (_claim, operation) => operation(repository),
      prepareCleanup: async (claim) => {
        expect(claimStatus).toBe("claimed");
        expect(claim.epoch).toBe(claimEpoch);
        claimStatus = "deleting";
        claimEpoch += 1;
        return {
          status: "cleanup-ready" as const,
          claim: { ...claim, epoch: claimEpoch },
        };
      },
      finalizeCleanup: async (claim, outcome) => {
        expect(claimStatus).toBe("deleting");
        expect(claim.epoch).toBe(claimEpoch);
        claimStatus = outcome === "deleted" ? "deleted" : "delete_failed";
      },
    };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const formData = validFormData();
    formData.set("coverReference", JSON.stringify(coverReference));
    const createTheme = createWorkflow({
      repository,
      storage,
      coverClaims,
    });

    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "cleanup-failed",
      code: "THEME_RULE_REJECTED",
      message: "O tema não atende à regra.",
    });
    expect(log).toHaveBeenCalledWith("[theme-cover-compensation-failed]", {
      cleanupCode: "THEME_COVER_CLEANUP_FAILED",
      originalCode: "THEME_RULE_REJECTED",
    });
    expect(claimStatus).toBe("delete_failed");
    await expect(createTheme(admin, formData)).rejects.toMatchObject({
      cleanupStatus: "already-absent",
      code: "THEME_COVER_CLAIM_UNAVAILABLE",
    });
    expect(claimStatus).toBe("deleted");
    expect(storage.inspect).toHaveBeenCalledOnce();
    expect(storage.remove).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });

  it.each([
    ["depois do tombstone e antes do DELETE", true, "removed"],
    ["depois do DELETE e antes da finalização", false, "already-absent"],
  ] as const)(
    "recupera crash %s por uma chamada posterior do workflow",
    async (_crashPoint, initialObjectExists, cleanupStatus) => {
      let objectExists = initialObjectExists;
      let claimStatus: "deleting" | "deleted" = "deleting";
      let databaseTransactionOpen = false;
      const storage = {
        inspect: vi.fn(),
        getPublicUrl: vi.fn().mockReturnValue(canonicalCoverUrl),
        remove: vi.fn(async () => {
          expect(databaseTransactionOpen).toBe(false);
          if (!objectExists) return "already-absent" as const;
          objectExists = false;
          return "removed" as const;
        }),
      };
      const repository = {
        findBySlug: vi.fn(),
        insert: vi.fn(),
        isCoverUrlReferenced: vi.fn(),
      };
      const coverClaims: NonNullable<WorkflowDependencies["coverClaims"]> = {
        acquire: async (input) => {
          databaseTransactionOpen = true;
          try {
            return {
              status: "cleanup-required" as const,
              claim: { ...input, epoch: 8 },
            };
          } finally {
            databaseTransactionOpen = false;
          }
        },
        withPersistence: vi.fn(),
        prepareCleanup: vi.fn(),
        finalizeCleanup: async (claim, outcome) => {
          databaseTransactionOpen = true;
          try {
            expect(claim.epoch).toBe(8);
            expect(outcome).toBe("deleted");
            claimStatus = "deleted";
          } finally {
            databaseTransactionOpen = false;
          }
        },
      };
      const formData = validFormData();
      formData.set("coverReference", JSON.stringify(coverReference));
      const createTheme = createWorkflow({
        repository,
        storage,
        coverClaims,
      });

      await expect(createTheme(admin, formData)).rejects.toMatchObject({
        cleanupStatus,
        code: "THEME_COVER_CLAIM_UNAVAILABLE",
      });
      expect(claimStatus).toBe("deleted");
      expect(objectExists).toBe(false);
      expect(storage.inspect).not.toHaveBeenCalled();
      expect(coverClaims.withPersistence).not.toHaveBeenCalled();
      expect(coverClaims.prepareCleanup).not.toHaveBeenCalled();
    },
  );

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
