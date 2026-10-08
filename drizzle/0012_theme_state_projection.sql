CREATE TABLE "theme_state_projections" (
	"theme_id" uuid PRIMARY KEY NOT NULL,
	"available_fresh" integer NOT NULL,
	"available_grace" integer NOT NULL,
	"unavailable" integer NOT NULL,
	"unknown" integer NOT NULL,
	"playable_count" integer NOT NULL,
	"potential_count" integer NOT NULL,
	"active_entry_count" integer NOT NULL,
	"supported_modes" integer[] NOT NULL,
	"editorial_state" "theme_editorial_state" NOT NULL,
	"visibility" varchar(8) NOT NULL,
	"operational_state" varchar(48) NOT NULL,
	"policy_version" integer NOT NULL,
	"rule_version" integer NOT NULL,
	"calculated_at" timestamp with time zone NOT NULL,
	"thumbnail_urls" text[] NOT NULL,
	"next_transition_at" timestamp with time zone,
	CONSTRAINT "theme_projection_nonnegative_check" CHECK ("theme_state_projections"."available_fresh" >= 0 and "theme_state_projections"."available_grace" >= 0 and "theme_state_projections"."unavailable" >= 0 and "theme_state_projections"."unknown" >= 0),
	CONSTRAINT "theme_projection_counts_check" CHECK ("theme_state_projections"."playable_count" = "theme_state_projections"."available_fresh" + "theme_state_projections"."available_grace" and "theme_state_projections"."potential_count" = "theme_state_projections"."playable_count" + "theme_state_projections"."unknown" and "theme_state_projections"."active_entry_count" = "theme_state_projections"."potential_count" + "theme_state_projections"."unavailable"),
	CONSTRAINT "theme_projection_versions_check" CHECK ("theme_state_projections"."policy_version" > 0 and "theme_state_projections"."rule_version" > 0),
	CONSTRAINT "theme_projection_visibility_check" CHECK ("theme_state_projections"."visibility" in ('visible', 'hidden') and ("theme_state_projections"."visibility" <> 'visible' or ("theme_state_projections"."editorial_state" = 'published' and "theme_state_projections"."playable_count" >= 4))),
	CONSTRAINT "theme_projection_operational_check" CHECK ("theme_state_projections"."operational_state" in ('editorial_draft', 'healthy', 'degraded', 'suspended_pending_verification', 'suspended_insufficient_healthy_entries')),
	CONSTRAINT "theme_projection_modes_check" CHECK ("theme_state_projections"."supported_modes" <@ array[4,8,16,32,64,128]::integer[] and array_position("theme_state_projections"."supported_modes", null) is null)
);
--> statement-breakpoint
ALTER TABLE "theme_state_projections" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "theme_state_projections" ADD CONSTRAINT "theme_state_projections_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theme_projection_visibility_idx" ON "theme_state_projections" USING btree ("visibility","theme_id");--> statement-breakpoint
CREATE INDEX "theme_projection_operational_idx" ON "theme_state_projections" USING btree ("operational_state","theme_id");
--> statement-breakpoint
ALTER TABLE "public"."theme_state_projections" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."theme_state_projections" FROM PUBLIC, anon, authenticated;
