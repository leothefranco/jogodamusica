CREATE TABLE "theme_cover_claims" (
	"bucket" varchar(63) NOT NULL,
	"object_key" text NOT NULL,
	"owner_id" uuid NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"epoch" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'claimed' NOT NULL,
	"lease_expires_at" timestamp with time zone,
	"theme_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "theme_cover_claims_bucket_object_key_owner_id_pk" PRIMARY KEY("bucket","object_key","owner_id"),
	CONSTRAINT "theme_cover_claims_epoch_check" CHECK ("theme_cover_claims"."epoch" > 0),
	CONSTRAINT "theme_cover_claims_status_check" CHECK ("theme_cover_claims"."status" in ('claimed', 'consumed', 'deleting', 'delete_failed', 'deleted')),
	CONSTRAINT "theme_cover_claims_payload_hash_check" CHECK ("theme_cover_claims"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "theme_cover_claims_object_key_check" CHECK ("theme_cover_claims"."bucket" = 'theme-covers'
        and split_part("theme_cover_claims"."object_key", '/', 1) = "theme_cover_claims"."owner_id"::text
        and "theme_cover_claims"."object_key" ~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'),
	CONSTRAINT "theme_cover_claims_lease_check" CHECK ((
          "theme_cover_claims"."status" in ('claimed', 'deleting')
          and "theme_cover_claims"."lease_expires_at" is not null
        ) or (
          "theme_cover_claims"."status" in ('consumed', 'delete_failed', 'deleted')
          and "theme_cover_claims"."lease_expires_at" is null
        )),
	CONSTRAINT "theme_cover_claims_theme_check" CHECK (("theme_cover_claims"."status" = 'consumed' and "theme_cover_claims"."theme_id" is not null)
        or ("theme_cover_claims"."status" <> 'consumed' and "theme_cover_claims"."theme_id" is null))
);
--> statement-breakpoint
ALTER TABLE "theme_cover_claims" ADD CONSTRAINT "theme_cover_claims_theme_id_themes_id_fk" FOREIGN KEY ("theme_id") REFERENCES "public"."themes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "theme_cover_claims_owner_bucket_idx" ON "theme_cover_claims" USING btree ("owner_id","bucket");--> statement-breakpoint
CREATE INDEX "theme_cover_claims_theme_idx" ON "theme_cover_claims" USING btree ("theme_id");--> statement-breakpoint
ALTER TABLE "public"."theme_cover_claims" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
REVOKE ALL ON TABLE "public"."theme_cover_claims" FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON TABLE "public"."theme_cover_claims" TO authenticated;--> statement-breakpoint
DROP POLICY IF EXISTS "Active admins can inspect own theme cover claims" ON "public"."theme_cover_claims";--> statement-breakpoint
CREATE POLICY "Active admins can inspect own theme cover claims"
ON "public"."theme_cover_claims"
FOR SELECT
TO authenticated
USING (
	(SELECT "private"."is_active_admin"())
	AND "owner_id" = (SELECT "auth"."uid"())
	AND "bucket" = 'theme-covers'
	AND split_part("object_key", '/', 1) = (SELECT "auth"."uid"())::text
);--> statement-breakpoint
DROP POLICY IF EXISTS "Active admins can delete theme covers" ON "storage"."objects";--> statement-breakpoint
CREATE POLICY "Active admins can delete theme covers"
ON "storage"."objects"
FOR DELETE
TO authenticated
USING (
	"bucket_id" = 'theme-covers'
	AND (SELECT "private"."is_active_admin"())
	AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text
	AND "owner_id" = (SELECT "auth"."uid"())::text
	AND NOT EXISTS (
		SELECT 1
		FROM "public"."theme_cover_claims" AS "claim"
		WHERE "claim"."bucket" = "bucket_id"
			AND "claim"."object_key" = "name"
			AND "claim"."owner_id" = (SELECT "auth"."uid"())
			AND "claim"."status" IN ('claimed', 'consumed')
	)
);
