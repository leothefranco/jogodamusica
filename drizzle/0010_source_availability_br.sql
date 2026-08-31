CREATE TYPE "public"."source_availability_error" AS ENUM('transport', 'quota', 'configuration', 'invalid_response', 'provider_error');--> statement-breakpoint
CREATE TYPE "public"."source_availability_reason" AS ENUM('available', 'region_blocked', 'not_embeddable', 'not_found');--> statement-breakpoint
CREATE TYPE "public"."source_availability_state" AS ENUM('available', 'unavailable', 'unknown');--> statement-breakpoint
CREATE TABLE "source_availability_observations" (
	"song_id" uuid NOT NULL,
	"region" varchar(8) NOT NULL,
	"confirmed_state" "source_availability_state" DEFAULT 'unknown' NOT NULL,
	"confirmation_reason" "source_availability_reason",
	"error_code" "source_availability_error",
	"observed_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"next_check_at" timestamp with time zone NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "source_availability_observations_song_id_region_pk" PRIMARY KEY("song_id","region"),
	CONSTRAINT "source_availability_region_check" CHECK ("source_availability_observations"."region" ~ '^[A-Z]{2}$'),
	CONSTRAINT "source_availability_revision_check" CHECK ("source_availability_observations"."revision" > 0),
	CONSTRAINT "source_availability_policy_version_check" CHECK ("source_availability_observations"."policy_version" > 0),
	CONSTRAINT "source_availability_attempt_order_check" CHECK ("source_availability_observations"."observed_at" <= "source_availability_observations"."last_attempt_at"
        and ("source_availability_observations"."last_confirmed_at" is null or "source_availability_observations"."last_confirmed_at" <= "source_availability_observations"."last_attempt_at")),
	CONSTRAINT "source_availability_next_check_check" CHECK ("source_availability_observations"."next_check_at" >= "source_availability_observations"."last_attempt_at"),
	CONSTRAINT "source_availability_confirmation_check" CHECK ((
          "source_availability_observations"."confirmed_state" = 'available'
          and "source_availability_observations"."confirmation_reason" is not null
          and "source_availability_observations"."confirmation_reason" = 'available'
          and "source_availability_observations"."last_confirmed_at" is not null
          and "source_availability_observations"."valid_until" is not null
          and "source_availability_observations"."grace_until" is not null
          and "source_availability_observations"."last_confirmed_at" <= "source_availability_observations"."valid_until"
          and "source_availability_observations"."valid_until" <= "source_availability_observations"."grace_until"
        ) or (
          "source_availability_observations"."confirmed_state" = 'unavailable'
          and "source_availability_observations"."confirmation_reason" is not null
          and "source_availability_observations"."confirmation_reason" in ('region_blocked', 'not_embeddable', 'not_found')
          and "source_availability_observations"."last_confirmed_at" is not null
          and "source_availability_observations"."valid_until" is null
          and "source_availability_observations"."grace_until" is null
        ) or (
          "source_availability_observations"."confirmed_state" = 'unknown'
          and "source_availability_observations"."confirmation_reason" is null
          and "source_availability_observations"."last_confirmed_at" is null
          and "source_availability_observations"."valid_until" is null
          and "source_availability_observations"."grace_until" is null
        ))
);
--> statement-breakpoint
CREATE TABLE "unbound_source_availability_observations" (
	"source_key_hash" varchar(64) NOT NULL,
	"region" varchar(8) NOT NULL,
	"confirmed_state" "source_availability_state" DEFAULT 'unknown' NOT NULL,
	"confirmation_reason" "source_availability_reason",
	"error_code" "source_availability_error",
	"observed_at" timestamp with time zone NOT NULL,
	"last_attempt_at" timestamp with time zone NOT NULL,
	"last_confirmed_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"grace_until" timestamp with time zone,
	"next_check_at" timestamp with time zone NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"policy_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unbound_source_availability_observations_source_key_hash_region_pk" PRIMARY KEY("source_key_hash","region"),
	CONSTRAINT "unbound_source_availability_key_hash_check" CHECK ("unbound_source_availability_observations"."source_key_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "unbound_source_availability_region_check" CHECK ("unbound_source_availability_observations"."region" ~ '^[A-Z]{2}$'),
	CONSTRAINT "unbound_source_availability_revision_check" CHECK ("unbound_source_availability_observations"."revision" > 0),
	CONSTRAINT "unbound_source_availability_policy_version_check" CHECK ("unbound_source_availability_observations"."policy_version" > 0),
	CONSTRAINT "unbound_source_availability_attempt_order_check" CHECK ("unbound_source_availability_observations"."observed_at" <= "unbound_source_availability_observations"."last_attempt_at"
        and ("unbound_source_availability_observations"."last_confirmed_at" is null or "unbound_source_availability_observations"."last_confirmed_at" <= "unbound_source_availability_observations"."last_attempt_at")),
	CONSTRAINT "unbound_source_availability_next_check_check" CHECK ("unbound_source_availability_observations"."next_check_at" >= "unbound_source_availability_observations"."last_attempt_at"),
	CONSTRAINT "unbound_source_availability_confirmation_check" CHECK ((
          "unbound_source_availability_observations"."confirmed_state" = 'available'
          and "unbound_source_availability_observations"."confirmation_reason" is not null
          and "unbound_source_availability_observations"."confirmation_reason" = 'available'
          and "unbound_source_availability_observations"."last_confirmed_at" is not null
          and "unbound_source_availability_observations"."valid_until" is not null
          and "unbound_source_availability_observations"."grace_until" is not null
          and "unbound_source_availability_observations"."last_confirmed_at" <= "unbound_source_availability_observations"."valid_until"
          and "unbound_source_availability_observations"."valid_until" <= "unbound_source_availability_observations"."grace_until"
        ) or (
          "unbound_source_availability_observations"."confirmed_state" = 'unavailable'
          and "unbound_source_availability_observations"."confirmation_reason" is not null
          and "unbound_source_availability_observations"."confirmation_reason" in ('region_blocked', 'not_embeddable', 'not_found')
          and "unbound_source_availability_observations"."last_confirmed_at" is not null
          and "unbound_source_availability_observations"."valid_until" is null
          and "unbound_source_availability_observations"."grace_until" is null
        ) or (
          "unbound_source_availability_observations"."confirmed_state" = 'unknown'
          and "unbound_source_availability_observations"."confirmation_reason" is null
          and "unbound_source_availability_observations"."last_confirmed_at" is null
          and "unbound_source_availability_observations"."valid_until" is null
          and "unbound_source_availability_observations"."grace_until" is null
        ))
);
--> statement-breakpoint
ALTER TABLE "source_availability_observations" ADD CONSTRAINT "source_availability_observations_song_id_songs_id_fk" FOREIGN KEY ("song_id") REFERENCES "public"."songs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "source_availability_region_next_check_idx" ON "source_availability_observations" USING btree ("region","next_check_at");--> statement-breakpoint
CREATE INDEX "unbound_source_availability_region_next_check_idx" ON "unbound_source_availability_observations" USING btree ("region","next_check_at");--> statement-breakpoint
ALTER TABLE "public"."source_availability_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."source_availability_observations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."source_availability_observations" FROM PUBLIC, anon, authenticated;--> statement-breakpoint
ALTER TABLE "public"."unbound_source_availability_observations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "public"."unbound_source_availability_observations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."unbound_source_availability_observations" FROM PUBLIC, anon, authenticated;
