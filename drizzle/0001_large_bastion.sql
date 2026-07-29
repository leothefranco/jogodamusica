ALTER TABLE "session_songs" DROP CONSTRAINT "session_songs_preview_duration_check";--> statement-breakpoint
ALTER TABLE "theme_songs" DROP CONSTRAINT "theme_songs_preview_duration_check";--> statement-breakpoint
ALTER TABLE "theme_songs" ALTER COLUMN "preview_duration_seconds" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "session_songs" ADD CONSTRAINT "session_songs_preview_duration_check" CHECK ("session_songs"."preview_duration_seconds" > 0);--> statement-breakpoint
ALTER TABLE "theme_songs" ADD CONSTRAINT "theme_songs_preview_duration_check" CHECK ("theme_songs"."preview_duration_seconds" > 0);