CREATE TYPE "public"."admin_role" AS ENUM('admin', 'editor');--> statement-breakpoint
CREATE TYPE "public"."game_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('pending', 'ready', 'completed');--> statement-breakpoint
CREATE TYPE "public"."music_provider" AS ENUM('youtube');--> statement-breakpoint
CREATE TABLE "admin_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(120) NOT NULL,
	"role" "admin_role" DEFAULT 'admin' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "game_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"position" integer NOT NULL,
	"song_a_id" uuid,
	"song_b_id" uuid,
	"winner_song_id" uuid,
	"status" "match_status" DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_matches_round_position_uidx" UNIQUE("session_id","round_number","position"),
	CONSTRAINT "game_matches_round_number_check" CHECK ("game_matches"."round_number" >= 1),
	CONSTRAINT "game_matches_position_check" CHECK ("game_matches"."position" >= 1)
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"bracket_size" integer NOT NULL,
	"status" "game_status" DEFAULT 'active' NOT NULL,
	"current_round" integer DEFAULT 1 NOT NULL,
	"champion_song_id" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_sessions_bracket_size_check" CHECK ("game_sessions"."bracket_size" in (4, 8, 16, 32)),
	CONSTRAINT "game_sessions_current_round_check" CHECK ("game_sessions"."current_round" >= 1)
);
--> statement-breakpoint
CREATE TABLE "session_songs" (
	"session_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"seed" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"artist" varchar(200) NOT NULL,
	"thumbnail_url" text NOT NULL,
	"provider" "music_provider" NOT NULL,
	"provider_content_id" varchar(64) NOT NULL,
	"start_time_seconds" integer NOT NULL,
	"preview_duration_seconds" integer NOT NULL,
	CONSTRAINT "session_songs_session_id_song_id_pk" PRIMARY KEY("session_id","song_id"),
	CONSTRAINT "session_songs_seed_uidx" UNIQUE("session_id","seed"),
	CONSTRAINT "session_songs_seed_check" CHECK ("session_songs"."seed" >= 1),
	CONSTRAINT "session_songs_start_time_check" CHECK ("session_songs"."start_time_seconds" >= 0),
	CONSTRAINT "session_songs_preview_duration_check" CHECK ("session_songs"."preview_duration_seconds" between 15 and 60)
);
--> statement-breakpoint
CREATE TABLE "songs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "music_provider" NOT NULL,
	"provider_content_id" varchar(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"artist" varchar(200) NOT NULL,
	"source_title" text NOT NULL,
	"source_channel" text NOT NULL,
	"thumbnail_url" text NOT NULL,
	"duration_seconds" integer NOT NULL,
	"is_embeddable" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "songs_provider_content_uidx" UNIQUE("provider","provider_content_id"),
	CONSTRAINT "songs_duration_positive_check" CHECK ("songs"."duration_seconds" > 0)
);
--> statement-breakpoint
CREATE TABLE "theme_songs" (
	"theme_id" uuid NOT NULL,
	"song_id" uuid NOT NULL,
	"start_time_seconds" integer DEFAULT 0 NOT NULL,
	"preview_duration_seconds" integer DEFAULT 30 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"display_order" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_songs_theme_id_song_id_pk" PRIMARY KEY("theme_id","song_id"),
	CONSTRAINT "theme_songs_start_time_check" CHECK ("theme_songs"."start_time_seconds" >= 0),
	CONSTRAINT "theme_songs_preview_duration_check" CHECK ("theme_songs"."preview_duration_seconds" between 15 and 60),
	CONSTRAINT "theme_songs_display_order_check" CHECK ("theme_songs"."display_order" is null or "theme_songs"."display_order" >= 0)
);
--> statement-breakpoint
CREATE TABLE "themes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"slug" varchar(140) NOT NULL,
	"description" text,
	"cover_url" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"default_bracket_size" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "themes_bracket_size_check" CHECK ("themes"."default_bracket_size" in (4, 8, 16, 32))
);
--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_song_a_id_songs_id_fk" FOREIGN KEY ("song_a_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_song_b_id_songs_id_fk" FOREIGN KEY ("song_b_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_matches" ADD CONSTRAINT "game_matches_winner_song_id_songs_id_fk" FOREIGN KEY ("winner_song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_champion_song_id_songs_id_fk" FOREIGN KEY ("champion_song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_songs" ADD CONSTRAINT "session_songs_session_id_game_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_songs" ADD CONSTRAINT "session_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_songs" ADD CONSTRAINT "theme_songs_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "theme_songs" ADD CONSTRAINT "theme_songs_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_profiles_active_idx" ON "admin_profiles" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "game_matches_session_status_idx" ON "game_matches" USING btree ("session_id","status");--> statement-breakpoint
CREATE INDEX "game_sessions_theme_idx" ON "game_sessions" USING btree ("theme_id");--> statement-breakpoint
CREATE INDEX "game_sessions_status_idx" ON "game_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "session_songs_session_idx" ON "session_songs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "theme_songs_theme_active_idx" ON "theme_songs" USING btree ("theme_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "themes_slug_uidx" ON "themes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "themes_active_idx" ON "themes" USING btree ("is_active");