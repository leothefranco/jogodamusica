import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { SQL } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import * as schema from "@/db/schema";
import { applySourceAvailabilityResult } from "@/domain/music/source-availability";
import type { ThemeStateEvent } from "@/domain/music/theme-state";

const boundaries = vi.hoisted(() => ({
  getDatabase: vi.fn(),
  requireAdmin: vi.fn(),
}));
vi.mock("@/db", () => ({ getDatabase: boundaries.getDatabase }));
vi.mock("@/server/auth/session", () => ({
  requireAdmin: boundaries.requireAdmin,
}));
vi.mock("next/cache", () => ({ revalidatePath() {} }));
vi.mock("next/navigation", () => ({
  redirect(location: string) {
    throw new Error(location);
  },
}));
import { setThemePublicationAction } from "@/app/admin/(protected)/temas/actions";
import AdminThemesPage from "@/app/admin/(protected)/temas/page";
import EditThemePage from "@/app/admin/(protected)/temas/[id]/page";
import * as repository from "@/server/repositories/theme-content-repository";
import {
  createThemeContentService,
  createThemeEditorService,
  getAdminThemes,
} from "@/server/services/theme-content-service";
import { createSourceAvailabilityService } from "@/server/services/source-availability-service";
import {
  findSourceAvailabilityByProviderContentId,
  persistSourceAvailabilityObservation,
} from "@/server/repositories/source-availability-repository";

const themeId = "10000000-0000-4000-8000-000000000012";
const actorId = "30000000-0000-4000-8000-000000000012";
const startedAt = new Date("2026-01-01T00:00:00.000Z");
let now = startedAt;
const client = new PGlite();
const queries: { query: string; params: unknown[] }[] = [];
const database = drizzle(client, {
  schema,
  logger: {
    logQuery(query, params) {
      queries.push({ query, params });
    },
  },
});
let transactionDepth = 0;
// Adapt only the driver's raw-result envelope; every statement still runs in PostgreSQL.
function postgresRows<
  T extends Pick<typeof database, "execute" | "transaction">,
>(db: T): T {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property === "execute")
        return async (query: SQL) => (await target.execute(query)).rows;
      if (property === "transaction")
        return (operation: (transaction: unknown) => Promise<unknown>) =>
          target.transaction(async (transaction) => {
            transactionDepth += 1;
            try {
              return await operation(postgresRows(transaction));
            } finally {
              transactionDepth -= 1;
            }
          });
      return Reflect.get(target, property, receiver);
    },
  });
}
const getThemeEditor = createThemeEditorService({
  ...repository,
  clock: () => now,
});
const events: ThemeStateEvent[] = [];
const service = createThemeContentService({
  ...repository,
  clock: () => now,
  recordThemeStateEvent: (event) => {
    events.push(event);
  },
  observeSourceAvailability: async () => {
    throw new Error("Unexpected provider I/O");
  },
});

function songId(index: number) {
  return `20000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}
function observation() {
  return applySourceAvailabilityResult({
    current: null,
    observedAt: startedAt,
    result: {
      type: "available",
      reason: "available",
      track: {
        providerContentId: "abcdefghijk",
        sourceTitle: "QA",
        sourceChannel: "QA",
        thumbnailUrl: "https://example.com/qa.jpg",
        durationSeconds: 180,
        isEmbeddable: true,
        isRegionAllowed: true,
      },
    },
  });
}

async function addEntries(count: number) {
  for (let index = 1; index <= count; index += 1) {
    await database.insert(schema.songs).values({
      id: songId(index),
      provider: "youtube",
      providerContentId: String(index).padStart(11, "0"),
      sourceTitle: "QA",
      sourceChannel: "QA",
      thumbnailUrl: "https://example.com/qa.jpg",
      durationSeconds: 180,
      isEmbeddable: true,
    });
    await database.insert(schema.themeSongs).values({
      themeId,
      songId: songId(index),
      title: "QA",
      artist: "QA",
      previewDurationSeconds: 30,
      isActive: true,
    });
    await database
      .insert(schema.sourceAvailabilityObservations)
      .values({ songId: songId(index), ...observation() });
  }
}

beforeAll(async () => {
  await client.exec("create role anon; create role authenticated;");
  const journal = JSON.parse(
    readFileSync("drizzle/meta/_journal.json", "utf8"),
  ) as { entries: { idx: number; tag: string }[] };
  for (const entry of journal.entries.filter(
    ({ idx }) => idx <= 6 || idx >= 10,
  )) {
    await client.exec(readFileSync(`drizzle/${entry.tag}.sql`, "utf8"));
  }
  boundaries.getDatabase.mockReturnValue(postgresRows(database));
});
beforeEach(async () => {
  await client.exec(
    "delete from themes; delete from songs; delete from admin_profiles;",
  );
  await database
    .insert(schema.adminProfiles)
    .values({ userId: actorId, displayName: "QA", isActive: true });
  await database.insert(schema.themes).values({
    id: themeId,
    name: "QA",
    slug: "qa-theme",
    editorialState: "draft",
    isActive: false,
  });
  now = startedAt;
  queries.length = 0;
  events.length = 0;
  boundaries.requireAdmin.mockResolvedValue({ userId: actorId });
});
afterEach(() => {
  vi.useRealTimers();
});
afterAll(async () => {
  await client.close();
});

describe("publicação administrativa com repositório PostgreSQL real", () => {
  it("publicação aguardando curadoria lê o resultado confirmado e rollback não deixa dual-write parcial", async () => {
    await addEntries(4);
    let entered!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => {
      entered = resolve;
    });
    const resume = new Promise<void>((resolve) => {
      release = resolve;
    });
    const removal = repository.withThemeContentLock(
      themeId,
      async (transaction) => {
        await transaction.removeThemeSongRecord(songId(4));
        entered();
        await resume;
      },
    );
    await locked;
    const publication = service.setThemePublication(themeId, true, actorId);
    const refused = expect(publication).rejects.toMatchObject({
      code: "THEME_NOT_PLAYABLE",
    });
    release();
    await removal;
    await refused;
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "draft", isActive: false },
      state: { counts: { playableCount: 3 } },
    });
    await expect(
      repository.withThemeContentLock(themeId, async (transaction) => {
        await transaction.setThemeActiveRecord(true);
        throw new Error("abort transaction");
      }),
    ).rejects.toThrow("abort transaction");
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "draft", isActive: false },
    });
    expect(events).toEqual([]);
  });

  it("retirada durante I/O de revalidação não reaparece como incidente de saúde", async () => {
    await addEntries(4);
    await service.setThemePublication(themeId, true, actorId);
    events.length = 0;
    const sourceService = createSourceAvailabilityService({
      clock: () => now,
      findSource: findSourceAvailabilityByProviderContentId,
      persistObservation: persistSourceAvailabilityObservation,
      metrics: { record() {} },
      provider: {
        observe: async () => {
          expect(transactionDepth).toBe(0);
          await service.removeThemeSong(themeId, songId(4));
          return { type: "unavailable", reason: "not_found", track: null };
        },
      },
    });
    await createThemeContentService({
      ...repository,
      clock: () => now,
      observeSourceAvailability: sourceService.observeSource,
      recordThemeStateEvent: (event) => {
        events.push(event);
      },
    }).revalidateSourceAvailability(themeId, songId(4));
    expect(events.map(({ type, cause }) => ({ type, cause }))).toEqual([
      { type: "visibility_changed", cause: "editorial" },
      { type: "suspension_changed", cause: "editorial" },
    ]);
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published" },
      state: { operationalState: "suspended_insufficient_healthy_entries" },
    });
  });

  it("páginas reais da lista/editor exibem dimensões e retorno a rascunho mesmo após suspensão", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(startedAt);
    await addEntries(4);
    await service.setThemePublication(themeId, true, actorId);
    await client.exec(
      `delete from source_availability_observations where song_id = '${songId(4)}'`,
    );
    const listing = renderToStaticMarkup(
      await AdminThemesPage({ searchParams: Promise.resolve({}) }),
    );
    const editor = renderToStaticMarkup(
      await EditThemePage({
        params: Promise.resolve({ id: themeId }),
        searchParams: Promise.resolve({}),
      }),
    );
    for (const html of [listing, editor]) {
      for (const label of [
        "Publicação",
        "Publicado",
        "Visibilidade derivada",
        "Oculto",
        "Suspenso: verificação pendente",
        "3 jogáveis",
        "4 potenciais",
        "Modalidades principais",
      ])
        expect(html).toContain(label);
    }
    expect(editor).toContain("Voltar a rascunho");
  });

  it("lista administrativa usa a mesma classificação do editor a partir das disponibilidades", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(startedAt);
    await addEntries(4);
    await service.setThemePublication(themeId, true, actorId);
    await client.exec(
      `delete from source_availability_observations where song_id = '${songId(4)}'`,
    );
    expect(await getAdminThemes()).toEqual([
      expect.objectContaining({
        editorialState: "published",
        state: expect.objectContaining({
          visibility: "hidden",
          operationalState: "suspended_pending_verification",
          counts: expect.objectContaining({
            playableCount: 3,
            potentialCount: 4,
          }),
        }),
      }),
    ]);
  });

  it("action recusa argumentos inválidos antes de acessar o banco e revalida admin revogado", async () => {
    await expect(
      Reflect.apply(setThemePublicationAction, null, [themeId, "false"]),
    ).rejects.toThrow(
      "/admin/temas?error=Dados%20de%20publica%C3%A7%C3%A3o%20inv%C3%A1lidos",
    );
    await expect(setThemePublicationAction("invalid", true)).rejects.toThrow(
      "/admin/temas?error=Dados%20de%20publica%C3%A7%C3%A3o%20inv%C3%A1lidos",
    );
    expect(queries).toEqual([]);
    await client.exec("update admin_profiles set is_active = false");
    await expect(setThemePublicationAction(themeId, false)).rejects.toThrow(
      encodeURIComponent("Uma sessão administrativa ativa é necessária"),
    );
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "draft" },
    });
    boundaries.requireAdmin.mockRejectedValueOnce(new Error("/admin/login"));
    await expect(setThemePublicationAction(themeId, true)).rejects.toThrow(
      "/admin/login",
    );
  });

  it("action ignora contagem/ator adulterados e publica somente quatro jogáveis do servidor", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(startedAt);
    await addEntries(4);
    await client.exec(
      `delete from source_availability_observations where song_id = '${songId(4)}'`,
    );
    await expect(
      Reflect.apply(setThemePublicationAction, null, [
        themeId,
        true,
        { playableCount: 128, actorId: "forged" },
      ]),
    ).rejects.toThrow(
      encodeURIComponent("Confirme mais 1 Entrada jogável antes de publicar."),
    );
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "draft" },
    });
    await database
      .insert(schema.sourceAvailabilityObservations)
      .values({ songId: songId(4), ...observation() });
    await expect(setThemePublicationAction(themeId, true)).rejects.toThrow(
      "message=Tema%20publicado",
    );
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published" },
    });
  });

  it.each([32, 64])(
    "revalidação de saúde %i→menos uma emite causa health sem escrita editorial ou rede em transação",
    async (size) => {
      await addEntries(size);
      await service.setThemePublication(themeId, true, actorId);
      const sourceService = createSourceAvailabilityService({
        clock: () => now,
        findSource: findSourceAvailabilityByProviderContentId,
        persistObservation: persistSourceAvailabilityObservation,
        metrics: { record() {} },
        provider: {
          observe: async () => {
            expect(transactionDepth).toBe(0);
            return { type: "unavailable", reason: "not_found", track: null };
          },
        },
      });
      const healthService = createThemeContentService({
        ...repository,
        clock: () => now,
        observeSourceAvailability: sourceService.observeSource,
        recordThemeStateEvent: (event) => {
          events.push(event);
        },
      });
      events.length = 0;
      queries.length = 0;
      await healthService.revalidateSourceAvailability(themeId, songId(size));
      expect(await getThemeEditor(themeId)).toMatchObject({
        theme: { editorialState: "published", isActive: true },
        state: {
          operationalState: "degraded",
          counts: { playableCount: size - 1 },
        },
      });
      expect(events.map(({ type, cause }) => ({ type, cause }))).toEqual([
        { type: "degradation_changed", cause: "health" },
        { type: "primary_modes_changed", cause: "health" },
      ]);
      expect(
        queries.some(({ query }) =>
          query.toLowerCase().startsWith('update "themes"'),
        ),
      ).toBe(false);
    },
  );

  it("permite curadoria abaixo de quatro sem forçar draft e emite causa editorial após commit", async () => {
    await addEntries(4);
    await service.setThemePublication(themeId, true, actorId);
    events.length = 0;
    await service.removeThemeSong(themeId, songId(4));
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published", isActive: true },
      state: {
        operationalState: "suspended_insufficient_healthy_entries",
        counts: { playableCount: 3 },
      },
    });
    expect(events.map(({ type, cause }) => ({ type, cause }))).toEqual([
      { type: "visibility_changed", cause: "editorial" },
      { type: "suspension_changed", cause: "editorial" },
    ]);
    await service.updateThemeSong(themeId, songId(3), {
      title: "QA",
      artist: "QA",
      startTimeSeconds: 0,
      previewDurationSeconds: 30,
      displayOrder: null,
      isActive: false,
    });
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published" },
      state: { counts: { playableCount: 2 } },
    });
    await service.setThemePublication(themeId, false, actorId);
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "draft", isActive: false },
      state: { operationalState: "editorial_draft" },
    });
  });

  it.each([32, 64])(
    "retirada editorial de %i mantém published e registra perda de modalidade sem incidente de provedor",
    async (size) => {
      await addEntries(size);
      await service.setThemePublication(themeId, true, actorId);
      events.length = 0;
      await service.removeThemeSong(themeId, songId(size));
      expect(await getThemeEditor(themeId)).toMatchObject({
        theme: { editorialState: "published" },
        state: {
          operationalState: "healthy",
          warnings: { healthLostPrimaryModes: [] },
        },
      });
      expect(
        events.map(({ type, cause, lostPrimaryModes }) => ({
          type,
          cause,
          lostPrimaryModes,
        })),
      ).toEqual([
        {
          type: "primary_modes_changed",
          cause: "editorial",
          lostPrimaryModes: [size],
        },
      ]);
    },
  );

  it("recusa três jogáveis apesar de quatro legadas, publica quatro fresh/grace e revalida o admin sob lock", async () => {
    await addEntries(4);
    await client.exec(
      `delete from source_availability_observations where song_id = '${songId(4)}'`,
    );
    await expect(
      service.setThemePublication(themeId, true, actorId),
    ).rejects.toMatchObject({ code: "THEME_NOT_PLAYABLE" });
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { isActive: false, editorialState: "draft" },
    });
    await database
      .insert(schema.sourceAvailabilityObservations)
      .values({ songId: songId(4), ...observation() });
    now = new Date("2026-01-08T12:00:00.000Z");
    queries.length = 0;
    await service.setThemePublication(themeId, true, actorId);
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { isActive: true, editorialState: "published" },
      state: { operationalState: "degraded", counts: { playableCount: 4 } },
    });
    const sql = queries.map(({ query }) => query.toLowerCase());
    const lock = sql.findIndex(
      (query) =>
        query.includes('from "themes"') && query.includes("for update"),
    );
    const authorization = sql.findIndex(
      (query) =>
        query.includes('from "admin_profiles"') && query.includes("for share"),
    );
    const availability = sql.findIndex((query) =>
      query.includes('join "source_availability_observations"'),
    );
    const write = sql.findIndex((query) => query.startsWith('update "themes"'));
    expect([
      lock === 0,
      authorization > lock,
      availability > authorization,
      write > availability,
    ]).toEqual([true, true, true, true]);
    expect(queries[authorization].params).toContain(actorId);
    await client.exec("update admin_profiles set is_active = false");
    await expect(
      service.setThemePublication(themeId, false, actorId),
    ).rejects.toMatchObject({ code: "THEME_PUBLICATION_FORBIDDEN" });
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published" },
    });
  });

  it("editor deriva suspensão/recuperação de published sem perder intenção ou contar associação inativa", async () => {
    await addEntries(5);
    await client.exec(
      `update themes set is_active = true; update theme_songs set is_active = false where song_id = '${songId(5)}'; delete from source_availability_observations where song_id = '${songId(4)}';`,
    );
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published", isActive: true },
      state: {
        editorialState: "published",
        visibility: "hidden",
        operationalState: "suspended_pending_verification",
        counts: { playableCount: 3, potentialCount: 4, activeEntryCount: 4 },
      },
    });
    await database
      .insert(schema.sourceAvailabilityObservations)
      .values({ songId: songId(4), ...observation() });
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published", isActive: true },
      state: {
        visibility: "visible",
        operationalState: "healthy",
        counts: { playableCount: 4 },
      },
    });
    now = new Date("2026-01-08T12:00:00.000Z");
    expect(await getThemeEditor(themeId)).toMatchObject({
      state: {
        operationalState: "degraded",
        counts: { availableGrace: 4, playableCount: 4 },
      },
    });
    now = new Date("2026-01-09T00:00:00.001Z");
    expect(await getThemeEditor(themeId)).toMatchObject({
      theme: { editorialState: "published", isActive: true },
      state: {
        operationalState: "suspended_pending_verification",
        counts: { unknown: 4, playableCount: 0 },
      },
    });
  });
});
