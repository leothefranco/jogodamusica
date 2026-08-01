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
    defaultBracketSize: integer("default_bracket_size").default(4).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("themes_slug_uidx").on(table.slug),
    index("themes_active_idx").on(table.isActive),
    check(
      "themes_bracket_size_check",
      sql`${table.defaultBracketSize} in (4, 8, 16, 32, 64, 128)`,
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
export type Song = typeof songs.$inferSelect;
export type NewSong = typeof songs.$inferInsert;
export type ThemeSong = typeof themeSongs.$inferSelect;
export type GameSession = typeof gameSessions.$inferSelect;
export type SessionSong = typeof sessionSongs.$inferSelect;
export type GameMatch = typeof gameMatches.$inferSelect;
