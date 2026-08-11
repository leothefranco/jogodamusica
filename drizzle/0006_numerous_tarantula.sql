CREATE TABLE "rate_limit_buckets" (
	"key_hash" varchar(64) PRIMARY KEY NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rate_limit_buckets_count_check" CHECK ("rate_limit_buckets"."request_count" > 0)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_buckets_expires_at_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
-- Only the server-side Postgres connection may access rate-limit counters.
-- No anon/authenticated Data API policies are intentionally defined.
ALTER TABLE "public"."rate_limit_buckets" ENABLE ROW LEVEL SECURITY;
