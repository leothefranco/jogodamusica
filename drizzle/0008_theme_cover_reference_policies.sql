ALTER POLICY "Active admins can upload theme covers"
ON "storage"."objects"
TO authenticated
WITH CHECK (
  "bucket_id" = 'theme-covers'
  AND "private"."is_active_admin"()
  AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text
);--> statement-breakpoint
DROP POLICY IF EXISTS "Active admins can inspect own theme covers" ON "storage"."objects";--> statement-breakpoint
CREATE POLICY "Active admins can inspect own theme covers"
ON "storage"."objects"
FOR SELECT
TO authenticated
USING (
  "bucket_id" = 'theme-covers'
  AND "private"."is_active_admin"()
  AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text
  AND "owner_id" = (SELECT "auth"."uid"())::text
);--> statement-breakpoint
DROP POLICY IF EXISTS "Active admins can delete theme covers" ON "storage"."objects";--> statement-breakpoint
CREATE POLICY "Active admins can delete theme covers"
ON "storage"."objects"
FOR DELETE
TO authenticated
USING (
  "bucket_id" = 'theme-covers'
  AND "private"."is_active_admin"()
  AND ("storage"."foldername"("name"))[1] = (SELECT "auth"."uid"())::text
  AND "owner_id" = (SELECT "auth"."uid"())::text
);
