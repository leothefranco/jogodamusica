import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const adminRoleEnum = pgEnum("admin_role", ["admin", "editor"]);
export const musicProviderEnum = pgEnum("music_provider", ["youtube"]);
export const gameStatusEnum = pgEnum("game_status", [
  "active",
  "completed",
  "abandoned",
]);
export const matchStatusEnum = pgEnum("match_status", [
  "pending",
  "ready",
  "completed",
]);
export const sourceAvailabilityStateEnum = pgEnum("source_availability_state", [
  "available",
  "unavailable",
  "unknown",
]);
export const sourceAvailabilityReasonEnum = pgEnum(
  "source_availability_reason",
  ["available", "region_blocked", "not_embeddable", "not_found"],
);
export const sourceAvailabilityErrorEnum = pgEnum("source_availability_error", [
  "transport",
  "quota",
  "configuration",
  "invalid_response",
  "provider_error",
]);

export const rateLimitBuckets = pgTable(
  "rate_limit_buckets",
  {
    keyHash: varchar("key_hash", { length: 64 }).primaryKey(),
    requestCount: integer("request_count").default(1).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("rate_limit_buckets_expires_at_idx").on(table.expiresAt),
    check("rate_limit_buckets_count_check", sql`${table.requestCount} > 0`),
  ],
);

export const adminProfiles = pgTable(
  "admin_profiles",
  {
    userId: uuid("user_id").primaryKey(),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    role: adminRoleEnum("role").default("admin").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    ...timestamps,
  },
  (table) => [index("admin_profiles_active_idx").on(table.isActive)],
);

export const themes = pgTable(
  "themes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: text("description"),
    coverUrl: text("cover_url"),
    isActive: boolean("is_active").default(false).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("themes_slug_uidx").on(table.slug),
    index("themes_active_idx").on(table.isActive),
  ],
);

export type ThemeCoverClaimStatus =
  "claimed" | "consumed" | "deleting" | "delete_failed" | "deleted";

export const themeCoverClaims = pgTable(
  "theme_cover_claims",
  {
    bucket: varchar("bucket", { length: 63 }).notNull(),
    objectKey: text("object_key").notNull(),
    ownerId: uuid("owner_id").notNull(),
    payloadHash: varchar("payload_hash", { length: 64 }).notNull(),
    epoch: integer("epoch").default(1).notNull(),
    status: varchar("status", { length: 20 })
      .$type<ThemeCoverClaimStatus>()
      .default("claimed")
      .notNull(),
    leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
    themeId: uuid("theme_id").references(() => themes.id, {
      onDelete: "cascade",
    }),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.bucket, table.objectKey, table.ownerId] }),
    index("theme_cover_claims_owner_bucket_idx").on(
      table.ownerId,
      table.bucket,
    ),
    index("theme_cover_claims_theme_idx").on(table.themeId),
    check("theme_cover_claims_epoch_check", sql`${table.epoch} > 0`),
    check(
      "theme_cover_claims_status_check",
      sql`${table.status} in ('claimed', 'consumed', 'deleting', 'delete_failed', 'deleted')`,
    ),
    check(
      "theme_cover_claims_payload_hash_check",
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "theme_cover_claims_object_key_check",
      sql`${table.bucket} = 'theme-covers'
        and split_part(${table.objectKey}, '/', 1) = ${table.ownerId}::text
        and ${table.objectKey} ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(jpg|png|webp)$'`,
    ),
    check(
      "theme_cover_claims_lease_check",
      sql`(
          ${table.status} in ('claimed', 'deleting')
          and ${table.leaseExpiresAt} is not null
        ) or (
          ${table.status} in ('consumed', 'delete_failed', 'deleted')
          and ${table.leaseExpiresAt} is null
        )`,
    ),
    check(
      "theme_cover_claims_theme_check",
      sql`(${table.status} = 'consumed' and ${table.themeId} is not null)
        or (${table.status} <> 'consumed' and ${table.themeId} is null)`,
    ),
  ],
);

export const songs = pgTable(
  "songs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: musicProviderEnum("provider").notNull(),
    providerContentId: varchar("provider_content_id", {
      length: 64,
    }).notNull(),
    sourceTitle: text("source_title").notNull(),
    sourceChannel: text("source_channel").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    durationSeconds: integer("duration_seconds").notNull(),
    isEmbeddable: boolean("is_embeddable").notNull(),
    ...timestamps,
  },
  (table) => [
    unique("songs_provider_content_uidx").on(
      table.provider,
      table.providerContentId,
    ),
    check("songs_duration_positive_check", sql`${table.durationSeconds} > 0`),
  ],
);

function sourceAvailabilityObservationColumns() {
  return {
    region: varchar("region", { length: 8 }).notNull(),
    confirmedState: sourceAvailabilityStateEnum("confirmed_state")
      .default("unknown")
      .notNull(),
    confirmationReason: sourceAvailabilityReasonEnum("confirmation_reason"),
    errorCode: sourceAvailabilityErrorEnum("error_code"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    lastAttemptAt: timestamp("last_attempt_at", {
      withTimezone: true,
    }).notNull(),
    lastConfirmedAt: timestamp("last_confirmed_at", { withTimezone: true }),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    graceUntil: timestamp("grace_until", { withTimezone: true }),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }).notNull(),
    revision: integer("revision").default(1).notNull(),
    policyVersion: integer("policy_version").default(1).notNull(),
    ...timestamps,
  };
}

export const sourceAvailabilityObservations = pgTable(
  "source_availability_observations",
  {
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    ...sourceAvailabilityObservationColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.songId, table.region] }),
    index("source_availability_region_next_check_idx").on(
      table.region,
      table.nextCheckAt,
    ),
    check(
      "source_availability_region_check",
      sql`${table.region} ~ '^[A-Z]{2}$'`,
    ),
    check("source_availability_revision_check", sql`${table.revision} > 0`),
    check(
      "source_availability_policy_version_check",
      sql`${table.policyVersion} > 0`,
    ),
    check(
      "source_availability_attempt_order_check",
      sql`${table.observedAt} <= ${table.lastAttemptAt}
        and (${table.lastConfirmedAt} is null or ${table.lastConfirmedAt} <= ${table.lastAttemptAt})`,
    ),
    check(
      "source_availability_next_check_check",
      sql`${table.nextCheckAt} >= ${table.lastAttemptAt}`,
    ),
    check(
      "source_availability_confirmation_check",
      sql`(
          ${table.confirmedState} = 'available'
          and ${table.confirmationReason} = 'available'
          and ${table.lastConfirmedAt} is not null
          and ${table.validUntil} is not null
          and ${table.graceUntil} is not null
          and ${table.lastConfirmedAt} <= ${table.validUntil}
          and ${table.validUntil} <= ${table.graceUntil}
        ) or (
          ${table.confirmedState} = 'unavailable'
          and ${table.confirmationReason} in ('region_blocked', 'not_embeddable', 'not_found')
          and ${table.lastConfirmedAt} is not null
          and ${table.validUntil} is null
          and ${table.graceUntil} is null
        ) or (
          ${table.confirmedState} = 'unknown'
          and ${table.confirmationReason} is null
          and ${table.lastConfirmedAt} is null
          and ${table.validUntil} is null
          and ${table.graceUntil} is null
        )`,
    ),
  ],
).enableRLS();

export const unboundSourceAvailabilityObservations = pgTable(
  "unbound_source_availability_observations",
  {
    sourceKeyHash: varchar("source_key_hash", { length: 64 }).notNull(),
    ...sourceAvailabilityObservationColumns(),
  },
  (table) => [
    primaryKey({ columns: [table.sourceKeyHash, table.region] }),
    index("unbound_source_availability_region_next_check_idx").on(
      table.region,
      table.nextCheckAt,
    ),
    check(
      "unbound_source_availability_key_hash_check",
      sql`${table.sourceKeyHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      "unbound_source_availability_region_check",
      sql`${table.region} ~ '^[A-Z]{2}$'`,
    ),
    check(
      "unbound_source_availability_revision_check",
      sql`${table.revision} > 0`,
    ),
    check(
      "unbound_source_availability_policy_version_check",
      sql`${table.policyVersion} > 0`,
    ),
    check(
      "unbound_source_availability_attempt_order_check",
      sql`${table.observedAt} <= ${table.lastAttemptAt}
        and (${table.lastConfirmedAt} is null or ${table.lastConfirmedAt} <= ${table.lastAttemptAt})`,
    ),
    check(
      "unbound_source_availability_next_check_check",
      sql`${table.nextCheckAt} >= ${table.lastAttemptAt}`,
    ),
    check(
      "unbound_source_availability_confirmation_check",
      sql`(
          ${table.confirmedState} = 'available'
          and ${table.confirmationReason} = 'available'
          and ${table.lastConfirmedAt} is not null
          and ${table.validUntil} is not null
          and ${table.graceUntil} is not null
          and ${table.lastConfirmedAt} <= ${table.validUntil}
          and ${table.validUntil} <= ${table.graceUntil}
        ) or (
          ${table.confirmedState} = 'unavailable'
          and ${table.confirmationReason} in ('region_blocked', 'not_embeddable', 'not_found')
          and ${table.lastConfirmedAt} is not null
          and ${table.validUntil} is null
          and ${table.graceUntil} is null
        ) or (
          ${table.confirmedState} = 'unknown'
          and ${table.confirmationReason} is null
          and ${table.lastConfirmedAt} is null
          and ${table.validUntil} is null
          and ${table.graceUntil} is null
        )`,
    ),
  ],
).enableRLS();

export const themeSongs = pgTable(
  "theme_songs",
  {
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    artist: varchar("artist", { length: 200 }).notNull(),
    startTimeSeconds: integer("start_time_seconds").default(0).notNull(),
    previewDurationSeconds: integer("preview_duration_seconds").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    displayOrder: integer("display_order"),
    ...timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.themeId, table.songId] }),
    index("theme_songs_theme_active_idx").on(table.themeId, table.isActive),
    check("theme_songs_start_time_check", sql`${table.startTimeSeconds} >= 0`),
    check(
      "theme_songs_preview_duration_check",
      sql`${table.previewDurationSeconds} > 0`,
    ),
    check(
      "theme_songs_display_order_check",
      sql`${table.displayOrder} is null or ${table.displayOrder} >= 0`,
    ),
  ],
);

export const gameSessions = pgTable(
  "game_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    themeId: uuid("theme_id")
      .notNull()
      .references(() => themes.id, { onDelete: "restrict" }),
    bracketSize: integer("bracket_size").notNull(),
    status: gameStatusEnum("status").default("active").notNull(),
    currentRound: integer("current_round").default(1).notNull(),
    championSongId: uuid("champion_song_id").references(() => songs.id, {
      onDelete: "restrict",
    }),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    index("game_sessions_theme_idx").on(table.themeId),
    index("game_sessions_status_idx").on(table.status),
    check(
      "game_sessions_bracket_size_check",
      sql`${table.bracketSize} in (4, 8, 16, 32, 64, 128)`,
    ),
    check("game_sessions_current_round_check", sql`${table.currentRound} >= 1`),
  ],
);

export const sessionSongs = pgTable(
  "session_songs",
  {
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    songId: uuid("song_id")
      .notNull()
      .references(() => songs.id, { onDelete: "restrict" }),
    seed: integer("seed").notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    artist: varchar("artist", { length: 200 }).notNull(),
    thumbnailUrl: text("thumbnail_url").notNull(),
    provider: musicProviderEnum("provider").notNull(),
    providerContentId: varchar("provider_content_id", {
      length: 64,
    }).notNull(),
    startTimeSeconds: integer("start_time_seconds").notNull(),
    previewDurationSeconds: integer("preview_duration_seconds").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.sessionId, table.songId] }),
    unique("session_songs_seed_uidx").on(table.sessionId, table.seed),
    index("session_songs_session_idx").on(table.sessionId),
    check("session_songs_seed_check", sql`${table.seed} >= 1`),
    check(
      "session_songs_start_time_check",
      sql`${table.startTimeSeconds} >= 0`,
    ),
    check(
      "session_songs_preview_duration_check",
      sql`${table.previewDurationSeconds} > 0`,
    ),
  ],
);

export const gameMatches = pgTable(
  "game_matches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    position: integer("position").notNull(),
    songAId: uuid("song_a_id").references(() => songs.id, {
      onDelete: "restrict",
    }),
    songBId: uuid("song_b_id").references(() => songs.id, {
      onDelete: "restrict",
    }),
    winnerSongId: uuid("winner_song_id").references(() => songs.id, {
      onDelete: "restrict",
    }),
    status: matchStatusEnum("status").default("pending").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    unique("game_matches_round_position_uidx").on(
      table.sessionId,
      table.roundNumber,
      table.position,
    ),
    index("game_matches_session_status_idx").on(table.sessionId, table.status),
    check("game_matches_round_number_check", sql`${table.roundNumber} >= 1`),
    check("game_matches_position_check", sql`${table.position} >= 1`),
  ],
);

export type AdminProfile = typeof adminProfiles.$inferSelect;
export type NewAdminProfile = typeof adminProfiles.$inferInsert;
export type Theme = typeof themes.$inferSelect;
export type NewTheme = typeof themes.$inferInsert;
export type ThemeCoverClaimRecord = typeof themeCoverClaims.$inferSelect;
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
export type SourceAvailabilityObservationRecord =
  typeof sourceAvailabilityObservations.$inferSelect;
export type UnboundSourceAvailabilityObservationRecord =
  typeof unboundSourceAvailabilityObservations.$inferSelect;
export type ThemeSong = typeof themeSongs.$inferSelect;
export type GameSession = typeof gameSessions.$inferSelect;
export type SessionSong = typeof sessionSongs.$inferSelect;
export type GameMatch = typeof gameMatches.$inferSelect;
export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
