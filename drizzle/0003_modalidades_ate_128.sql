ALTER TABLE "game_sessions" DROP CONSTRAINT "game_sessions_bracket_size_check";--> statement-breakpoint
ALTER TABLE "themes" DROP CONSTRAINT "themes_bracket_size_check";--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_bracket_size_check" CHECK ("game_sessions"."bracket_size" in (4, 8, 16, 32, 64, 128));--> statement-breakpoint
ALTER TABLE "themes" ADD CONSTRAINT "themes_bracket_size_check" CHECK ("themes"."default_bracket_size" in (4, 8, 16, 32, 64, 128));