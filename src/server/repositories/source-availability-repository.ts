import "server-only";

import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";

import { getDatabase } from "@/db";
import type { ResolvedProviderTrack } from "@/domain/music/provider";
import type {
  SourceAvailabilityConfirmationReason,
  SourceAvailabilityConfirmedState,
  SourceAvailabilityErrorCode,
  SourceAvailabilityObservation,
} from "@/domain/music/source-availability";
import { AppError } from "@/lib/errors";

type SourceAvailabilityDatabase = Pick<
  ReturnType<typeof getDatabase>,
  "execute"
>;

type ObservationRow = {
  confirmedState: SourceAvailabilityConfirmedState;
  confirmationReason: SourceAvailabilityConfirmationReason | null;
  errorCode: SourceAvailabilityErrorCode | null;
  graceUntil: Date | string | null;
  lastAttemptAt: Date | string;
  lastConfirmedAt: Date | string | null;
  nextCheckAt: Date | string;
  observedAt: Date | string;
  policyVersion: number | string;
  region: string;
  revision: number | string;
  validUntil: Date | string | null;
};

type SourceRow = Partial<ObservationRow> & {
  durationSeconds: number | string;
  isEmbeddable: boolean;
  providerContentId: string;
  songId: string;
  sourceChannel: string;
  sourceTitle: string;
  thumbnailUrl: string;
};

export type SourceAvailabilitySource = {
  songId: string | null;
  providerContentId: string;
  track: ResolvedProviderTrack | null;
  observation: SourceAvailabilityObservation | null;
};

export type PersistSourceAvailabilityInput = {
  providerContentId: string;
  track: ResolvedProviderTrack | null;
  observation: SourceAvailabilityObservation;
};

function requiredDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function optionalDate(value: Date | string | null | undefined) {
  if (value === null || value === undefined) return null;
  return requiredDate(value);
}

function observationFromRow(
  row: ObservationRow,
): SourceAvailabilityObservation {
  return {
    region: row.region,
    confirmedState: row.confirmedState,
    confirmationReason: row.confirmationReason,
    errorCode: row.errorCode,
    observedAt: requiredDate(row.observedAt),
    lastAttemptAt: requiredDate(row.lastAttemptAt),
    lastConfirmedAt: optionalDate(row.lastConfirmedAt),
    validUntil: optionalDate(row.validUntil),
    graceUntil: optionalDate(row.graceUntil),
    nextCheckAt: requiredDate(row.nextCheckAt),
    revision: Number(row.revision),
    policyVersion: Number(row.policyVersion),
  };
}

function hasObservation(row: SourceRow): row is SourceRow & ObservationRow {
  return row.revision !== null && row.revision !== undefined;
}

function sourceKeyHash(providerContentId: string) {
  return createHash("sha256")
    .update(`youtube:${providerContentId}`, "utf8")
    .digest("hex");
}

async function findUnboundObservationUsing(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
  region: string,
): Promise<SourceAvailabilitySource | null> {
  const rows = await database.execute(sql<ObservationRow>`
    select
      region,
      confirmed_state as "confirmedState",
      confirmation_reason as "confirmationReason",
      error_code as "errorCode",
      observed_at as "observedAt",
      last_attempt_at as "lastAttemptAt",
      last_confirmed_at as "lastConfirmedAt",
      valid_until as "validUntil",
      grace_until as "graceUntil",
      next_check_at as "nextCheckAt",
      revision,
      policy_version as "policyVersion"
    from public.unbound_source_availability_observations
    where source_key_hash = ${sourceKeyHash(providerContentId)}
      and region = ${region}
  `);

  const row = rows[0] as ObservationRow | undefined;
  if (!row) return null;
  return {
    songId: null,
    providerContentId,
    track: null,
    observation: observationFromRow(row),
  };
}

async function findSourceUsing(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
  region: string,
): Promise<SourceAvailabilitySource | null> {
  const rows = await database.execute(sql<SourceRow>`
    select
      source.id as "songId",
      source.provider_content_id as "providerContentId",
      source.source_title as "sourceTitle",
      source.source_channel as "sourceChannel",
      source.thumbnail_url as "thumbnailUrl",
      source.duration_seconds as "durationSeconds",
      source.is_embeddable as "isEmbeddable",
      observation.region,
      observation.confirmed_state as "confirmedState",
      observation.confirmation_reason as "confirmationReason",
      observation.error_code as "errorCode",
      observation.observed_at as "observedAt",
      observation.last_attempt_at as "lastAttemptAt",
      observation.last_confirmed_at as "lastConfirmedAt",
      observation.valid_until as "validUntil",
      observation.grace_until as "graceUntil",
      observation.next_check_at as "nextCheckAt",
      observation.revision,
      observation.policy_version as "policyVersion"
    from public.songs as source
    left join public.source_availability_observations as observation
      on observation.song_id = source.id
      and observation.region = ${region}
    where source.provider = 'youtube'
      and source.provider_content_id = ${providerContentId}
    limit 1
  `);

  const row = rows[0] as SourceRow | undefined;
  if (!row) {
    return findUnboundObservationUsing(database, providerContentId, region);
  }
  const observation = hasObservation(row) ? observationFromRow(row) : null;
  return {
    songId: row.songId,
    providerContentId: row.providerContentId,
    track: {
      providerContentId: row.providerContentId,
      sourceTitle: row.sourceTitle,
      sourceChannel: row.sourceChannel,
      thumbnailUrl: row.thumbnailUrl,
      durationSeconds: Number(row.durationSeconds),
      isEmbeddable: row.isEmbeddable,
      isRegionAllowed: observation?.confirmationReason !== "region_blocked",
    },
    observation,
  };
}

async function findSongIdForUpdate(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
) {
  const rows = await database.execute(sql<{ id: string }>`
    select id
    from public.songs
    where provider = 'youtube'
      and provider_content_id = ${providerContentId}
    for update
  `);

  const source = rows[0] as { id: string } | undefined;
  return source?.id ?? null;
}

async function resolveSongId(
  database: SourceAvailabilityDatabase,
  input: PersistSourceAvailabilityInput,
) {
  if (input.track) {
    const rows = await database.execute(sql<{ id: string }>`
      insert into public.songs (
        provider,
        provider_content_id,
        source_title,
        source_channel,
        thumbnail_url,
        duration_seconds,
        is_embeddable
      ) values (
        'youtube',
        ${input.providerContentId},
        ${input.track.sourceTitle},
        ${input.track.sourceChannel},
        ${input.track.thumbnailUrl},
        ${input.track.durationSeconds},
        ${input.track.isEmbeddable}
      )
      on conflict (provider, provider_content_id) do nothing
      returning id
    `);
    const inserted = rows[0] as { id: string } | undefined;
    if (inserted) return inserted.id;
  }

  const songId = await findSongIdForUpdate(database, input.providerContentId);
  if (songId) return songId;

  throw new AppError(
    "SOURCE_NOT_FOUND",
    "A Fonte não foi encontrada e o provedor não forneceu metadados confiáveis.",
    404,
  );
}

async function upsertObservationUsing(
  database: SourceAvailabilityDatabase,
  songId: string,
  observation: SourceAvailabilityObservation,
) {
  const rows = await database.execute(sql<ObservationRow>`
    insert into public.source_availability_observations as current (
      song_id,
      region,
      confirmed_state,
      confirmation_reason,
      error_code,
      observed_at,
      last_attempt_at,
      last_confirmed_at,
      valid_until,
      grace_until,
      next_check_at,
      revision,
      policy_version
    ) values (
      ${songId}::uuid,
      ${observation.region},
      ${observation.confirmedState},
      ${observation.confirmationReason},
      ${observation.errorCode},
      ${observation.observedAt},
      ${observation.lastAttemptAt},
      ${observation.lastConfirmedAt},
      ${observation.validUntil},
      ${observation.graceUntil},
      ${observation.nextCheckAt},
      ${observation.revision},
      ${observation.policyVersion}
    )
    on conflict (song_id, region) do update set
      confirmed_state = excluded.confirmed_state,
      confirmation_reason = excluded.confirmation_reason,
      error_code = excluded.error_code,
      observed_at = excluded.observed_at,
      last_attempt_at = excluded.last_attempt_at,
      last_confirmed_at = excluded.last_confirmed_at,
      valid_until = excluded.valid_until,
      grace_until = excluded.grace_until,
      next_check_at = excluded.next_check_at,
      revision = current.revision + 1,
      policy_version = excluded.policy_version,
      updated_at = now()
    where excluded.revision >= current.revision
      and excluded.observed_at >= current.observed_at
      and excluded.last_attempt_at >= current.last_attempt_at
      and row(
        excluded.confirmed_state,
        excluded.confirmation_reason,
        excluded.error_code,
        excluded.observed_at,
        excluded.last_attempt_at,
        excluded.last_confirmed_at,
        excluded.valid_until,
        excluded.grace_until,
        excluded.next_check_at,
        excluded.policy_version
      ) is distinct from row(
        current.confirmed_state,
        current.confirmation_reason,
        current.error_code,
        current.observed_at,
        current.last_attempt_at,
        current.last_confirmed_at,
        current.valid_until,
        current.grace_until,
        current.next_check_at,
        current.policy_version
      )
    returning
      region,
      confirmed_state as "confirmedState",
      confirmation_reason as "confirmationReason",
      error_code as "errorCode",
      observed_at as "observedAt",
      last_attempt_at as "lastAttemptAt",
      last_confirmed_at as "lastConfirmedAt",
      valid_until as "validUntil",
      grace_until as "graceUntil",
      next_check_at as "nextCheckAt",
      revision,
      policy_version as "policyVersion"
  `);

  const row = rows[0] as ObservationRow | undefined;
  return row ? observationFromRow(row) : null;
}

async function upsertUnboundObservationUsing(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
  observation: SourceAvailabilityObservation,
) {
  const rows = await database.execute(sql<ObservationRow>`
    insert into public.unbound_source_availability_observations as current (
      source_key_hash,
      region,
      confirmed_state,
      confirmation_reason,
      error_code,
      observed_at,
      last_attempt_at,
      last_confirmed_at,
      valid_until,
      grace_until,
      next_check_at,
      revision,
      policy_version
    ) values (
      ${sourceKeyHash(providerContentId)},
      ${observation.region},
      ${observation.confirmedState},
      ${observation.confirmationReason},
      ${observation.errorCode},
      ${observation.observedAt},
      ${observation.lastAttemptAt},
      ${observation.lastConfirmedAt},
      ${observation.validUntil},
      ${observation.graceUntil},
      ${observation.nextCheckAt},
      ${observation.revision},
      ${observation.policyVersion}
    )
    on conflict (source_key_hash, region) do update set
      confirmed_state = excluded.confirmed_state,
      confirmation_reason = excluded.confirmation_reason,
      error_code = excluded.error_code,
      observed_at = excluded.observed_at,
      last_attempt_at = excluded.last_attempt_at,
      last_confirmed_at = excluded.last_confirmed_at,
      valid_until = excluded.valid_until,
      grace_until = excluded.grace_until,
      next_check_at = excluded.next_check_at,
      revision = current.revision + 1,
      policy_version = excluded.policy_version,
      updated_at = now()
    where excluded.revision >= current.revision
      and excluded.observed_at >= current.observed_at
      and excluded.last_attempt_at >= current.last_attempt_at
      and row(
        excluded.confirmed_state,
        excluded.confirmation_reason,
        excluded.error_code,
        excluded.observed_at,
        excluded.last_attempt_at,
        excluded.last_confirmed_at,
        excluded.valid_until,
        excluded.grace_until,
        excluded.next_check_at,
        excluded.policy_version
      ) is distinct from row(
        current.confirmed_state,
        current.confirmation_reason,
        current.error_code,
        current.observed_at,
        current.last_attempt_at,
        current.last_confirmed_at,
        current.valid_until,
        current.grace_until,
        current.next_check_at,
        current.policy_version
      )
    returning
      region,
      confirmed_state as "confirmedState",
      confirmation_reason as "confirmationReason",
      error_code as "errorCode",
      observed_at as "observedAt",
      last_attempt_at as "lastAttemptAt",
      last_confirmed_at as "lastConfirmedAt",
      valid_until as "validUntil",
      grace_until as "graceUntil",
      next_check_at as "nextCheckAt",
      revision,
      policy_version as "policyVersion"
  `);

  const row = rows[0] as ObservationRow | undefined;
  return row ? observationFromRow(row) : null;
}

async function findUnboundObservationForWriteUsing(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
  region: string,
) {
  const rows = await database.execute(sql<ObservationRow>`
    select
      region,
      confirmed_state as "confirmedState",
      confirmation_reason as "confirmationReason",
      error_code as "errorCode",
      observed_at as "observedAt",
      last_attempt_at as "lastAttemptAt",
      last_confirmed_at as "lastConfirmedAt",
      valid_until as "validUntil",
      grace_until as "graceUntil",
      next_check_at as "nextCheckAt",
      revision,
      policy_version as "policyVersion"
    from public.unbound_source_availability_observations
    where source_key_hash = ${sourceKeyHash(providerContentId)}
      and region = ${region}
  `);

  const row = rows[0] as ObservationRow | undefined;
  if (!row) {
    throw new AppError(
      "SOURCE_AVAILABILITY_WRITE_CONFLICT",
      "A observação concorrente não pôde ser reconciliada.",
      409,
    );
  }
  return observationFromRow(row);
}

async function findUnboundObservationForUpdateUsing(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
  region: string,
) {
  const rows = await database.execute(sql<ObservationRow>`
    select
      region,
      confirmed_state as "confirmedState",
      confirmation_reason as "confirmationReason",
      error_code as "errorCode",
      observed_at as "observedAt",
      last_attempt_at as "lastAttemptAt",
      last_confirmed_at as "lastConfirmedAt",
      valid_until as "validUntil",
      grace_until as "graceUntil",
      next_check_at as "nextCheckAt",
      revision,
      policy_version as "policyVersion"
    from public.unbound_source_availability_observations
    where source_key_hash = ${sourceKeyHash(providerContentId)}
      and region = ${region}
    for update
  `);

  const row = rows[0] as ObservationRow | undefined;
  return row ? observationFromRow(row) : null;
}

async function removeUnboundObservationUsing(
  database: SourceAvailabilityDatabase,
  providerContentId: string,
  region: string,
) {
  await database.execute(sql`
    delete from public.unbound_source_availability_observations
    where source_key_hash = ${sourceKeyHash(providerContentId)}
      and region = ${region}
  `);
}

async function findObservationUsing(
  database: SourceAvailabilityDatabase,
  songId: string,
  region: string,
) {
  const rows = await database.execute(sql<ObservationRow>`
    select
      region,
      confirmed_state as "confirmedState",
      confirmation_reason as "confirmationReason",
      error_code as "errorCode",
      observed_at as "observedAt",
      last_attempt_at as "lastAttemptAt",
      last_confirmed_at as "lastConfirmedAt",
      valid_until as "validUntil",
      grace_until as "graceUntil",
      next_check_at as "nextCheckAt",
      revision,
      policy_version as "policyVersion"
    from public.source_availability_observations
    where song_id = ${songId}::uuid
      and region = ${region}
  `);

  const row = rows[0] as ObservationRow | undefined;
  if (!row) {
    throw new AppError(
      "SOURCE_AVAILABILITY_WRITE_CONFLICT",
      "A observação concorrente não pôde ser reconciliada.",
      409,
    );
  }
  return observationFromRow(row);
}

async function updateSourceMetadata(
  database: SourceAvailabilityDatabase,
  songId: string,
  track: ResolvedProviderTrack,
) {
  await database.execute(sql`
    update public.songs
    set source_title = ${track.sourceTitle},
        source_channel = ${track.sourceChannel},
        thumbnail_url = ${track.thumbnailUrl},
        duration_seconds = ${track.durationSeconds},
        is_embeddable = ${track.isEmbeddable},
        updated_at = now()
    where id = ${songId}::uuid
  `);
}

export async function findSourceAvailabilityByProviderContentId(
  providerContentId: string,
  region: string,
) {
  return findSourceUsing(getDatabase(), providerContentId, region);
}

export async function persistSourceAvailabilityObservation(
  input: PersistSourceAvailabilityInput,
): Promise<{
  songId: string | null;
  observation: SourceAvailabilityObservation;
  applied: boolean;
}> {
  return getDatabase().transaction(async (transaction) => {
    const songId = input.track
      ? await resolveSongId(transaction, input)
      : await findSongIdForUpdate(transaction, input.providerContentId);

    if (!songId) {
      const appliedObservation = await upsertUnboundObservationUsing(
        transaction,
        input.providerContentId,
        input.observation,
      );
      if (!appliedObservation) {
        return {
          songId: null,
          observation: await findUnboundObservationForWriteUsing(
            transaction,
            input.providerContentId,
            input.observation.region,
          ),
          applied: false,
        };
      }

      return {
        songId: null,
        observation: appliedObservation,
        applied: true,
      };
    }

    const unboundObservation = await findUnboundObservationForUpdateUsing(
      transaction,
      input.providerContentId,
      input.observation.region,
    );
    if (unboundObservation) {
      await upsertObservationUsing(transaction, songId, unboundObservation);
    }

    const appliedObservation = await upsertObservationUsing(
      transaction,
      songId,
      input.observation,
    );

    if (!appliedObservation) {
      const persistedObservation = await findObservationUsing(
        transaction,
        songId,
        input.observation.region,
      );
      await removeUnboundObservationUsing(
        transaction,
        input.providerContentId,
        input.observation.region,
      );
      return {
        songId,
        observation: persistedObservation,
        applied: false,
      };
    }

    await removeUnboundObservationUsing(
      transaction,
      input.providerContentId,
      input.observation.region,
    );

    if (input.track) {
      await updateSourceMetadata(transaction, songId, input.track);
    }

    return { songId, observation: appliedObservation, applied: true };
  });
}
