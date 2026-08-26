import "server-only";

import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import {
  gameSessions,
  songs,
  themes,
  themeSongs,
  type NewTheme,
  type ThemeCoverClaimStatus,
} from "@/db/schema";
import type { ResolvedPlaylistTrack } from "@/domain/music/provider";
import { AppError } from "@/lib/errors";

type ThemeContentDatabase = Pick<
  ReturnType<typeof getDatabase>,
  "delete" | "insert" | "select" | "update"
>;

type ThemeCreationDatabase = Pick<
  ReturnType<typeof getDatabase>,
  "execute" | "insert" | "select"
>;

type ThemeCoverClaimKey = {
  bucket: "theme-covers";
  objectKey: string;
  actorId: string;
  ownerId: string;
  payloadHash: string;
};

export type ThemeCoverClaim = ThemeCoverClaimKey & {
  epoch: number;
};

export type ThemeCoverCleanupClaim = ThemeCoverClaim;

export type ThemeCoverClaimAcquisition =
  | { status: "claimed"; claim: ThemeCoverClaim }
  | { status: "consumed"; claim: ThemeCoverClaim }
  | { status: "cleanup-required"; claim: ThemeCoverCleanupClaim }
  | { status: "conflict" }
  | { status: "deleted" };

type ThemeCoverClaimRow = Omit<ThemeCoverClaimKey, "actorId"> & {
  epoch: number;
  leaseExpiresAt: Date | string | null;
  status: ThemeCoverClaimStatus;
  themeId: string | null;
};

const CREATION_CLAIM_LEASE_MS = 30_000;
const CLEANUP_CLAIM_LEASE_MS = 15_000;
const MANAGED_THEME_COVER_KEY_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

export type LockedThemeCreationRepository = {
  findBySlug(slug: string): Promise<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    coverUrl: string | null;
    isActive: boolean;
  } | null>;
  insert(values: NewTheme): Promise<string | null>;
  isCoverUrlReferenced(coverUrl: string): Promise<boolean>;
};

export type ThemeSummary = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  coverUrl: string | null;
  isActive: boolean;
  activeSongCount: number;
  totalSongCount: number;
  updatedAt: Date;
};

function themeCoverClaimLockKey(input: ThemeCoverClaimKey) {
  return JSON.stringify([
    "theme-cover-claim-v1",
    input.bucket,
    input.objectKey,
    input.ownerId,
  ]);
}

function assertTrustedThemeCoverClaimInput(input: ThemeCoverClaimKey) {
  if (input.actorId !== input.ownerId) {
    throw claimForbiddenError();
  }

  if (
    input.bucket !== "theme-covers" ||
    !MANAGED_THEME_COVER_KEY_PATTERN.test(input.objectKey) ||
    input.objectKey.split("/", 1)[0] !== input.ownerId ||
    !/^[0-9a-f]{64}$/.test(input.payloadHash)
  ) {
    throw new AppError(
      "INVALID_THEME_COVER_REFERENCE",
      "A referência gerenciada da capa é inválida.",
      400,
    );
  }
}

function claimForbiddenError() {
  return new AppError(
    "THEME_COVER_CLAIM_FORBIDDEN",
    "Você não pode gerenciar esta referência de capa.",
    403,
  );
}

function claimBusyError() {
  return new AppError(
    "THEME_COVER_CLAIM_BUSY",
    "Outra operação desta capa está em andamento. Tente novamente.",
    409,
  );
}

function databaseErrorCode(error: unknown) {
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

async function assertActiveThemeCoverOwner(
  database: ThemeCreationDatabase,
  input: ThemeCoverClaimKey,
) {
  let authorizationRows: unknown[];
  try {
    authorizationRows = await database.execute(sql<{ allowed: boolean }>`
      select true as allowed
      from public.admin_profiles
      where user_id = ${input.actorId}::uuid
        and user_id = ${input.ownerId}::uuid
        and is_active = true
      for share nowait
    `);
  } catch (error) {
    if (databaseErrorCode(error) === "55P03") throw claimBusyError();
    throw error;
  }
  const [authorizationRow] = authorizationRows;
  const authorization = authorizationRow as { allowed: boolean } | undefined;
  if (!authorization?.allowed) {
    throw claimForbiddenError();
  }
}

async function lockThemeCoverClaim(
  database: ThemeCreationDatabase,
  input: ThemeCoverClaimKey,
) {
  const [lock] = await database.execute(sql<{ acquired: boolean }>`
    select pg_try_advisory_xact_lock(
      hashtextextended(${themeCoverClaimLockKey(input)}, 1::bigint)
    ) as acquired
  `);
  if (!(lock as { acquired?: boolean } | undefined)?.acquired) {
    throw claimBusyError();
  }
}

async function findThemeCoverClaimUsing(
  database: ThemeCreationDatabase,
  input: ThemeCoverClaimKey,
): Promise<ThemeCoverClaimRow | null> {
  const [claimRow] = await database.execute(sql<ThemeCoverClaimRow>`
    select
      bucket,
      object_key as "objectKey",
      owner_id as "ownerId",
      payload_hash as "payloadHash",
      epoch,
      status,
      lease_expires_at as "leaseExpiresAt",
      theme_id as "themeId"
    from public.theme_cover_claims
    where bucket = ${input.bucket}
      and object_key = ${input.objectKey}
      and owner_id = ${input.ownerId}::uuid
    for update
  `);

  return (claimRow as ThemeCoverClaimRow | undefined) ?? null;
}

function asThemeCoverClaim(
  row: ThemeCoverClaimRow,
  actorId: string,
): ThemeCoverClaim {
  return {
    bucket: row.bucket,
    objectKey: row.objectKey,
    actorId,
    ownerId: row.ownerId,
    payloadHash: row.payloadHash,
    epoch: Number(row.epoch),
  };
}

function claimRevokedError() {
  return new AppError(
    "THEME_COVER_CLAIM_REVOKED",
    "A reserva desta capa expirou ou foi encerrada.",
    409,
    { coverFile: ["Envie a capa novamente e tente de novo."] },
  );
}

function cleanupBusyError() {
  return new AppError(
    "THEME_COVER_CLEANUP_BUSY",
    "Outra compensação de capa está em andamento. Tente novamente.",
    409,
  );
}

export type ThemeSongEditorItem = {
  songId: string;
  providerContentId: string;
  title: string;
  artist: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isEmbeddable: boolean;
  startTimeSeconds: number;
  previewDurationSeconds: number;
  isActive: boolean;
  displayOrder: number | null;
};

export type SongAssociationUpsertInput = {
  themeId: string;
  providerContentId: string;
  title: string;
  artist: string;
  sourceTitle: string;
  sourceChannel: string;
  thumbnailUrl: string;
  durationSeconds: number;
  isEmbeddable: boolean;
  startTimeSeconds: number;
  previewDurationSeconds: number;
  isActive: boolean;
};

export type ThemeSongUpdateInput = {
  themeId: string;
  songId: string;
  title: string;
  artist: string;
  startTimeSeconds: number;
  previewDurationSeconds: number;
  displayOrder: number | null;
  isActive: boolean;
};

const themeSummarySelection = {
  id: themes.id,
  name: themes.name,
  slug: themes.slug,
  description: themes.description,
  coverUrl: themes.coverUrl,
  isActive: themes.isActive,
  activeSongCount:
    sql<number>`count(${themeSongs.songId}) filter (where ${themeSongs.isActive} = true and ${songs.isEmbeddable} = true)`.mapWith(
      Number,
    ),
  totalSongCount: count(themeSongs.songId).mapWith(Number),
  updatedAt: themes.updatedAt,
};

const themeSongEditorSelection = {
  songId: songs.id,
  providerContentId: songs.providerContentId,
  title: themeSongs.title,
  artist: themeSongs.artist,
  sourceTitle: songs.sourceTitle,
  sourceChannel: songs.sourceChannel,
  thumbnailUrl: songs.thumbnailUrl,
  durationSeconds: songs.durationSeconds,
  isEmbeddable: songs.isEmbeddable,
  startTimeSeconds: themeSongs.startTimeSeconds,
  previewDurationSeconds: themeSongs.previewDurationSeconds,
  isActive: themeSongs.isActive,
  displayOrder: themeSongs.displayOrder,
};

async function findThemeSummaryUsing(
  database: ThemeContentDatabase,
  themeId: string,
): Promise<ThemeSummary | null> {
  const [theme] = await database
    .select(themeSummarySelection)
    .from(themes)
    .leftJoin(themeSongs, eq(themeSongs.themeId, themes.id))
    .leftJoin(songs, eq(songs.id, themeSongs.songId))
    .where(eq(themes.id, themeId))
    .groupBy(themes.id)
    .limit(1);

  return theme ?? null;
}

async function findThemeSongUsing(
  database: ThemeContentDatabase,
  themeId: string,
  songId: string,
): Promise<ThemeSongEditorItem | null> {
  const [item] = await database
    .select(themeSongEditorSelection)
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(and(eq(themeSongs.themeId, themeId), eq(themeSongs.songId, songId)))
    .limit(1);

  return item ?? null;
}

async function findThemeSongByProviderContentIdUsing(
  database: ThemeContentDatabase,
  themeId: string,
  providerContentId: string,
): Promise<ThemeSongEditorItem | null> {
  const [item] = await database
    .select(themeSongEditorSelection)
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(
      and(
        eq(themeSongs.themeId, themeId),
        eq(songs.provider, "youtube"),
        eq(songs.providerContentId, providerContentId),
      ),
    )
    .limit(1);

  return item ?? null;
}

async function updateThemeRecordUsing(
  database: ThemeContentDatabase,
  themeId: string,
  values: Partial<NewTheme>,
) {
  const [theme] = await database
    .update(themes)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id });

  return theme?.id ?? null;
}

async function upsertSongAndAssociationUsing(
  database: ThemeContentDatabase,
  input: SongAssociationUpsertInput,
) {
  const [song] = await database
    .insert(songs)
    .values({
      provider: "youtube",
      providerContentId: input.providerContentId,
      sourceTitle: input.sourceTitle,
      sourceChannel: input.sourceChannel,
      thumbnailUrl: input.thumbnailUrl,
      durationSeconds: input.durationSeconds,
      isEmbeddable: input.isEmbeddable,
    })
    .onConflictDoUpdate({
      target: [songs.provider, songs.providerContentId],
      set: {
        sourceTitle: input.sourceTitle,
        sourceChannel: input.sourceChannel,
        thumbnailUrl: input.thumbnailUrl,
        durationSeconds: input.durationSeconds,
        isEmbeddable: input.isEmbeddable,
        updatedAt: new Date(),
      },
    })
    .returning({ id: songs.id });

  await database
    .insert(themeSongs)
    .values({
      themeId: input.themeId,
      songId: song.id,
      title: input.title,
      artist: input.artist,
      startTimeSeconds: input.startTimeSeconds,
      previewDurationSeconds: input.previewDurationSeconds,
      isActive: input.isActive,
    })
    .onConflictDoUpdate({
      target: [themeSongs.themeId, themeSongs.songId],
      set: {
        title: input.title,
        artist: input.artist,
        startTimeSeconds: input.startTimeSeconds,
        previewDurationSeconds: input.previewDurationSeconds,
        isActive: input.isActive,
        updatedAt: new Date(),
      },
    });
}

async function updateThemeSongAssociationUsing(
  database: ThemeContentDatabase,
  input: ThemeSongUpdateInput,
) {
  await database
    .update(themeSongs)
    .set({
      title: input.title,
      artist: input.artist,
      startTimeSeconds: input.startTimeSeconds,
      previewDurationSeconds: input.previewDurationSeconds,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(themeSongs.themeId, input.themeId),
        eq(themeSongs.songId, input.songId),
      ),
    );
}

async function removeThemeSongRecordUsing(
  database: ThemeContentDatabase,
  themeId: string,
  songId: string,
) {
  const [deleted] = await database
    .delete(themeSongs)
    .where(and(eq(themeSongs.themeId, themeId), eq(themeSongs.songId, songId)))
    .returning({ songId: themeSongs.songId });

  return deleted?.songId ?? null;
}

export async function listThemeSummaries(): Promise<ThemeSummary[]> {
  const rows = await getDatabase()
    .select(themeSummarySelection)
    .from(themes)
    .leftJoin(themeSongs, eq(themeSongs.themeId, themes.id))
    .leftJoin(songs, eq(songs.id, themeSongs.songId))
    .groupBy(themes.id)
    .orderBy(desc(themes.updatedAt));

  return rows;
}

export async function findThemeSummary(
  themeId: string,
): Promise<ThemeSummary | null> {
  return findThemeSummaryUsing(getDatabase(), themeId);
}

export async function listThemeSongs(
  themeId: string,
): Promise<ThemeSongEditorItem[]> {
  return getDatabase()
    .select(themeSongEditorSelection)
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(eq(themeSongs.themeId, themeId))
    .orderBy(
      sql`${themeSongs.displayOrder} asc nulls last`,
      asc(themeSongs.title),
    );
}

async function insertThemeUsing(
  database: ThemeCreationDatabase,
  values: NewTheme,
): Promise<string> {
  const [theme] = await database
    .insert(themes)
    .values(values)
    .returning({ id: themes.id });

  return theme.id;
}

async function insertThemeIfSlugAvailableUsing(
  database: ThemeCreationDatabase,
  values: NewTheme,
): Promise<string | null> {
  const [theme] = await database
    .insert(themes)
    .values(values)
    .onConflictDoNothing({ target: themes.slug })
    .returning({ id: themes.id });

  return theme?.id ?? null;
}

async function findThemeBySlugUsing(
  database: ThemeCreationDatabase,
  slug: string,
) {
  const [theme] = await database
    .select({
      id: themes.id,
      name: themes.name,
      slug: themes.slug,
      description: themes.description,
      coverUrl: themes.coverUrl,
      isActive: themes.isActive,
    })
    .from(themes)
    .where(eq(themes.slug, slug))
    .limit(1);

  return theme ?? null;
}

async function isThemeCoverUrlReferencedUsing(
  database: ThemeCreationDatabase,
  coverUrl: string,
) {
  const [theme] = await database
    .select({ id: themes.id })
    .from(themes)
    .where(eq(themes.coverUrl, coverUrl))
    .limit(1);

  return Boolean(theme);
}

export async function insertTheme(values: NewTheme): Promise<string> {
  return insertThemeUsing(getDatabase(), values);
}

export async function findThemeBySlug(slug: string) {
  return findThemeBySlugUsing(getDatabase(), slug);
}

export async function isThemeCoverUrlReferenced(coverUrl: string) {
  return isThemeCoverUrlReferencedUsing(getDatabase(), coverUrl);
}

export async function acquireThemeCoverClaim(
  input: ThemeCoverClaimKey,
): Promise<ThemeCoverClaimAcquisition> {
  assertTrustedThemeCoverClaimInput(input);
  return getDatabase().transaction(async (transaction) => {
    await lockThemeCoverClaim(transaction, input);
    await assertActiveThemeCoverOwner(transaction, input);
    let claim = await findThemeCoverClaimUsing(transaction, input);

    if (!claim) {
      const [insertedRow] = await transaction.execute(sql<ThemeCoverClaimRow>`
        insert into public.theme_cover_claims (
          bucket,
          object_key,
          owner_id,
          payload_hash,
          epoch,
          status,
          lease_expires_at
        ) values (
          ${input.bucket},
          ${input.objectKey},
          ${input.ownerId}::uuid,
          ${input.payloadHash},
          1,
          'claimed',
          now() + ${CREATION_CLAIM_LEASE_MS} * interval '1 millisecond'
        )
        on conflict (bucket, object_key, owner_id) do nothing
        returning
          bucket,
          object_key as "objectKey",
          owner_id as "ownerId",
          payload_hash as "payloadHash",
          epoch,
          status,
          lease_expires_at as "leaseExpiresAt",
          theme_id as "themeId"
      `);
      const inserted = insertedRow as ThemeCoverClaimRow | undefined;
      if (inserted) {
        return {
          status: "claimed",
          claim: asThemeCoverClaim(inserted, input.actorId),
        };
      }
      claim = await findThemeCoverClaimUsing(transaction, input);
    }

    if (!claim) throw claimRevokedError();
    if (claim.payloadHash !== input.payloadHash) return { status: "conflict" };

    if (claim.status === "consumed") {
      return {
        status: "consumed",
        claim: asThemeCoverClaim(claim, input.actorId),
      };
    }
    if (claim.status === "deleted") return { status: "deleted" };

    if (claim.status === "claimed") {
      const [renewedRow] = await transaction.execute(sql<ThemeCoverClaimRow>`
        update public.theme_cover_claims
        set epoch = epoch + 1,
            lease_expires_at = now() + ${CREATION_CLAIM_LEASE_MS} * interval '1 millisecond',
            updated_at = now()
        where bucket = ${input.bucket}
          and object_key = ${input.objectKey}
          and owner_id = ${input.ownerId}::uuid
          and payload_hash = ${input.payloadHash}
          and status = 'claimed'
          and epoch = ${claim.epoch}
          and lease_expires_at <= now()
        returning
          bucket,
          object_key as "objectKey",
          owner_id as "ownerId",
          payload_hash as "payloadHash",
          epoch,
          status,
          lease_expires_at as "leaseExpiresAt",
          theme_id as "themeId"
      `);

      const renewed = renewedRow as ThemeCoverClaimRow | undefined;
      return {
        status: "claimed",
        claim: asThemeCoverClaim(renewed ?? claim, input.actorId),
      };
    }

    const [resumedRow] = await transaction.execute(sql<ThemeCoverClaimRow>`
      update public.theme_cover_claims
      set epoch = epoch + 1,
          status = 'deleting',
          lease_expires_at = now() + ${CLEANUP_CLAIM_LEASE_MS} * interval '1 millisecond',
          updated_at = now()
      where bucket = ${input.bucket}
        and object_key = ${input.objectKey}
        and owner_id = ${input.ownerId}::uuid
        and payload_hash = ${input.payloadHash}
        and epoch = ${claim.epoch}
        and status = ${claim.status}
        and (
          status = 'delete_failed'
          or lease_expires_at <= now()
        )
      returning
        bucket,
        object_key as "objectKey",
        owner_id as "ownerId",
        payload_hash as "payloadHash",
        epoch,
        status,
        lease_expires_at as "leaseExpiresAt",
        theme_id as "themeId"
    `);
    const resumed = resumedRow as ThemeCoverClaimRow | undefined;
    if (!resumed) throw cleanupBusyError();

    return {
      status: "cleanup-required",
      claim: asThemeCoverClaim(resumed, input.actorId),
    };
  });
}

export async function withThemeCoverClaimPersistence<
  T extends { themeId: string },
>(
  claim: ThemeCoverClaim,
  operation: (repository: LockedThemeCreationRepository) => Promise<T>,
): Promise<T> {
  assertTrustedThemeCoverClaimInput(claim);
  return getDatabase().transaction(async (transaction) => {
    await lockThemeCoverClaim(transaction, claim);
    await assertActiveThemeCoverOwner(transaction, claim);
    const current = await findThemeCoverClaimUsing(transaction, claim);
    if (
      !current ||
      current.payloadHash !== claim.payloadHash ||
      Number(current.epoch) !== claim.epoch ||
      (current.status !== "claimed" && current.status !== "consumed")
    ) {
      throw claimRevokedError();
    }

    const result = await operation({
      findBySlug: (slug) => findThemeBySlugUsing(transaction, slug),
      insert: (values) =>
        transaction.transaction((savepoint) =>
          insertThemeIfSlugAvailableUsing(savepoint, values),
        ),
      isCoverUrlReferenced: (url) =>
        isThemeCoverUrlReferencedUsing(transaction, url),
    });

    if (current.status === "consumed") {
      if (current.themeId !== result.themeId) throw claimRevokedError();
      return result;
    }

    const [consumed] = await transaction.execute(sql<{ themeId: string }>`
      update public.theme_cover_claims
      set status = 'consumed',
          theme_id = ${result.themeId}::uuid,
          lease_expires_at = null,
          updated_at = now()
      where bucket = ${claim.bucket}
        and object_key = ${claim.objectKey}
        and owner_id = ${claim.ownerId}::uuid
        and payload_hash = ${claim.payloadHash}
        and epoch = ${claim.epoch}
        and status = 'claimed'
      returning theme_id as "themeId"
    `);
    if (consumed?.themeId !== result.themeId) throw claimRevokedError();

    return result;
  });
}

export async function prepareThemeCoverCleanup(
  claim: ThemeCoverClaim,
  coverUrl: string,
): Promise<
  | { status: "preserved-in-use" }
  | { status: "cleanup-ready"; claim: ThemeCoverCleanupClaim }
  | { status: "already-absent" }
> {
  assertTrustedThemeCoverClaimInput(claim);
  return getDatabase().transaction(async (transaction) => {
    await lockThemeCoverClaim(transaction, claim);
    await assertActiveThemeCoverOwner(transaction, claim);
    const current = await findThemeCoverClaimUsing(transaction, claim);
    if (!current || current.payloadHash !== claim.payloadHash) {
      throw claimRevokedError();
    }
    if (current.status === "consumed") {
      return { status: "preserved-in-use" };
    }
    if (current.status === "deleted") return { status: "already-absent" };
    if (current.status !== "claimed" || Number(current.epoch) !== claim.epoch) {
      throw cleanupBusyError();
    }

    const [referencedTheme] = await transaction.execute(sql<{ id: string }>`
      select id
      from public.themes
      where cover_url = ${coverUrl}
      limit 1
    `);
    if (referencedTheme) {
      const [consumed] = await transaction.execute(sql<{ themeId: string }>`
        update public.theme_cover_claims
        set status = 'consumed',
            theme_id = ${referencedTheme.id}::uuid,
            lease_expires_at = null,
            updated_at = now()
        where bucket = ${claim.bucket}
          and object_key = ${claim.objectKey}
          and owner_id = ${claim.ownerId}::uuid
          and payload_hash = ${claim.payloadHash}
          and epoch = ${claim.epoch}
          and status = 'claimed'
        returning theme_id as "themeId"
      `);
      if (!consumed) throw claimRevokedError();
      return { status: "preserved-in-use" };
    }

    const [cleanupRow] = await transaction.execute(sql<ThemeCoverClaimRow>`
      update public.theme_cover_claims
      set epoch = epoch + 1,
          status = 'deleting',
          lease_expires_at = now() + ${CLEANUP_CLAIM_LEASE_MS} * interval '1 millisecond',
          updated_at = now()
      where bucket = ${claim.bucket}
        and object_key = ${claim.objectKey}
        and owner_id = ${claim.ownerId}::uuid
        and payload_hash = ${claim.payloadHash}
        and epoch = ${claim.epoch}
        and status = 'claimed'
      returning
        bucket,
        object_key as "objectKey",
        owner_id as "ownerId",
        payload_hash as "payloadHash",
        epoch,
        status,
        lease_expires_at as "leaseExpiresAt",
        theme_id as "themeId"
    `);
    const cleanup = cleanupRow as ThemeCoverClaimRow | undefined;
    if (!cleanup) throw claimRevokedError();

    return {
      status: "cleanup-ready",
      claim: asThemeCoverClaim(cleanup, claim.actorId),
    };
  });
}

export async function finalizeThemeCoverCleanup(
  claim: ThemeCoverCleanupClaim,
  outcome: "deleted" | "delete-failed",
): Promise<void> {
  assertTrustedThemeCoverClaimInput(claim);
  const targetStatus = outcome === "deleted" ? "deleted" : "delete_failed";
  await getDatabase().transaction(async (transaction) => {
    await lockThemeCoverClaim(transaction, claim);
    await assertActiveThemeCoverOwner(transaction, claim);
    const [finalized] = await transaction.execute(sql<{ status: string }>`
      update public.theme_cover_claims
      set status = ${targetStatus},
          lease_expires_at = null,
          updated_at = now()
      where bucket = ${claim.bucket}
        and object_key = ${claim.objectKey}
        and owner_id = ${claim.ownerId}::uuid
        and payload_hash = ${claim.payloadHash}
        and epoch = ${claim.epoch}
        and status = 'deleting'
      returning status
    `);
    if (finalized?.status === targetStatus) return;

    const current = await findThemeCoverClaimUsing(transaction, claim);
    if (
      current?.payloadHash === claim.payloadHash &&
      Number(current.epoch) === claim.epoch &&
      current.status === targetStatus
    ) {
      return;
    }
    throw claimRevokedError();
  });
}

export async function withThemeCoverUrlLock<T>(
  coverUrl: string,
  operation: (repository: LockedThemeCreationRepository) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtextextended(${coverUrl}, 0::bigint))`,
    );

    return operation({
      findBySlug: (slug) => findThemeBySlugUsing(transaction, slug),
      insert: (values) =>
        transaction.transaction((savepoint) =>
          insertThemeIfSlugAvailableUsing(savepoint, values),
        ),
      isCoverUrlReferenced: (url) =>
        isThemeCoverUrlReferencedUsing(transaction, url),
    });
  });
}

export async function updateThemeRecord(
  themeId: string,
  values: Partial<NewTheme>,
) {
  return updateThemeRecordUsing(getDatabase(), themeId, values);
}

export async function setThemeActiveRecord(themeId: string, isActive: boolean) {
  return updateThemeRecord(themeId, { isActive });
}

export async function themeHasSessions(themeId: string) {
  const [result] = await getDatabase()
    .select({ value: count() })
    .from(gameSessions)
    .where(eq(gameSessions.themeId, themeId));

  return Number(result.value) > 0;
}

export async function deleteThemeRecord(themeId: string) {
  const [deleted] = await getDatabase()
    .delete(themes)
    .where(eq(themes.id, themeId))
    .returning({ id: themes.id });

  return deleted?.id ?? null;
}

export async function upsertSongAndAssociation(
  input: SongAssociationUpsertInput,
) {
  await getDatabase().transaction(async (transaction) => {
    await upsertSongAndAssociationUsing(transaction, input);
  });
}

export async function updateThemeSongAssociation(input: ThemeSongUpdateInput) {
  await getDatabase().transaction(async (transaction) => {
    await updateThemeSongAssociationUsing(transaction, input);
  });
}

export async function findThemeSong(
  themeId: string,
  songId: string,
): Promise<ThemeSongEditorItem | null> {
  return findThemeSongUsing(getDatabase(), themeId, songId);
}

export async function findThemeSongByProviderContentId(
  themeId: string,
  providerContentId: string,
): Promise<ThemeSongEditorItem | null> {
  return findThemeSongByProviderContentIdUsing(
    getDatabase(),
    themeId,
    providerContentId,
  );
}

export async function listThemeProviderContentIds(
  themeId: string,
): Promise<string[]> {
  const rows = await getDatabase()
    .select({ providerContentId: songs.providerContentId })
    .from(themeSongs)
    .innerJoin(songs, eq(songs.id, themeSongs.songId))
    .where(and(eq(themeSongs.themeId, themeId), eq(songs.provider, "youtube")));

  return rows.map(({ providerContentId }) => providerContentId);
}

export async function importPlaylistTracks(
  themeId: string,
  tracks: ResolvedPlaylistTrack[],
  options: {
    providerContentIdsToAssociate: string[];
    providerContentIdsToCountAsExisting: string[];
  },
): Promise<{ added: number; alreadyAssociated: number }> {
  return getDatabase().transaction(async (transaction) => {
    const locked = await transaction.execute(
      sql`select ${themes.id} from ${themes} where ${themes.id} = ${themeId} for update`,
    );
    if (locked.length === 0) {
      throw new AppError("THEME_NOT_FOUND", "Tema não encontrado.", 404);
    }

    let added = 0;
    let alreadyAssociated = 0;
    const idsToAssociate = new Set(options.providerContentIdsToAssociate);
    const idsToCountAsExisting = new Set(
      options.providerContentIdsToCountAsExisting,
    );

    for (const track of tracks) {
      const [song] = await transaction
        .insert(songs)
        .values({
          provider: "youtube",
          providerContentId: track.providerContentId,
          sourceTitle: track.sourceTitle,
          sourceChannel: track.sourceChannel,
          thumbnailUrl: track.thumbnailUrl,
          durationSeconds: track.durationSeconds,
          isEmbeddable: track.isEmbeddable,
        })
        .onConflictDoUpdate({
          target: [songs.provider, songs.providerContentId],
          set: {
            sourceTitle: track.sourceTitle,
            sourceChannel: track.sourceChannel,
            thumbnailUrl: track.thumbnailUrl,
            durationSeconds: track.durationSeconds,
            isEmbeddable: track.isEmbeddable,
            updatedAt: new Date(),
          },
        })
        .returning({ id: songs.id });

      if (!idsToAssociate.has(track.providerContentId)) {
        if (!idsToCountAsExisting.has(track.providerContentId)) continue;
        const existingAssociation = await transaction
          .select({ songId: themeSongs.songId })
          .from(themeSongs)
          .where(
            and(
              eq(themeSongs.themeId, themeId),
              eq(themeSongs.songId, song.id),
            ),
          )
          .limit(1);
        if (existingAssociation.length > 0) alreadyAssociated += 1;
        continue;
      }

      const inserted = await transaction
        .insert(themeSongs)
        .values({
          themeId,
          songId: song.id,
          title: track.sourceTitle,
          artist: track.sourceChannel,
          startTimeSeconds: 0,
          previewDurationSeconds: track.durationSeconds,
          isActive: true,
          displayOrder: null,
        })
        .onConflictDoNothing({
          target: [themeSongs.themeId, themeSongs.songId],
        })
        .returning({ songId: themeSongs.songId });

      if (inserted.length > 0) added += 1;
      else alreadyAssociated += 1;
    }

    return { added, alreadyAssociated };
  });
}

export type LockedThemeContentRepository = {
  findThemeSong(songId: string): Promise<ThemeSongEditorItem | null>;
  findThemeSongByProviderContentId(
    providerContentId: string,
  ): Promise<ThemeSongEditorItem | null>;
  findThemeSummary(): Promise<ThemeSummary | null>;
  removeThemeSongRecord(songId: string): Promise<string | null>;
  setThemeActiveRecord(isActive: boolean): Promise<string | null>;
  updateThemeSongAssociation(
    input: Omit<ThemeSongUpdateInput, "themeId">,
  ): Promise<void>;
  updateThemeRecord(values: Partial<NewTheme>): Promise<string | null>;
  upsertSongAndAssociation(
    input: Omit<SongAssociationUpsertInput, "themeId">,
  ): Promise<void>;
};

export async function withThemeContentLock<T>(
  themeId: string,
  operation: (repository: LockedThemeContentRepository) => Promise<T>,
): Promise<T> {
  return getDatabase().transaction(async (transaction) => {
    await transaction.execute(
      sql`select ${themes.id} from ${themes} where ${themes.id} = ${themeId} for update`,
    );

    return operation({
      findThemeSong: (songId) =>
        findThemeSongUsing(transaction, themeId, songId),
      findThemeSongByProviderContentId: (providerContentId) =>
        findThemeSongByProviderContentIdUsing(
          transaction,
          themeId,
          providerContentId,
        ),
      findThemeSummary: () => findThemeSummaryUsing(transaction, themeId),
      removeThemeSongRecord: (songId) =>
        removeThemeSongRecordUsing(transaction, themeId, songId),
      setThemeActiveRecord: (isActive) =>
        updateThemeRecordUsing(transaction, themeId, { isActive }),
      updateThemeSongAssociation: (input) =>
        updateThemeSongAssociationUsing(transaction, { themeId, ...input }),
      updateThemeRecord: (values) =>
        updateThemeRecordUsing(transaction, themeId, values),
      upsertSongAndAssociation: (input) =>
        upsertSongAndAssociationUsing(transaction, { themeId, ...input }),
    });
  });
}

export async function removeThemeSongRecord(themeId: string, songId: string) {
  return removeThemeSongRecordUsing(getDatabase(), themeId, songId);
}
