ALTER TABLE "theme_songs" ADD COLUMN "title" varchar(200);--> statement-breakpoint
ALTER TABLE "theme_songs" ADD COLUMN "artist" varchar(200);--> statement-breakpoint
UPDATE "theme_songs"
SET
  "title" = "songs"."title",
  "artist" = "songs"."artist"
FROM "songs"
WHERE "theme_songs"."song_id" = "songs"."id";--> statement-breakpoint
ALTER TABLE "theme_songs" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "theme_songs" ALTER COLUMN "artist" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "title";--> statement-breakpoint
ALTER TABLE "songs" DROP COLUMN "artist";
