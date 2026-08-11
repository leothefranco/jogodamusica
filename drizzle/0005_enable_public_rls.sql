-- The application accesses these tables through its server-side Postgres
-- connection. No Data API policies are intentionally defined: anon and
-- authenticated requests must not read or mutate game data directly.
ALTER TABLE "public"."admin_profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."game_matches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."game_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."session_songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."theme_songs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."themes" ENABLE ROW LEVEL SECURITY;
