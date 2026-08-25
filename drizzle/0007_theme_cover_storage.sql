CREATE SCHEMA IF NOT EXISTS "private";--> statement-breakpoint
REVOKE ALL ON SCHEMA "private" FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA "private" TO authenticated;--> statement-breakpoint
CREATE OR REPLACE FUNCTION "private"."is_active_admin"()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "public"."admin_profiles"
    WHERE "user_id" = (SELECT "auth"."uid"())
      AND "is_active" = true
  );
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION "private"."is_active_admin"() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "private"."is_active_admin"() TO authenticated;--> statement-breakpoint
INSERT INTO "storage"."buckets" (
  "id",
  "name",
  "public",
  "file_size_limit",
  "allowed_mime_types"
)
VALUES (
  'theme-covers',
  'theme-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT ("id") DO UPDATE SET
  "public" = EXCLUDED."public",
  "file_size_limit" = EXCLUDED."file_size_limit",
  "allowed_mime_types" = EXCLUDED."allowed_mime_types";--> statement-breakpoint
DROP POLICY IF EXISTS "Active admins can upload theme covers" ON "storage"."objects";--> statement-breakpoint
CREATE POLICY "Active admins can upload theme covers"
ON "storage"."objects"
FOR INSERT
TO authenticated
WITH CHECK (
  "bucket_id" = 'theme-covers'
  AND "private"."is_active_admin"()
  AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text
);--> statement-breakpoint
DROP POLICY IF EXISTS "Active admins can delete theme covers" ON "storage"."objects";--> statement-breakpoint
CREATE POLICY "Active admins can delete theme covers"
ON "storage"."objects"
FOR DELETE
TO authenticated
USING (
  "bucket_id" = 'theme-covers'
  AND "private"."is_active_admin"()
);
