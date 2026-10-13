CREATE TABLE "catalog_global_health_activation" (
	"singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
	"activated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"policy_version" integer NOT NULL,
	"rule_version" integer NOT NULL,
	CONSTRAINT "catalog_global_health_singleton_check" CHECK ("catalog_global_health_activation"."singleton" = true),
	CONSTRAINT "catalog_global_health_versions_check" CHECK ("catalog_global_health_activation"."policy_version" > 0 and "catalog_global_health_activation"."rule_version" > 0)
);
--> statement-breakpoint
ALTER TABLE "catalog_global_health_activation" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "catalog_invalidation_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"theme_id" uuid NOT NULL,
	"source_key_hash" varchar(64) NOT NULL,
	"region" varchar(2) NOT NULL,
	"revision" integer NOT NULL,
	"policy_version" integer NOT NULL,
	"rule_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"available_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"lease_token" uuid,
	"leased_until" timestamp with time zone,
	"processed_at" timestamp with time zone,
	CONSTRAINT "catalog_invalidation_identity_unique" UNIQUE("source_key_hash","region","revision","theme_id"),
	CONSTRAINT "catalog_invalidation_source_check" CHECK ("catalog_invalidation_outbox"."source_key_hash" ~ '^[0-9a-f]{64}$' and "catalog_invalidation_outbox"."region" = 'BR'),
	CONSTRAINT "catalog_invalidation_versions_check" CHECK ("catalog_invalidation_outbox"."revision" > 0 and "catalog_invalidation_outbox"."policy_version" > 0 and "catalog_invalidation_outbox"."rule_version" > 0),
	CONSTRAINT "catalog_invalidation_attempts_check" CHECK ("catalog_invalidation_outbox"."attempts" >= 0),
	CONSTRAINT "catalog_invalidation_lease_check" CHECK (("catalog_invalidation_outbox"."lease_token" is null) = ("catalog_invalidation_outbox"."leased_until" is null)),
	CONSTRAINT "catalog_invalidation_payload_check" CHECK (
      jsonb_typeof("catalog_invalidation_outbox"."payload") = 'object'
      and "catalog_invalidation_outbox"."payload" ?& array['schemaVersion','ruleVersion','type','cause','source','theme','transition','paths']::text[]
      and "catalog_invalidation_outbox"."payload" - array['schemaVersion','ruleVersion','type','cause','source','theme','transition','paths']::text[] = '{}'::jsonb
      and "catalog_invalidation_outbox"."payload"->>'schemaVersion' = '1'
      and "catalog_invalidation_outbox"."payload"->>'type' = 'source_health_changed'
      and "catalog_invalidation_outbox"."payload"->>'cause' = 'health_change'
      and "catalog_invalidation_outbox"."payload"->>'ruleVersion' = "catalog_invalidation_outbox"."rule_version"::text
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'source') = 'object'
      and ("catalog_invalidation_outbox"."payload"->'source') ?& array['keyHash','region','revision','policyVersion']::text[]
      and ("catalog_invalidation_outbox"."payload"->'source') - array['keyHash','region','revision','policyVersion']::text[] = '{}'::jsonb
      and "catalog_invalidation_outbox"."payload"->'source'->>'keyHash' = "catalog_invalidation_outbox"."source_key_hash"
      and "catalog_invalidation_outbox"."payload"->'source'->>'region' = "catalog_invalidation_outbox"."region"
      and "catalog_invalidation_outbox"."payload"->'source'->>'revision' = "catalog_invalidation_outbox"."revision"::text
      and "catalog_invalidation_outbox"."payload"->'source'->>'policyVersion' = "catalog_invalidation_outbox"."policy_version"::text
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'theme') = 'object'
      and ("catalog_invalidation_outbox"."payload"->'theme') ?& array['id','slug']::text[]
      and ("catalog_invalidation_outbox"."payload"->'theme') - array['id','slug']::text[] = '{}'::jsonb
      and "catalog_invalidation_outbox"."payload"->'theme'->>'id' = "catalog_invalidation_outbox"."theme_id"::text
      and "catalog_invalidation_outbox"."payload"->'theme'->>'slug' ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      and length("catalog_invalidation_outbox"."payload"->'theme'->>'slug') <= 140
      and jsonb_typeof("catalog_invalidation_outbox"."payload"->'transition') = 'object'
      and ("catalog_invalidation_outbox"."payload"->'transition') ?& array['fromVisibility','toVisibility','fromOperationalState','toOperationalState','lostPrimaryModes','recoveredPrimaryModes']::text[]
      and ("catalog_invalidation_outbox"."payload"->'transition') - array['fromVisibility','toVisibility','fromOperationalState','toOperationalState','lostPrimaryModes','recoveredPrimaryModes']::text[] = '{}'::jsonb
      and "catalog_invalidation_outbox"."payload"->'paths' = jsonb_build_array('/', '/tema/' || ("catalog_invalidation_outbox"."payload"->'theme'->>'slug'), '/admin', '/admin/temas', '/admin/temas/' || "catalog_invalidation_outbox"."theme_id"::text)
    )
);
--> statement-breakpoint
ALTER TABLE "catalog_invalidation_outbox" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "catalog_invalidation_pending_idx" ON "catalog_invalidation_outbox" USING btree ("available_at","created_at","id") WHERE "catalog_invalidation_outbox"."processed_at" is null;
--> statement-breakpoint
ALTER TABLE "public"."catalog_global_health_activation" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."catalog_global_health_activation" FROM PUBLIC, anon, authenticated;

--> statement-breakpoint
ALTER TABLE "public"."catalog_invalidation_outbox" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
REVOKE ALL ON TABLE "public"."catalog_invalidation_outbox" FROM PUBLIC, anon, authenticated;
